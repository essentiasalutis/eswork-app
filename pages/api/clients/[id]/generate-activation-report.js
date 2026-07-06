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
import { getPricingSettingsV2, getServiziDeliverable } from '../../../../lib/pricing/settings';
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
  const l1Count = patients.filter(p => p.level === 'level1').length;
  const l2Count = patients.filter(p => p.level === 'level2').length;
  const l3Count = patients.filter(p => p.level === 'level3').length;
  const optedOut = patients.filter(p => p.level_status === 'opted_out').length;

  const sectorLabel = client.sector === 1 ? 'Manifattura/Produzione' : 'Servizi/Uffici';
  const tier = client.tier || 'core';
  const tierLabel = tier === 'core' ? 'Core' : tier === 'plus' ? 'Plus' : 'Enterprise';

  // Rapporto col preventivo: condizioni della scheda colloquio + numeri REALI
  // della stratificazione (prezzo cliente; mai margini/costi nel report).
  // Array PIATTO di answers (stessa forma che usa offer.js via getResponsesByAssessment).
  const answers = Object.values((responses && responses.responses) || {}).flat();
  const { block: quoteBlock, compliance: quoteCompliance } = await buildQuoteBlock(id, client, answers);

  // ── v2: tabella servizi ("Cosa include il programma") + testi parametrici ──
  // SOLO listino v2: per i clienti v1 il report resta ESATTAMENTE quello attuale.
  const isV2 = (client.pricing_version || 'v1') === 'v2';
  const isPacchetto = isV2 && client.tipo_prodotto === 'pacchetto_prevenzione';
  let serviziBlock = '';
  let v2Texts = {};
  if (isV2) {
    try {
      const [{ texts }, servizi] = await Promise.all([
        getPricingSettingsV2(),
        getServiziDeliverable({ soloAttivi: true, configurazione: tier }),
      ]);
      v2Texts = texts || {};
      if (!isPacchetto && servizi.length) {
        serviziBlock = `\nCOSA INCLUDE IL PROGRAMMA (valori dichiarati per singola voce — NON sommarli, NON presentare MAI un totale, MAI "in omaggio"/"gratuito"):\n${servizi.map(s => `- ${s.voce}: €${Math.round(s.valore_dichiarato).toLocaleString('it-IT')}`).join('\n')}`;
      }
    } catch (_) {}
  }
  const nomeProdotto = isPacchetto
    ? (v2Texts.naming_cliente_pacchetto_prevenzione || 'Pacchetto Prevenzione')
    : (v2Texts.naming_cliente_programma_completo || 'Programma ES Work');
  const testoEvoluzione = v2Texts.testo_evoluzione_pacchetto || '';

  // NRS data da sessioni
  const sessionsWithNrs = sessions.filter(s => s.nrs_pre != null || s.nrs_post != null);
  const avgNrsPre = sessionsWithNrs.filter(s => s.nrs_pre != null).reduce((a, s) => a + s.nrs_pre, 0) / (sessionsWithNrs.filter(s => s.nrs_pre != null).length || 1);
  const avgNrsPost = sessionsWithNrs.filter(s => s.nrs_post != null).reduce((a, s) => a + s.nrs_post, 0) / (sessionsWithNrs.filter(s => s.nrs_post != null).length || 1);

  const dataBlock = `
CLIENTE: ${client.name}
Settore: ${sectorLabel}
Dipendenti totali: ${client.employees || 'n.d.'}
Tier: ${tierLabel}

STRATIFICAZIONE (${totalPatients} assessment completati):
${stratLines(l1Count, l2Count, l3Count, totalPatients)}

NOTA PRIVACY: dove un gruppo è "n.d." è stato soppresso per anonimato (k-anonymity, < ${K_ANON}). NON dedurre, stimare o ricostruire i valori soppressi.

SESSIONI EROGATE: ${sessions.length}
NRS medio pre-sessione: ${avgNrsPre.toFixed(1)}/10
NRS medio post-sessione: ${avgNrsPost.toFixed(1)}/10
Riduzione media NRS: ${(avgNrsPre - avgNrsPost).toFixed(1)} punti

PAZIENTI: ${totalPatients > 0 ? 'Assessment completati' : 'Nessun assessment ancora'}
${isPacchetto ? '' : quoteBlock}${serviziBlock}
`.trim();

  // Vincoli di wording per i documenti v2 (mai violarli nel testo generato).
  const vincoliV2 = isV2 ? `
VINCOLI TASSATIVI SUL TESTO:
- MAI presentare la somma dei valori delle voci ("Cosa include il programma") né affiancarla all'investimento.
- MAI espressioni come "in omaggio", "compreso gratuitamente", "gratis".
- MAI "AI" o "intelligenza artificiale" nel nome della piattaforma (si chiama solo "Piattaforma digitale ES Work").
- MAI i termini Core, Plus, Enterprise (nomi interni). Il prodotto si chiama "${nomeProdotto}".` : '';
  const istruzioniPacchetto = isPacchetto ? `
ATTENZIONE — PRODOTTO "${nomeProdotto}" (12 mesi, non rinnovabile): include SOLO assessment completo, formazione (2 moduli) e consulenza ergonomico-posturale. NON include trattamenti individuali, percorsi clinici o prevenzione attiva: NON presentarli MAI come inclusi.
La Mappa Clinica è una FOTOGRAFIA NEUTRA dei dati del questionario: MAI formulazioni come "non trattati", "non presi in carico", "sintomatologia non gestita", "richiedono trattamento/protocollo" o simili riferite a persone; nessun tono di allarme sanitario, nessuna pressione commerciale. Il programma completo va presentato SOLO come evoluzione disponibile, usando questo testo (adattalo senza stravolgerlo): "${testoEvoluzione}"` : '';

  // Fallback se manca la chiave
  if (!process.env.ANTHROPIC_API_KEY) {
    const fallback = generateFallbackReport(client, l1Count, l2Count, l3Count, totalPatients, sessions.length, sectorLabel, quoteBlock, { serviziBlock, isPacchetto, nomeProdotto, testoEvoluzione });
    const pdfUrl = await tryGeneratePdf(client, 'activation', fallback, id).catch(() => null);
    const rec = await insertGeneratedReport({ client_id: id, report_type: 'activation', content_text: fallback, created_by: 'system', pdf_url: pdfUrl, quote_compliance: quoteCompliance }).catch(() => null);
    return res.json({ report: fallback, source: 'fallback', pdf_url: pdfUrl, report_id: rec?.id });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
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
  ? `(SOLO le attività del pacchetto: assessment già svolto, formazione collettiva, consulenza ergonomico-posturale — NESSUN trattamento incluso)`
  : `(turni di presa in carico, sportelli, formazione collettiva — adatto al tier ${tierLabel}; se presente la PROPOSTA ECONOMICA COLLEGATA, citane l'investimento Anno 1 in chiusura)`}
