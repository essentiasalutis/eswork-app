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
import { calculatePricing } from '../../../../lib/calculator';
import { CONFIG } from '../../../../lib/config';

export const config = { maxDuration: 60 };

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
  const quoteBlock = await buildQuoteBlock(id, client, totalPatients, l1Count, l2Count);

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
- Livello 1 (trattamento): ${l1Count} (${totalPatients > 0 ? Math.round(l1Count/totalPatients*100) : 0}%)
- Livello 2 (monitoraggio): ${l2Count} (${totalPatients > 0 ? Math.round(l2Count/totalPatients*100) : 0}%)
- Livello 3 (prevenzione): ${l3Count} (${totalPatients > 0 ? Math.round(l3Count/totalPatients*100) : 0}%)

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
    const rec = await insertGeneratedReport({ client_id: id, report_type: 'activation', content_text: fallback, created_by: 'system', pdf_url: pdfUrl }).catch(() => null);
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
    const rec = await insertGeneratedReport({ client_id: id, report_type: 'activation', content_text: report, created_by: 'admin', pdf_url: pdfUrl }).catch(() => null);
    return res.json({ report, source: 'ai', pdf_url: pdfUrl, report_id: rec?.id });
  } catch (e) {
    const fallback = generateFallbackReport(client, l1Count, l2Count, l3Count, totalPatients, sessions.length, sectorLabel, quoteBlock);
    const pdfUrl = await tryGeneratePdf(client, 'activation', fallback, id).catch(() => null);
    const rec = await insertGeneratedReport({ client_id: id, report_type: 'activation', content_text: fallback, created_by: 'system', pdf_url: pdfUrl }).catch(() => null);
    return res.json({ report: fallback, source: 'fallback', error: e.message, pdf_url: pdfUrl, report_id: rec?.id });
  }
});

function generateFallbackReport(client, l1, l2, l3, total, sessioni, settore, quoteBlock) {
  const pctL1 = total > 0 ? Math.round(l1/total*100) : 0;
  return `## Executive Summary

Il programma ES Work per **${client.name}** (${settore}, ${client.employees || 'n.d.'} dipendenti) ha completato la fase di assessment iniziale con ${total} dipendenti valutati.

La distribuzione clinica evidenzia ${pctL1}% di dipendenti in Livello 1 (trattamento attivo), indicando un profilo di rischio ${pctL1 > 20 ? 'elevato' : pctL1 > 10 ? 'moderato' : 'contenuto'} per la popolazione aziendale. Sono state erogate ${sessioni} sessioni osteopatiche ad oggi.

Il programma è operativamente attivo e i risultati preliminari confermano la pertinenza dell'intervento.

## Mappa Clinica della Popolazione

- **Livello 1 (Trattamento attivo):** ${l1} dipendenti — dolore con impatto funzionale, richiedono protocollo individuale
- **Livello 2 (Monitoraggio):** ${l2} dipendenti — sintomatologia presente, seguiti con mini-check periodici
- **Livello 3 (Prevenzione):** ${l3} dipendenti — nessuna sintomatologia rilevante, inclusi nella formazione collettiva

## Piano Operativo Proposto

Il piano prevede la presa in carico dei ${l1} pazienti L1 distribuiti in turni di avvio mensili, con sportello osteopatico in sede. La formazione collettiva copre l'intera popolazione aziendale con moduli su ergonomia e postura.
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
async function buildQuoteBlock(client_id, client, totalPatients, l1Count, l2Count) {
  try {
    const fm = await getFirstMeeting(client_id);
    const fmd = fm?.data;
    if (!fmd) return '';
    const s2 = fmd.step2 || {};
    const sp = fmd.params || {};
    const cap = Math.max(1, parseInt(s2.capienza) || CONFIG.classroom_capacity_default);
    const nEmp = parseInt(client.employees) || totalPatients;
    const sedi = Array.isArray(s2.sedi) ? s2.sedi : [];
    const groups = s2.training_mode === 'accorpa'
      ? Math.max(1, Math.ceil(nEmp / cap))
      : (sedi.reduce((a, e) => a + Math.ceil((parseInt(e.employees) || 0) / cap), 0) || Math.max(1, Math.ceil(nEmp / cap)));
    const calc = calculatePricing({ n: nEmp, l1: l1Count, l2: l2Count, tier: s2.tier || undefined, groups, rates: sp.rates || undefined, vatExempt: sp.vat_exempt });
    if (!calc) return '';
    const eur = v => v.toLocaleString('it-IT', { useGrouping: 'always' });
    return `\nPROPOSTA ECONOMICA COLLEGATA (condizioni del colloquio + stratificazione reale):\n- Programma Anno 1: €${eur(calc.price_y1)} (${calc.days_osteo_y1} giornate sportello, ${calc.training_sessions_y1} sessioni formative)\n- Stima Anno 2+: €${eur(calc.price_y2)}`;
  } catch {
    return '';
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
