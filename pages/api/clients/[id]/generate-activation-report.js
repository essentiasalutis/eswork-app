import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../../../../lib/auth';
import {
  getClientById,
  getPatientsByClient,
  getResponsesForClient,
  getSessionsForClient,
  getFirstMeeting,
  insertGeneratedReport,
  insertDocument,
} from '../../../../lib/store';
import { generateAndStorePdf, buildReportHtml } from '../../../../lib/pdf';
import { calculatePricing, computeForchetta, realL1L2FromAssessment } from '../../../../lib/calculator';
import { getPricingSettingsV2, getNotaValidazione } from '../../../../lib/pricing/settings';
import { ergonomiaDaColloquio } from '../../../../lib/pricing/v2';
import { isFirmato } from '../../../../lib/checkup-server';
import { cosaComprendeMarkdown, inserisciCosaComprende, VOCI_PROGRAMMA, quantitaPrimoAnno } from '../../../../lib/programma';
import { getForchettaSnapshot, freezeStimaSnapshot } from '../../../../lib/pricing/snapshot';
import { aggregateNMQ } from '../../../../lib/scoring';
import { CONFIG } from '../../../../lib/config';
import { kAnonPartition, tooSmall, K_ANON } from '../../../../lib/kanon';

export const config = { maxDuration: 60 };