${serviziBlock ? `
## Cosa include il programma
(elenca le voci con i rispettivi valori dichiarati, una per riga, SENZA totale)
` : ''}
## Raccomandazioni Cliniche
(3-5 raccomandazioni specifiche basate sui dati)

## Prossimi Passi
(5 step operativi con timeframe indicativo)
${vincoliV2}${istruzioniPacchetto}
Tono: professionale, clinico, orientato ai dati. In italiano. Non più di 800 parole totali.`,
      }],
    });

    const report = message.content[0]?.text || '';
    const pdfUrl = await tryGeneratePdf(client, 'activation', report, id).catch(() => null);
    const rec = await insertGeneratedReport({ client_id: id, report_type: 'activation', content_text: report, created_by: 'admin', pdf_url: pdfUrl, quote_compliance: quoteCompliance }).catch(() => null);
    return res.json({ report, source: 'ai', pdf_url: pdfUrl, report_id: rec?.id });
  } catch (e) {
    const fallback = generateFallbackReport(client, l1Count, l2Count, l3Count, totalPatients, sessions.length, sectorLabel, quoteBlock, { serviziBlock, isPacchetto, nomeProdotto, testoEvoluzione });
    const pdfUrl = await tryGeneratePdf(client, 'activation', fallback, id).catch(() => null);
    const rec = await insertGeneratedReport({ client_id: id, report_type: 'activation', content_text: fallback, created_by: 'system', pdf_url: pdfUrl, quote_compliance: quoteCompliance }).catch(() => null);
    return res.json({ report: fallback, source: 'fallback', error: e.message, pdf_url: pdfUrl, report_id: rec?.id });
  }
});

function generateFallbackReport(client, l1, l2, l3, total, sessioni, settore, quoteBlock, v2 = {}) {
  const { serviziBlock = '', isPacchetto = false, nomeProdotto = '', testoEvoluzione = '' } = v2;
  const small = tooSmall(total);
  const P = small ? null : Object.fromEntries(kAnonPartition([
    { key: 'l1', count: l1 }, { key: 'l2', count: l2 }, { key: 'l3', count: l3 },
  ], total).map(c => [c.key, c]));
  const dip = c => c.suppressed ? `n.d. (gruppo < ${K_ANON})` : `${c.count} dipendenti (${c.pct}%)`;
  const pctL1txt = small || P.l1.suppressed ? 'non pubblicata per anonimato' : `${P.l1.pct}%`;
  const riskTxt = small || P.l1.suppressed ? 'non determinabile in forma anonima' : (P.l1.pct > 20 ? 'elevato' : P.l1.pct > 10 ? 'moderato' : 'contenuto');
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
  ? `Il percorso ${nomeProdotto || 'd\'ingresso'} per **${client.name}** (${settore}, ${client.employees || 'n.d.'} dipendenti) ha completato l'assessment della popolazione con ${total} dipendenti valutati.

