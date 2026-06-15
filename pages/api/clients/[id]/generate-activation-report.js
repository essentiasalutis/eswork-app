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
${quoteBlock}
`.trim();

  // Fallback se manca la chiave
  if (!process.env.ANTHROPIC_API_KEY) {
    const fallback = generateFallbackReport(client, l1Count, l2Count, l3Count, totalPatients, sessions.length, sectorLabel, quoteBlock);
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
(turni di presa in carico, sportelli, formazione collettiva — adatto al tier ${tierLabel}; se presente la PROPOSTA ECONOMICA COLLEGATA, citane l'investimento Anno 1 in chiusura)

## Raccomandazioni Cliniche
(3-5 raccomandazioni specifiche basate sui dati)

## Prossimi Passi
(5 step operativi con timeframe indicativo)

Tono: professionale, clinico, orientato ai dati. In italiano. Non più di 800 parole totali.`,
      }],
    });

    const report = message.content[0]?.text || '';
    const pdfUrl = await tryGeneratePdf(client, 'activation', report, id).catch(() => null);
    const rec = await insertGeneratedReport({ client_id: id, report_type: 'activation', content_text: report, created_by: 'admin', pdf_url: pdfUrl, quote_compliance: quoteCompliance }).catch(() => null);
    return res.json({ report, source: 'ai', pdf_url: pdfUrl, report_id: rec?.id });
  } catch (e) {
    const fallback = generateFallbackReport(client, l1Count, l2Count, l3Count, totalPatients, sessions.length, sectorLabel, quoteBlock);
    const pdfUrl = await tryGeneratePdf(client, 'activation', fallback, id).catch(() => null);
    const rec = await insertGeneratedReport({ client_id: id, report_type: 'activation', content_text: fallback, created_by: 'system', pdf_url: pdfUrl, quote_compliance: quoteCompliance }).catch(() => null);
    return res.json({ report: fallback, source: 'fallback', error: e.message, pdf_url: pdfUrl, report_id: rec?.id });
  }
});

function generateFallbackReport(client, l1, l2, l3, total, sessioni, settore, quoteBlock) {
  const small = tooSmall(total);
  const P = small ? null : Object.fromEntries(kAnonPartition([
    { key: 'l1', count: l1 }, { key: 'l2', count: l2 }, { key: 'l3', count: l3 },
  ], total).map(c => [c.key, c]));
  const dip = c => c.suppressed ? `n.d. (gruppo < ${K_ANON})` : `${c.count} dipendenti (${c.pct}%)`;
  const pctL1txt = small || P.l1.suppressed ? 'non pubblicata per anonimato' : `${P.l1.pct}%`;
  const riskTxt = small || P.l1.suppressed ? 'non determinabile in forma anonima' : (P.l1.pct > 20 ? 'elevato' : P.l1.pct > 10 ? 'moderato' : 'contenuto');
  const mappa = small
    ? `La popolazione valutata è inferiore alla soglia minima di aggregazione (${K_ANON}): la distribuzione per livello non viene pubblicata a tutela dell'anonimato dei dipendenti (k-anonymity).`
    : `- **Livello 1 (Trattamento attivo):** ${dip(P.l1)} — dolore con impatto funzionale, richiedono protocollo individuale
- **Livello 2 (Monitoraggio):** ${dip(P.l2)} — sintomatologia presente, seguiti con mini-check periodici
- **Livello 3 (Prevenzione):** ${dip(P.l3)} — nessuna sintomatologia rilevante, inclusi nella formazione collettiva`;
  return `## Executive Summary

Il programma ES Work per **${client.name}** (${settore}, ${client.employees || 'n.d.'} dipendenti) ha completato la fase di assessment iniziale con ${total} dipendenti valutati.

La distribuzione clinica evidenzia una quota in Livello 1 (trattamento attivo) pari a ${pctL1txt}, profilo di rischio ${riskTxt}. Sono state erogate ${sessioni} sessioni osteopatiche ad oggi.

Il programma è operativamente attivo e i risultati preliminari confermano la pertinenza dell'intervento.

## Mappa Clinica della Popolazione

${mappa}

## Piano Operativo Proposto

Il piano prevede la presa in carico dei pazienti L1 distribuiti in turni di avvio mensili, con sportello osteopatico in sede. La formazione collettiva copre l'intera popolazione aziendale con moduli su ergonomia e postura.
${quoteBlock ? `
## Proposta economica collegata
${quoteBlock.replace('PROPOSTA ECONOMICA COLLEGATA (condizioni del colloquio + stratificazione reale):', 'Investimento calcolato con le condizioni concordate al colloquio e la stratificazione reale:')}` : ''}
## Raccomandazioni Cliniche

1. Priorità ai pazienti L1 con NRS > 6 e impatto funzionale documentato
2. Monitoraggio trimestrale L2 tramite mini-check digitale
3. Formazione ergonomia focalizzata sulle zone di rischio prevalenti
4. Review clinica a 3 mesi per valutare adeguamento del protocollo

## Prossimi Passi

1. **Settimana 1-2**: Completamento assegnazione turni e prima pre-validazione L1
2. **Mese 1**: Avvio sportello osteopatico — Turno 1
3. **Mese 2-3**: Avvio turni 2 e 3, prima sessione formativa collettiva
4. **Mese 3**: Mini-check T3 per pazienti L2
5. **Mese 6**: Review intermedia con report dati aggregati`;
}

// Blocco "proposta economica" per il report: condizioni della scheda colloquio
// applicate alla stratificazione REALE (solo prezzo cliente, mai margini).
async function buildQuoteBlock(client_id, client, answers) {
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
    const conditions = { tier: s2.tier || undefined, groups, rates: sp.rates || undefined, vatExempt: sp.vat_exempt };
    const sectorKey = fmd.step1?.sector || (client.sector === 1 ? 'manufacturing' : 'services');
    const l2Mult = sp.l2_mult != null ? Number(sp.l2_mult) : CONFIG.l2_multiplier_default;

    // Reale OMOGENEO con la forbice (STESSA definizione del banner offer.js):
    // prevalenza L1 OSSERVATA dall'assessment × forza lavoro, L2 derivato
    // (L1 × moltiplicatore). Una sola definizione di "prezzo reale".
    const nmq = aggregateNMQ(answers || []);
    const real = realL1L2FromAssessment({ l1Responders: nmq.level1.count, responders, employees: nEmp, l2Mult });
    const calc = calculatePricing({ n: nEmp, l1: real.l1, l2: real.l2, ...conditions });
    if (!calc) return { block: '', compliance: null };

    // Forbice del colloquio (SORGENTE UNICA) per il confronto dentro/fuori — dato
    // interno (solo admin): prova del rispetto del range concordato nella Lettera.
    const fch = computeForchetta({ n: nEmp, sector: sectorKey, l2Mult, ...conditions });
    const min = fch.min.price_y1, avg = fch.avg.price_y1, max = fch.max.price_y1;
    const realPrice = calc.price_y1;
    const inRange = (min != null && max != null) ? (realPrice >= min && realPrice <= max) : null;
    const compliance = { in_range: inRange, min, avg, max, real_price: realPrice };

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