// Stratificazione L1/L2/L3 con soppressione k-anon (gruppi < k → "n.d.").
function stratLines(l1, l2, l3, total) {
  if (tooSmall(total)) {
    return `- Popolazione totale < ${K_ANON}: distribuzione per livello NON pubblicabile (tutela anonimato, k-anonymity)`;
  }
  const P = Object.fromEntries(kAnonPartition([
    { key: 'l1', count: l1 }, { key: 'l2', count: l2 }, { key: 'l3', count: l3 },
  ], total).map(c => [c.key, c]));
  const cell = c => c.suppressed ? `n.d. (gruppo < ${K_ANON}, soppresso per anonimato)` : `${c.count} (${c.pct}%)`;
  return `- Livello 1 (trattamento): ${cell(P.l1)}\n- Livello 2 (monitoraggio): ${cell(P.l2)}\n- Livello 3 (prevenzione): ${cell(P.l3)}`;
}

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.query;
  const client = await getClientById(id).catch(() => null);
  if (!client) return res.status(404).json({ error: 'Cliente non trovato' });

  const [patients, responses, sessions] = await Promise.all([
    getPatientsByClient(id).catch(() => []),
    getResponsesForClient(id).catch(() => []),
    getSessionsForClient(id).catch(() => []),
  ]);

  const totalPatients = patients.length;
  const patL1 = patients.filter(p => p.level === 'level1').length;
  const patL2 = patients.filter(p => p.level === 'level2').length;
  const patL3 = patients.filter(p => p.level === 'level3').length;
  const optedOut = patients.filter(p => p.level_status === 'opted_out').length;

  // Array PIATTO delle risposte dell'assessment (stessa forma usata da offer.js).
  const answers = Object.values((responses && responses.responses) || {}).flat();

  // FONTE della fotografia clinica = le RISPOSTE dell'assessment, non patients.level.
  // Due ragioni, entrambe verificate sul campo:
  //  1. Al momento del Report di Attivazione i pazienti NON esistono ancora: nascono
  //     all'attivazione clinica, cioè DOPO il contratto. Leggendo patients il report
  //     diceva "nessun assessment completato" anche con 45 questionari raccolti — e
  //     nello stesso documento il prezzo era calcolato correttamente dalle risposte.
  //  2. patients.level DERIVA col trattamento, mentre l'Attivazione è la fotografia
  //     del punto di partenza (stessa ragione per cui il baseline T12 usa le risposte
  //     congelate: vedi stratificazioneOsservata in lib/scoring).
  // Fallback su patients solo se non ci sono risposte (cliente già attivo senza assessment).
  const nmqStrat = aggregateNMQ(answers || []);
  const daRisposte = nmqStrat.n > 0;
  const l1Count = daRisposte ? nmqStrat.level1.count : patL1;
  const l2Count = daRisposte ? nmqStrat.level2.count : patL2;
  const l3Count = daRisposte ? nmqStrat.level3.count : patL3;
  const stratTotal = daRisposte ? nmqStrat.n : totalPatients;

  const sectorLabel = client.sector === 1 ? 'Manifattura/Produzione' : 'Servizi/Uffici';
  const tier = client.tier || 'core'; // serve per selezionare i servizi deliverable
  // NB: il tier (Core/Plus/Enterprise) è un nome INTERNO e non viene passato all'AI:
  // fornirglielo e poi vietarne l'uso è una trappola — nel primo giro di test è uscito
  // "il modello Core" nel report destinato al cliente. Il dimensionamento del piano si
  // deduce dalla popolazione, che l'AI riceve già.

  // Rapporto col preventivo: condizioni della scheda colloquio + numeri REALI
  // della stratificazione (prezzo cliente; mai margini/costi nel report).
  const { block: quoteBlock, compliance: quoteCompliance, calc: quoteCalc } = await buildQuoteBlock(id, client, answers);
  // La generazione del Report CHIUDE la catena Stima→Report → timbra frozen_at
  // sullo snapshot (se esiste). Fatto qui, NON in buildQuoteBlock (usata anche
  // dall'endpoint read-only di regressione).
  await freezeStimaSnapshot(id).catch(() => {});

  // ── v2: tabella servizi ("Cosa include il programma") + testi parametrici ──
  // SOLO listino v2: per i clienti v1 il report resta ESATTAMENTE quello attuale.
  const isV2 = (client.pricing_version || 'v1') === 'v2';
  const isPacchetto = isV2 && client.tipo_prodotto === 'pacchetto_prevenzione';
  // "Cosa comprende il programma" (12 voci di Enrico + valori del Listino): la scrive il
  // sistema, non l'AI — i testi restano quelli approvati (lib/programma.js).
  let sezioneComprende = '';
  let v2Texts = {};
  let v2Params = {};
  if (isV2) {
    try {
      const { texts, params } = await getPricingSettingsV2();
      v2Texts = texts || {};
      v2Params = params || {};
    } catch (_) {}
    // Quantità del primo anno + un solo numero (l'investimento): mai valori per voce
    // (decisione Enrico). I cicli si citano solo se il Livello 1 supera la soglia di riservatezza.
    if (!isPacchetto) {
      const l1Visibile = stratTotal >= K_ANON && !kAnonPartition([
        { key: 'l1', count: l1Count }, { key: 'l2', count: l2Count }, { key: 'l3', count: l3Count },
      ], stratTotal).find(c => c.key === 'l1').suppressed;
      sezioneComprende = cosaComprendeMarkdown({ quantita: quantitaPrimoAnno(quoteCalc, { mostraCicli: l1Visibile }), investimento: quoteCalc ? quoteCalc.price_y1 : null });
    }
  }
  const nomeProdotto = isPacchetto
    ? (v2Texts.naming_cliente_pacchetto_prevenzione || 'Pacchetto Prevenzione')
    : (v2Texts.naming_cliente_programma_completo || 'Programma ES Work');
  const testoEvoluzione = v2Texts.testo_evoluzione_pacchetto || '';
  const dataOggi = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  // Nota di validazione deterministica in fondo a ogni report (mai generata dall'AI).
  const notaValidazione = await getNotaValidazione();
  const conNota = t => `${t}\n\n---\n\n*${notaValidazione}*`;

  // NRS data da sessioni
  const sessionsWithNrs = sessions.filter(s => s.nrs_pre != null || s.nrs_post != null);
  const avgNrsPre = sessionsWithNrs.filter(s => s.nrs_pre != null).reduce((a, s) => a + s.nrs_pre, 0) / (sessionsWithNrs.filter(s => s.nrs_pre != null).length || 1);
  const avgNrsPost = sessionsWithNrs.filter(s => s.nrs_post != null).reduce((a, s) => a + s.nrs_post, 0) / (sessionsWithNrs.filter(s => s.nrs_post != null).length || 1);

  // Per il pacchetto NON passiamo sessioni/NRS/tier: sono 0/interni e inducono
  // l'AI a citare trattamenti "non ancora erogati". Solo la fotografia neutra.
  // FASE. Il Report di Attivazione di norma precede il contratto: il programma è PROPOSTO.
  // Nei test l'AI ha scritto "Il programma ES Work è stato attivato presso…" e il testo di
  // riserva diceva "Sono state erogate 0 sessioni… Il programma è operativamente attivo":
  // falsi prima della firma. Se l'azienda ha già firmato (binario A) si può dire "attivo".
  const firmato = isFirmato(client);
  const clinicoBlock = (isPacchetto || !firmato) ? '' : `
SESSIONI EROGATE: ${sessions.length}
NRS medio pre-sessione: ${avgNrsPre.toFixed(1)}/10
NRS medio post-sessione: ${avgNrsPost.toFixed(1)}/10
Riduzione media NRS: ${(avgNrsPre - avgNrsPost).toFixed(1)} punti
`;
  const dataBlock = `
CLIENTE: ${client.name}
Settore: ${sectorLabel}
Dipendenti totali: ${client.employees || 'n.d.'}
STATO DEL PROGRAMMA: ${firmato ? 'attivo (contratto firmato)' : 'PROPOSTO (contratto non ancora firmato)'}
STRATIFICAZIONE (${stratTotal} questionari compilati):
${stratLines(l1Count, l2Count, l3Count, stratTotal)}

DEFINIZIONE DEI LIVELLI (tassativa — NON invertirla, NON reinterpretarla):
- Livello 1 = dolore in atto CON impatto funzionale. È il gruppo più critico, quello che necessita trattamento osteopatico individuale.
- Livello 2 = dolore in atto SENZA impatto funzionale. Monitoraggio e prevenzione.
- Livello 3 = nessun dolore in atto. Formazione collettiva su postura ed ergonomia.
NON esiste una scala "rischio basso/medio/alto": non usarla e non invertire l'ordine. Se citi una priorità, la priorità clinica è il Livello 1.

NOTA PRIVACY: dove un gruppo è "n.d." è stato soppresso per anonimato (k-anonymity). NON dedurre, stimare o ricostruire i valori soppressi. ATTENZIONE: un gruppo può risultare soppresso ANCHE se conta ${K_ANON} persone o più — è la soppressione secondaria, che impedisce di ricavarlo per differenza dagli altri. Quindi NON affermare che i gruppi soppressi siano "inferiori a ${K_ANON}": di' solo che non sono pubblicabili per tutela dell'anonimato.
${clinicoBlock}
CHECK-UP: ${stratTotal > 0 ? `${stratTotal} questionari raccolti` : 'nessun questionario ancora raccolto'}
${isPacchetto ? '' : quoteBlock}
`.trim();

  // PARAMETRI OPERATIVI REALI. Senza questi l'AI riempie i vuoti da sola: nel primo
  // giro ha scritto "6-8 sedute per giornata" (la giornata ne vale 14) e "frequenza
  // quindicinale", cioè impegni di erogazione inventati dentro il documento che
  // fissa il prezzo. Stessa logica della definizione tassativa dei livelli.
  const pOp = { ...{ sessions_per_l1: 4, session_duration_min: 30, prevention_sessions_per_l2: 4 }, ...(v2Params || {}) };
  const parametriOperativi = (!isV2 || isPacchetto) ? '' : `
PARAMETRI OPERATIVI REALI (usa ESATTAMENTE questi, non altri):
- Seduta osteopatica individuale: ${pOp.session_duration_min} minuti
- Ciclo per persona in Livello 1: ${pOp.sessions_per_l1} sedute
- Prevenzione attiva per persona in Livello 2: ${pOp.prevention_sessions_per_l2} sessioni
- Una giornata di sportello in sede vale ${CONFIG.hours_per_day} ore di erogazione
VIETATO inventare dettagli di erogazione che non trovi qui sopra: quante sedute stanno in una giornata, la cadenza degli accessi (settimanale, quindicinale, mensile), durate, calendari, orari. Se un dato non ti è stato fornito, NON scriverlo: il report fissa il prezzo, ogni numero che scrivi diventa un impegno.
VIETATO attribuire alla Piattaforma digitale ES Work funzioni che non ti sono state elencate (alert automatici, contenuti educativi personalizzati, questionari periodici, notifiche, tracciamento in tempo reale): è lo strumento con cui il programma viene gestito e i report prodotti, nient'altro.
ERGONOMIA: descrivila SOLO con le voci e i numeri della riga «consulenza ergonomico-posturale» della PROPOSTA ECONOMICA COLLEGATA, senza aggiungerne. Se lì non compaiono addetti di reparto, NON citare alcuna formazione degli addetti; se non compaiono postazioni tipo di produzione, NON parlare di «studio delle postazioni». In ufficio l'intervento è per persona. Se la PROPOSTA ECONOMICA COLLEGATA manca o non ha quella riga, descrivila solo in termini generali (osservazione delle postazioni e del gesto, raccomandazioni di adeguamento), senza addetti e senza elenchi di interventi tecnici.
COMPONENTI DEL PROGRAMMA (le SOLE che esistono; la sezione con i loro testi la inserisce il sistema): ${VOCI_PROGRAMMA.map(v => v.nome).join('; ')}.
TEMPI (tassativi): le review intermedie al mese 3 e al mese 6 sono REPORT di andamento, NON nuovi check-up; il check-up si ripete UNA sola volta, a 12 mesi, con il Report annuale. VIETATO proporre check-up semestrali, periodici o intermedi, «ricalibrazioni» o aggiornamenti della stratificazione durante l'anno, e qualsiasi attività che non sia tra le componenti qui sopra.
DESTINATARI: la formazione su postura ed ergonomia è aperta a TUTTI i dipendenti, non solo al Livello 3; la prevenzione individuale è per il Livello 2; i cicli clinici per il Livello 1.
VIETATO raccomandare al cliente attività che sono GIÀ comprese nell'investimento (in particolare la consulenza ergonomico-posturale — studio delle postazioni e formazione degli addetti sulla propria postazione — se compare nella PROPOSTA ECONOMICA COLLEGATA): sono incluse, non sono cose "da valutare".`;

  // Vincoli di wording per i documenti v2 (mai violarli nel testo generato).
  const vincoliV2 = isV2 ? `
VINCOLI TASSATIVI SUL TESTO:
- MAI cifre in euro accanto alle singole voci o componenti del programma: le uniche cifre in euro sono l'investimento (Anno 1 e Anno 2 indicativo).
- MAI inventare quantità (giornate, sessioni, cicli, sedute, postazioni, addetti, report) che non trovi nei dati forniti: usa SOLO quelle che ti vengono passate, con la LORO unità (persone in ufficio restano persone, postazioni tipo restano postazioni: mai «40 postazioni» se il dato è «40 persone»).
- MAI espressioni come "in omaggio", "compreso gratuitamente", "gratis".
- MAI "AI" o "intelligenza artificiale" nel nome della piattaforma (si chiama solo "Piattaforma digitale ES Work").
- MAI i termini Core, Plus, Enterprise, "tier", "modello Core/Plus/Enterprise": sono nomi INTERNI, non ti vengono forniti e non vanno inventati. Il prodotto si chiama SOLO "${nomeProdotto}".` : '';
  const istruzioniPacchetto = isPacchetto ? `
════ PRODOTTO "${nomeProdotto}" — 12 mesi, non rinnovabile, AUTOCONCLUSIVO ════
Include SOLO: check-up completo (già svolto), formazione (2 moduli), consulenza ergonomico-posturale (osservazione delle postazioni e del gesto, con raccomandazioni di adeguamento: descrivila in termini generali, SENZA citare numeri di postazioni o di addetti).
NON include: trattamenti individuali, percorsi clinici, prevenzione attiva, sportello osteopatico, follow-up, monitoraggio.

DIVIETI ASSOLUTI — valgono su TUTTO il testo, incluse le PARAFRASI che aggirano la lettera del divieto ma ne violano lo spirito:
1. PIATTAFORMA/ACCESSO: l'azienda NON accede alla Piattaforma e NON consulta dati su di essa — RICEVE i report. VIETATO "per consultazione aziendale", "l'azienda consulta/accede/monitora sulla piattaforma", "a disposizione dell'azienda per la consultazione" e ogni variante.
2. EVOLUZIONE: il programma completo compare SOLO in una chiusura dedicata, con QUESTO testo (adattalo senza stravolgerlo): "${testoEvoluzione}". VIETATO collegarlo alle persone o alle descrizioni dei livelli: niente "beneficia di un approccio personalizzato", "qualora l'azienda decida di estendere", "potrebbe beneficiare di…" dentro le voci L1/L2/L3 o le raccomandazioni.
3. RACCOMANDAZIONI: possono riguardare SOLO formazione, ergonomia e comportamenti organizzativi. VIETATO raccomandare follow-up periodici, monitoraggio sistematico, mini-check, controlli clinici periodici, prese in carico.
4. TRATTAMENTI: si citano SOLO nell'esclusione dichiarata del Piano Operativo. VIETATO "non ancora erogate/erogati", "in attesa di trattamento", "prima fase" e ogni formulazione che li presenti come tappa attesa o futura.
5. MAPPA CLINICA = fotografia NEUTRA del questionario: descrivi i livelli con i soli dati osservati (dolore riportato, impatto funzionale). MAI come bisogni clinici da soddisfare, MAI tono di allarme, MAI "non trattati", "non presi in carico", "sintomatologia non gestita", "richiedono trattamento/protocollo".
PRINCIPIO GUIDA: la stratificazione è la fotografia dello stato della popolazione, NON un elenco di bisogni da colmare. Il pacchetto si esaurisce nelle sue tre attività.` : '';

  // Fallback se manca la chiave: NESSUNA chiamata, nessun dato uscito. La distinzione si
  // conosce qui, prima di chiamare, e resta scritta sul record (ai_status, v57).
  if (!process.env.ANTHROPIC_API_KEY) {
    const fallback = conNota(generateFallbackReport(client, l1Count, l2Count, l3Count, stratTotal, sessions.length, sectorLabel, quoteBlock, { sezioneComprende, isPacchetto, nomeProdotto, testoEvoluzione, firmato }));
    const pdfUrl = await tryGeneratePdf(client, 'activation', fallback, id).catch(() => null);
    const rec = await insertGeneratedReport({ client_id: id, report_type: 'activation', content_text: fallback, created_by: 'system', ai_status: 'fallback_no_key', pdf_url: pdfUrl, quote_compliance: quoteCompliance }).catch(() => null);
    return res.json({ report: fallback, source: 'fallback', ai_status: 'fallback_no_key', pdf_url: pdfUrl, report_id: rec?.id });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Sei un consulente clinico di ES Work (Essentia Salutis). Genera un Report di Attivazione professionale per un'azienda cliente.

DATI CLIENTE:
${dataBlock}

STRUTTURA DEL REPORT (usa markdown con ## per titoli):

## Executive Summary
(3 paragrafi: contesto, dati principali, conclusione operativa)

## Mappa Clinica della Popolazione
(analisi della distribuzione L1/L2/L3, zone di rischio, caratteristiche del profilo clinico)

## Piano Operativo Proposto
${isPacchetto
  ? `(SOLO le attività del pacchetto: check-up già svolto, formazione collettiva, consulenza ergonomico-posturale — NESSUN trattamento incluso)`
  : `(turni di presa in carico, sportello osteopatico, formazione collettiva, dimensionati sulla popolazione indicata; se presente la PROPOSTA ECONOMICA COLLEGATA, citane l'investimento Anno 1 in chiusura)`}

## Raccomandazioni ${isPacchetto ? '' : 'Cliniche'}
${isPacchetto
  ? '(3-5 raccomandazioni SOLO su formazione, ergonomia e comportamenti organizzativi — vedi DIVIETI: niente monitoraggio/follow-up/trattamenti)'
  : '(3-5 raccomandazioni specifiche basate sui dati)'}

## Prossimi Passi
${isPacchetto
  ? '(SOLO gli step del pacchetto: restituzione dei risultati alla direzione, formazione collettiva, sopralluogo ergonomico e conferma delle postazioni, consulenza ergonomico-posturale; NIENTE monitoraggio, follow-up clinici o trattamenti)'
  : '(5 step operativi con timeframe indicativo)'}
${parametriOperativi}${vincoliV2}${istruzioniPacchetto}
${firmato ? '' : 'STATO (tassativo): il contratto NON è ancora firmato, questo report PROPONE il programma. VIETATO scrivere che il programma è stato attivato, avviato, erogato o che è operativo, e VIETATO citare sessioni già svolte: scrivi «programma proposto», «si propone di attivare».\n'}IDENTITÀ PROFESSIONALE (tassativa): il servizio è OSTEOPATICO. Usa sempre "osteopata", "trattamento osteopatico", "sportello osteopatico". VIETATO "fisioterapista", "fisioterapico", "riabilitativo/riabilitazione" e ogni termine fisioterapico riferito al nostro servizio. VIETATO anche presentare il servizio come atto medico o come medicina del lavoro: mai "medicina osteopatica", "medico", "sanitario", "medicina del lavoro", "sorveglianza sanitaria" riferiti a noi. La sorveglianza sanitaria resta del Medico Competente aziendale; noi siamo un programma osteopatico di prevenzione e trattamento, distinto e complementare.
RISULTATI CLINICI (tassativo): MAI promettere risultati clinici — niente «risolvere», «eliminare», «guarire» il dolore o la sintomatologia. Il programma promette presa in carico e misura: scrivi «trattare», «prendere in carico», «monitorare».
LESSICO (tassativo): la rilevazione fatta con il questionario si chiama «check-up» — MAI «assessment» né «re-assessment»; dei dati dei dipendenti si dice che sono «riservati» — MAI «anonimi»; il documento presentato al colloquio è la «Stima di investimento».
CHIUSURA: non aggiungere firme, sottotitoli, slogan o formule di congedo in fondo al report — la chiusura la aggiunge il sistema.${sezioneComprende ? '\nCOMPONENTI: NON scrivere una sezione con l\'elenco delle componenti del programma né le loro quantità (niente «Cosa include» / «Cosa comprende»): la inserisce il sistema con i testi approvati.' : ''}
DATA: se includi un'intestazione con il riepilogo del cliente, riporta "Data: ${dataOggi}". Usa ESATTAMENTE questa data; non inventarne altre né citare altre date nel testo.
Tono: professionale, orientato ai dati. In italiano. Non più di 800 parole totali.`,
      }],
    });

    // Testo troncato (visto l'11/9: "Prossimi Passi" finiva a metà frase) → meglio il testo di riserva.
    if (message.stop_reason === 'max_tokens') throw new Error('testo dell\'AI troncato: troppo lungo');
    const report = conNota(inserisciCosaComprende(message.content[0]?.text || '', sezioneComprende));
    const pdfUrl = await tryGeneratePdf(client, 'activation', report, id).catch(() => null);
    const rec = await insertGeneratedReport({ client_id: id, report_type: 'activation', content_text: report, created_by: 'admin', ai_status: 'ai', pdf_url: pdfUrl, quote_compliance: quoteCompliance }).catch(() => null);
    return res.json({ report, source: 'ai', ai_status: 'ai', pdf_url: pdfUrl, report_id: rec?.id });
  } catch (e) {
    // Qui la chiamata è stata fatta: i dati SONO usciti, la risposta non è stata usata.
    // Si salva solo la classe, mai il messaggio d'errore (può contenere il payload).
    const fallback = conNota(generateFallbackReport(client, l1Count, l2Count, l3Count, stratTotal, sessions.length, sectorLabel, quoteBlock, { sezioneComprende, isPacchetto, nomeProdotto, testoEvoluzione, firmato }));
    const pdfUrl = await tryGeneratePdf(client, 'activation', fallback, id).catch(() => null);
    const rec = await insertGeneratedReport({ client_id: id, report_type: 'activation', content_text: fallback, created_by: 'system', ai_status: 'fallback_errore', pdf_url: pdfUrl, quote_compliance: quoteCompliance }).catch(() => null);
    return res.json({ report: fallback, source: 'fallback', ai_status: 'fallback_errore', error: e.message, pdf_url: pdfUrl, report_id: rec?.id });
  }
});

function generateFallbackReport(client, l1, l2, l3, total, sessioni, settore, quoteBlock, v2 = {}) {
  const { sezioneComprende = '', isPacchetto = false, nomeProdotto = '', testoEvoluzione = '', firmato = false } = v2;
  const small = tooSmall(total);
  const P = small ? null : Object.fromEntries(kAnonPartition([
    { key: 'l1', count: l1 }, { key: 'l2', count: l2 }, { key: 'l3', count: l3 },
  ], total).map(c => [c.key, c]));
  const dip = c => c.suppressed ? `n.d. (gruppo < ${K_ANON})` : `${c.count} dipendenti (${c.pct}%)`;
  const pctL1txt = small || P.l1.suppressed ? 'non pubblicata per anonimato' : `${P.l1.pct}%`;
  const riskTxt = small || P.l1.suppressed ? 'non determinabile nel rispetto della riservatezza' : (P.l1.pct > 20 ? 'elevato' : P.l1.pct > 10 ? 'moderato' : 'contenuto');
  const mappa = small
    ? `La popolazione valutata è inferiore alla soglia minima di aggregazione (${K_ANON}): la distribuzione per livello non viene pubblicata a tutela dell'anonimato dei dipendenti (k-anonymity).`
    : isPacchetto
      // Pacchetto: FOTOGRAFIA NEUTRA del questionario — niente "richiedono
      // protocollo", niente riferimenti a mini-check/prese in carico (non incluse).
      ? `- **Livello 1:** ${dip(P.l1)} — dolore con impatto funzionale riportato nel questionario
- **Livello 2:** ${dip(P.l2)} — sintomatologia presente, senza impatto funzionale rilevante
- **Livello 3:** ${dip(P.l3)} — nessuna sintomatologia rilevante`
      : `- **Livello 1 (Trattamento attivo):** ${dip(P.l1)} — dolore con impatto funzionale, richiedono protocollo individuale
- **Livello 2 (Monitoraggio):** ${dip(P.l2)} — sintomatologia presente, seguiti con mini-check periodici
- **Livello 3 (Prevenzione):** ${dip(P.l3)} — nessuna sintomatologia rilevante, inclusi nella formazione collettiva`;
  return `## Executive Summary

${isPacchetto
  ? `Il percorso ${nomeProdotto || 'd\'ingresso'} per **${client.name}** (${settore}, ${client.employees || 'n.d.'} dipendenti) ha completato il check-up della popolazione con ${total} dipendenti valutati.

La fotografia raccolta indica una quota in Livello 1 pari a ${pctL1txt}: il dettaglio per livello è riportato nella Mappa Clinica.

${firmato ? 'Il percorso prosegue con le attività previste' : 'Il percorso proposto prevede'}: formazione collettiva e consulenza ergonomico-posturale.`
  : firmato
  ? `Il programma ES Work per **${client.name}** (${settore}, ${client.employees || 'n.d.'} dipendenti) ha completato il check-up iniziale con ${total} dipendenti valutati.

La distribuzione clinica evidenzia una quota in Livello 1 (trattamento attivo) pari a ${pctL1txt}, profilo di rischio ${riskTxt}.${sessioni > 0 ? ` Sono state erogate ${sessioni} sessioni osteopatiche ad oggi.` : ''}

Il programma è attivo: il piano operativo è riportato di seguito.`
  : `Il check-up per **${client.name}** (${settore}, ${client.employees || 'n.d.'} dipendenti) ha coinvolto ${total} dipendenti.

La distribuzione clinica evidenzia una quota in Livello 1 (trattamento attivo) pari a ${pctL1txt}, profilo di rischio ${riskTxt}.

Il programma proposto è dimensionato su questi dati: il piano operativo e l'investimento sono riportati di seguito.`}

## Mappa Clinica della Popolazione

${mappa}

## Piano Operativo Proposto

${isPacchetto
  ? `Il percorso ${nomeProdotto || 'd\'ingresso'} (12 mesi) comprende il check-up completo della popolazione — già svolto —, la formazione collettiva su ergonomia e postura e la consulenza ergonomico-posturale sulle postazioni di lavoro. Il percorso non comprende trattamenti individuali: la stratificazione qui presentata fotografa lo stato della popolazione rilevato dal questionario.`
  : `Il piano prevede la presa in carico dei pazienti L1 distribuiti in turni di avvio mensili, con sportello osteopatico in sede. La formazione collettiva copre l'intera popolazione aziendale con moduli su ergonomia e postura.`}
${!isPacchetto && quoteBlock ? `
## Proposta economica collegata
${quoteBlock.replace('PROPOSTA ECONOMICA COLLEGATA (condizioni del colloquio + stratificazione reale):', 'Investimento calcolato con le condizioni concordate al colloquio e la stratificazione reale:')}` : ''}${sezioneComprende ? `

${sezioneComprende}` : ''}${isPacchetto && testoEvoluzione && !testoEvoluzione.startsWith('Segnaposto') ? `
## Evoluzione possibile
${testoEvoluzione}` : ''}
${isPacchetto ? `## Raccomandazioni

1. Condividere con la direzione la fotografia emersa dal check-up
2. Formazione focalizzata sulle zone di rischio prevalenti
3. Programmare il sopralluogo per confermare le postazioni di produzione
4. Rivalutare a fine percorso l'evoluzione più adatta al bisogno emerso

## Prossimi Passi

1. **Settimana 1-2**: Restituzione dei risultati del check-up alla direzione
2. **Mese 1**: Prima sessione formativa collettiva
3. **Mese 1-2**: Sopralluogo ergonomico e conferma delle postazioni
4. **Mese 2-3**: Completamento formazione e consulenza ergonomico-posturale
5. **Mese 11**: Valutazione dell'evoluzione del percorso (prosecuzione o chiusura)` : `## Raccomandazioni Cliniche

1. Priorità ai pazienti L1 con NRS > 6 e impatto funzionale documentato
2. Monitoraggio trimestrale L2 tramite mini-check digitale
3. Formazione ergonomia focalizzata sulle zone di rischio prevalenti
4. Review clinica a 3 mesi per valutare adeguamento del protocollo

## Prossimi Passi

1. **Settimana 1-2**: Completamento assegnazione turni e prima pre-validazione L1
2. **Mese 1**: Avvio sportello osteopatico — Turno 1
3. **Mese 2-3**: Avvio turni 2 e 3, prima sessione formativa collettiva
4. **Mese 3**: Mini-check T3 per pazienti L2
5. **Mese 6**: Review intermedia con report dati aggregati`}`;
}

// Blocco "proposta economica" per il report: condizioni della scheda colloquio
// applicate alla stratificazione REALE (solo prezzo cliente, mai margini).
// Esportata (solo lettura) anche per la baseline di regressione pricing v1/v2.
export async function buildQuoteBlock(client_id, client, answers) {
  try {
    const fm = await getFirstMeeting(client_id);
    const fmd = fm?.data;
    const snap = getForchettaSnapshot(fm);      // risolve anche la forbice conservata
    const usableSnap = snap && snap.forchetta;  // snapshot programma completo con forbice
    if (!fmd && !usableSnap) return { block: '', compliance: null };
    const s2 = fmd?.step2 || {};
    const sp = fmd?.params || {};
    const responders = (answers || []).length;
    const pricingVersion = client.pricing_version || 'v1';
    const nmq = aggregateNMQ(answers || []);

    // ── Precedenza: SNAPSHOT (promessa congelata) → LIVE (colloquio + config) ──
    // Prezzo reale coi parametri SNAPSHOTTATI, forbice = quella PERSISTITA.
    let source, nEmp, l2Mult, conditions, min, avg, max;
    if (usableSnap) {
      source = 'snapshot';
      const si = snap.inputs || {};
      nEmp = parseInt(si.n) || (parseInt(client.employees) || responders);
      l2Mult = si.l2Mult != null ? Number(si.l2Mult) : CONFIG.l2_multiplier_default;
      conditions = { pricingVersion, v2Params: snap.v2Params, ergonomia: si.ergonomia, tier: si.tier, groups: si.groups, rates: si.rates, vatExempt: si.vatExempt };
      min = snap.forchetta.min?.price_y1; avg = snap.forchetta.avg?.price_y1; max = snap.forchetta.max?.price_y1;
    } else {
      source = 'live';
      const cap = Math.max(1, parseInt(s2.capienza) || CONFIG.classroom_capacity_default);
      nEmp = parseInt(client.employees) || responders;
      const sedi = Array.isArray(s2.sedi) ? s2.sedi : [];
      const groups = s2.training_mode === 'accorpa'
        ? Math.max(1, Math.ceil(nEmp / cap))
        : (sedi.reduce((a, e) => a + Math.ceil((parseInt(e.employees) || 0) / cap), 0) || Math.max(1, Math.ceil(nEmp / cap)));
      const v2Params = pricingVersion === 'v2' ? (await getPricingSettingsV2()).params : null;
      // Lettura unica degli input del colloquio (lib/pricing/v2): stessi numeri della Stima.
      const ergonomiaV2 = pricingVersion === 'v2' ? ergonomiaDaColloquio(s2, nEmp) : undefined;
      conditions = { pricingVersion, v2Params, ergonomia: ergonomiaV2, tier: s2.tier || undefined, groups, rates: sp.rates || undefined, vatExempt: sp.vat_exempt };
      const sectorKey = fmd?.step1?.sector || (client.sector === 1 ? 'manufacturing' : 'services');
      l2Mult = sp.l2_mult != null ? Number(sp.l2_mult) : CONFIG.l2_multiplier_default;
      const fch = computeForchetta({ n: nEmp, sector: sectorKey, l2Mult, ...conditions });
      min = fch.min.price_y1; avg = fch.avg.price_y1; max = fch.max.price_y1;
    }

    // Reale OMOGENEO con la forbice: prevalenza L1 OSSERVATA × forza lavoro
    // (snapshottata se presente), L2 derivato, coi parametri della stessa fonte.
    const real = realL1L2FromAssessment({ l1Responders: nmq.level1.count, responders, employees: nEmp, l2Mult, pricingVersion, v2Params: conditions.v2Params });
    const calc = calculatePricing({ n: nEmp, l1: real.l1, l2: real.l2, ...conditions });
    if (!calc) return { block: '', compliance: null };

    const realPrice = calc.price_y1;
    const inRange = (min != null && max != null) ? (realPrice >= min && realPrice <= max) : null;
    // source: 'snapshot' = confronto contro la forbice promessa; 'live' = ricalcolata
    // (nessuna Stima emessa). pricing_version: mai confronti incrociati tra versioni.
    const compliance = { in_range: inRange, min, avg, max, real_price: realPrice, pricing_version: pricingVersion, source };
    // NB: nessun side-effect qui (buildQuoteBlock è usata anche dall'endpoint
    // read-only di regressione). Il freeze avviene nel handler del Report.

    const eur = v => v.toLocaleString('it-IT', { useGrouping: 'always' });
    // Testo CLIENTE: prezzo + framing positivo "in linea con la stima" se rientra.
    // MAI il flag grezzo dentro/fuori (resta dato interno persistito).
    const inLinea = inRange ? ', in linea con la Stima di investimento presentata al colloquio' : '';

    // PONTE rispondenti -> popolazione. Il prezzo NON si dimensiona sui soli
    // rispondenti: la prevalenza osservata viene riportata sull'intera forza
    // lavoro (stessa regola della forbice, vedi realL1L2FromAssessment). Senza
    // questa riga il documento dice "5 in Livello 1" e fattura per 8: numeri
    // entrambi giusti, ma il passaggio non era spiegato da nessuna parte.
    const obsPct = responders > 0 ? Math.round((nmq.level1.count / responders) * 100) : null;
    const rigaDimensionamento = (pricingVersion === 'v2' && obsPct != null && nEmp > responders)
      ? `\n- Dimensionamento: la quota in Livello 1 osservata sui ${responders} questionari (${obsPct}%) è riportata sull'intera popolazione di ${nEmp} dipendenti (${real.l1} persone attese), così il programma copre anche chi non ha compilato il questionario`
      : '';

    // ERGONOMIA: e' una voce PAGATA (fino a qui invisibile nel documento). Senza
    // questa riga il cliente paga la valutazione delle postazioni e nel report
    // non se ne parla — e l'AI e' arrivata a raccomandarla come cosa da valutare.
    // I conteggi arrivano dal MOTORE (calc.y1.ergonomia), non ricalcolati qui:
    // il documento descrive esattamente ciò che è stato messo nel prezzo.
    // Testo = voce 7 di Enrico ("In ufficio l'intervento è per persona; in produzione
    // per postazione tipo") + SOLO le voci davvero nel prezzo: nel test del lessico,
    // con 40 in ufficio e 0 addetti, l'AI aveva scritto "studio delle postazioni
    // d'ufficio e formazione degli addetti" — due cose che quel prezzo non contiene.
    const ergo = calc.y1 && calc.y1.ergonomia;
    const pezzi = ergo ? [
      ergo.nUfficio ? `in ufficio, per persona: ${ergo.nUfficio} dipendenti` : null,
      ergo.nPostazioni ? `in produzione, per postazione tipo: ${ergo.nPostazioni} postazioni` : null,
      ergo.nAddetti ? `formazione di ${ergo.nAddetti} addetti di reparto alla postura corretta sulla propria postazione` : null,
    ].filter(Boolean) : [];
    const rigaErgonomia = (ergo && ergo.sell > 0 && pezzi.length)
      ? `\n- Include la consulenza ergonomico-posturale — osservazione delle postazioni di lavoro e del gesto, con raccomandazioni di adeguamento e indicazioni personalizzate — ${pezzi.join('; ')}. È già compresa nell'investimento, non è un'attività da acquistare a parte. Non sostituisce la valutazione dei rischi ai sensi del D.Lgs. 81/2008, che resta di competenza del datore di lavoro e dell'RSPP.`
      : '';

    const block = `\nPROPOSTA ECONOMICA COLLEGATA (condizioni del colloquio + stratificazione reale):\n- Programma Anno 1: €${eur(realPrice)}${inLinea} (${calc.days_osteo_y1} giornate sportello, ${calc.training_sessions_y1} sessioni formative)\n- Anno 2 e successivi (indicativo): €${eur(calc.price_y2)}${rigaDimensionamento}${rigaErgonomia}`;
    return { block, compliance, calc };
  } catch {
    return { block: '', compliance: null };
  }
}

async function tryGeneratePdf(client, report_type, content_text, client_id) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const html = buildReportHtml({ client, report_type, content_text });
  const filename = `${report_type}_${client_id}_${Date.now()}.pdf`;
  const { url } = await generateAndStorePdf(html, filename, 'reports');
  await insertDocument({ client_id, type: report_type, file_url: url, content_text }).catch(() => {});
  return url;
}