La fotografia raccolta indica una quota in Livello 1 pari a ${pctL1txt}: il dettaglio per livello è riportato nella Mappa Clinica.

Il percorso prosegue con le attività previste: formazione collettiva e consulenza ergonomico-posturale.`
  : `Il programma ES Work per **${client.name}** (${settore}, ${client.employees || 'n.d.'} dipendenti) ha completato la fase di assessment iniziale con ${total} dipendenti valutati.

La distribuzione clinica evidenzia una quota in Livello 1 (trattamento attivo) pari a ${pctL1txt}, profilo di rischio ${riskTxt}. Sono state erogate ${sessioni} sessioni osteopatiche ad oggi.

Il programma è operativamente attivo e i risultati preliminari confermano la pertinenza dell'intervento.`}

## Mappa Clinica della Popolazione

${mappa}

## Piano Operativo Proposto

${isPacchetto
  ? `Il percorso ${nomeProdotto || 'd\'ingresso'} (12 mesi) comprende l'assessment completo della popolazione — già svolto —, la formazione collettiva su ergonomia e postura e la consulenza ergonomico-posturale sulle postazioni di lavoro. Il percorso non comprende trattamenti individuali: la stratificazione qui presentata fotografa lo stato della popolazione rilevato dal questionario.`
  : `Il piano prevede la presa in carico dei pazienti L1 distribuiti in turni di avvio mensili, con sportello osteopatico in sede. La formazione collettiva copre l'intera popolazione aziendale con moduli su ergonomia e postura.`}
