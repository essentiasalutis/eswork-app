import Anthropic from '@anthropic-ai/sdk';
import { requireAuth } from '../../../../lib/auth';
import {
  getClientById,
  getPatientsByClient,
  getResponsesForClient,
  getSessionsForClient,
  insertGeneratedReport,
  insertDocument,
} from '../../../../lib/store';
import { generateAndStorePdf, buildReportHtml } from '../../../../lib/pdf';

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
`.trim();

  // Fallback se manca la chiave
  if (!process.env.ANTHROPIC_API_KEY) {
    const fallback = generateFallbackReport(client, l1Count, l2Count, l3Count, totalPatients, sessions.length, sectorLabel);
    const rec = await insertGeneratedReport({ client_id: id, report_type: 'activation', content_text: fallback, created_by: 'system' }).catch(() => null);
    const pdfUrl = await tryGeneratePdf(client, 'activation', fallback, id).catch(() => null);
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
(coorti di presa in carico, sportelli, formazione collettiva — adatto al tier ${tierLabel})

## Raccomandazioni Cliniche
(3-5 raccomandazioni specifiche basate sui dati)

## Prossimi Passi
(5 step operativi con timeframe indicativo)

Tono: professionale, clinico, orientato ai dati. In italiano. Non più di 800 parole totali.`,
      }],
    });

    const report = message.content[0]?.text || '';
    const rec = await insertGeneratedReport({ client_id: id, report_type: 'activation', content_text: report, created_by: 'admin' }).catch(() => null);
    const pdfUrl = await tryGeneratePdf(client, 'activation', report, id).catch(() => null);
    return res.json({ report, source: 'ai', pdf_url: pdfUrl, report_id: rec?.id });
  } catch (e) {
    const fallback = generateFallbackReport(client, l1Count, l2Count, l3Count, totalPatients, sessions.length, sectorLabel);
    const rec = await insertGeneratedReport({ client_id: id, report_type: 'activation', content_text: fallback, created_by: 'system' }).catch(() => null);
    const pdfUrl = await tryGeneratePdf(client, 'activation', fallback, id).catch(() => null);
    return res.json({ report: fallback, source: 'fallback', error: e.message, pdf_url: pdfUrl, report_id: rec?.id });
  }
});

function generateFallbackReport(client, l1, l2, l3, total, sessioni, settore) {
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

Il piano prevede la presa in carico dei ${l1} pazienti L1 distribuiti in coorti mensili, con sportello osteopatico in sede. La formazione collettiva copre l'intera popolazione aziendale con moduli su ergonomia e postura.

## Raccomandazioni Cliniche

1. Priorità ai pazienti L1 con NRS > 6 e impatto funzionale documentato
2. Monitoraggio trimestrale L2 tramite mini-check digitale
3. Formazione ergonomia focalizzata sulle zone di rischio prevalenti
4. Review clinica a 3 mesi per valutare adeguamento del protocollo

## Prossimi Passi

1. **Settimana 1-2**: Completamento assegnazione coorti e prima pre-validazione L1
2. **Mese 1**: Avvio sportello osteopatico — Coorte 1
3. **Mese 2-3**: Avvio coorti 2 e 3, prima sessione formativa collettiva
4. **Mese 3**: Mini-check T3 per pazienti L2
5. **Mese 6**: Review intermedia con report dati aggregati`;
}

async function tryGeneratePdf(client, report_type, content_text, client_id) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const html = buildReportHtml({ client, report_type, content_text });
  const filename = `${report_type}_${client_id}_${Date.now()}.pdf`;
  const { url } = await generateAndStorePdf(html, filename, 'reports');
  await insertDocument({ client_id, type: report_type, file_url: url, content_text }).catch(() => {});
  return url;
}