${!isPacchetto && quoteBlock ? `
## Proposta economica collegata
${quoteBlock.replace('PROPOSTA ECONOMICA COLLEGATA (condizioni del colloquio + stratificazione reale):', 'Investimento calcolato con le condizioni concordate al colloquio e la stratificazione reale:')}` : ''}${serviziBlock ? `
## Cosa include il programma
${serviziBlock.split('\n').filter(l => l.startsWith('- ')).join('\n')}` : ''}${isPacchetto && testoEvoluzione && !testoEvoluzione.startsWith('Segnaposto') ? `
## Evoluzione possibile
${testoEvoluzione}` : ''}
${isPacchetto ? `## Raccomandazioni

1. Condividere con la direzione la fotografia emersa dall'assessment
2. Formazione focalizzata sulle zone di rischio prevalenti
3. Programmare il sopralluogo per confermare le postazioni di produzione
4. Rivalutare a fine percorso l'evoluzione più adatta al bisogno emerso

## Prossimi Passi

1. **Settimana 1-2**: Restituzione dei risultati dell'assessment alla direzione
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
    if (!fmd) return { block: '', compliance: null };
    const s2 = fmd.step2 || {};
    const sp = fmd.params || {};
    const cap = Math.max(1, parseInt(s2.capienza) || CONFIG.classroom_capacity_default);
    const responders = (answers || []).length;
    const nEmp = parseInt(client.employees) || responders;
    const sedi = Array.isArray(s2.sedi) ? s2.sedi : [];
    const groups = s2.training_mode === 'accorpa'
      ? Math.max(1, Math.ceil(nEmp / cap))
      : (sedi.reduce((a, e) => a + Math.ceil((parseInt(e.employees) || 0) / cap), 0) || Math.max(1, Math.ceil(nEmp / cap)));
    // Versione listino dal record cliente (fail-safe v1): forbice e prezzo reale
    // escono SEMPRE dalla stessa versione → mai confronti incrociati tra versioni.
    const pricingVersion = client.pricing_version || 'v1';
    const v2Params = pricingVersion === 'v2' ? (await getPricingSettingsV2()).params : null;
    // Ergonomia: nel Report il conteggio postazioni è quello DEFINITIVO
    // (input admin aggiornato post-sopralluogo, scritto in step2 dal colloquio).
    const ergonomiaV2 = (s2.ergonomia_ufficio != null || s2.ergonomia_postazioni != null)
      ? { nUfficio: parseInt(s2.ergonomia_ufficio) || 0, nPostazioni: parseInt(s2.ergonomia_postazioni) || 0 }
      : undefined;
    const conditions = { pricingVersion, v2Params, ergonomia: ergonomiaV2, tier: s2.tier || undefined, groups, rates: sp.rates || undefined, vatExempt: sp.vat_exempt };
    const sectorKey = fmd.step1?.sector || (client.sector === 1 ? 'manufacturing' : 'services');
    const l2Mult = sp.l2_mult != null ? Number(sp.l2_mult) : CONFIG.l2_multiplier_default;

    // Reale OMOGENEO con la forbice (STESSA definizione del banner offer.js):
    // prevalenza L1 OSSERVATA dall'assessment × forza lavoro, L2 derivato
    // (L1 × moltiplicatore). Una sola definizione di "prezzo reale".
    const nmq = aggregateNMQ(answers || []);
    const real = realL1L2FromAssessment({ l1Responders: nmq.level1.count, responders, employees: nEmp, l2Mult, pricingVersion });
    const calc = calculatePricing({ n: nEmp, l1: real.l1, l2: real.l2, ...conditions });
    if (!calc) return { block: '', compliance: null };

    // Forbice del colloquio (SORGENTE UNICA) per il confronto dentro/fuori — dato
    // interno (solo admin): prova del rispetto del range concordato nella Lettera.
    const fch = computeForchetta({ n: nEmp, sector: sectorKey, l2Mult, ...conditions });
    const min = fch.min.price_y1, avg = fch.avg.price_y1, max = fch.max.price_y1;
    const realPrice = calc.price_y1;
    const inRange = (min != null && max != null) ? (realPrice >= min && realPrice <= max) : null;
    // pricing_version nel flag: prova che reale e forbice escono dalla STESSA
    // versione del listino (mai confronti incrociati).
    const compliance = { in_range: inRange, min, avg, max, real_price: realPrice, pricing_version: pricingVersion };

    const eur = v => v.toLocaleString('it-IT', { useGrouping: 'always' });
    // Testo CLIENTE: prezzo + framing positivo "in linea con la stima" se rientra.
    // MAI il flag grezzo dentro/fuori (resta dato interno persistito).
    const inLinea = inRange ? ', in linea con la stima presentata al colloquio' : '';
    const block = `\nPROPOSTA ECONOMICA COLLEGATA (condizioni del colloquio + stratificazione reale):\n- Programma Anno 1: €${eur(realPrice)}${inLinea} (${calc.days_osteo_y1} giornate sportello, ${calc.training_sessions_y1} sessioni formative)\n- Stima Anno 2+: €${eur(calc.price_y2)}`;
    return { block, compliance };
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
