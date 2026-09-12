// POST /api/clients/[id]/reports/[reportId]/valida → { azione: 'valida' | 'revoca' }
//
// La validazione professionale di un report è un FATTO REGISTRATO (v60): chi e quando.
// Il testo salvato non si riscrive — la riga «Validato da … il …» viene aggiunta quando
// il documento si stampa — ma il PDF sì: è l'unico artefatto che esce dalla piattaforma,
// e se dicesse cose diverse dal registro il registro non servirebbe a niente (Enrico, 12/9).
import { requireAuth } from '../../../../../../lib/auth';
import { getClientById, getGeneratedReportById, updateGeneratedReport, insertDocument } from '../../../../../../lib/store';
import { generateAndStorePdf, buildReportHtml } from '../../../../../../lib/pdf';
import { getPricingSettingsV2 } from '../../../../../../lib/pricing/settings';
import { applicaValidazione, testoConValidazione, VALIDATORE_DEFAULT } from '../../../../../../lib/validazione';

export const config = { maxDuration: 60 };

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id, reportId } = req.query;
  const azione = (req.body || {}).azione;
  if (azione !== 'valida' && azione !== 'revoca') return res.status(400).json({ error: 'Azione non valida' });

  const rec = await getGeneratedReportById(reportId);
  if (!rec || rec.client_id !== id) return res.status(404).json({ error: 'Report non trovato' });

  let nome = VALIDATORE_DEFAULT;
  try { const { texts } = await getPricingSettingsV2(); if (texts && texts.validatore_nome) nome = texts.validatore_nome; } catch (_) {}

  const patch = applicaValidazione(rec, { azione, chi: nome });
  if (!patch) return res.status(409).json({ error: azione === 'valida' ? 'Report già validato' : 'Report non validato' });

  let aggiornato;
  try { aggiornato = await updateGeneratedReport(reportId, patch); }
  catch (e) { return res.status(500).json({ error: `Validazione non registrata (manca la migration v60?): ${e.message}` }); }

  // PDF allineato al registro: con la riga se validato, senza se revocato.
  let pdf_url = rec.pdf_url || null;
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const client = await getClientById(id);
      const testo = testoConValidazione(rec.content_text, aggiornato);
      const html = buildReportHtml({ client, report_type: rec.report_type, content_text: testo, checkpoint: rec.checkpoint });
      const { url } = await generateAndStorePdf(html, `${rec.report_type}_${id}_${Date.now()}.pdf`, 'reports');
      pdf_url = url;
      await updateGeneratedReport(reportId, { pdf_url }).catch(() => {});
      await insertDocument({ client_id: id, type: rec.report_type, file_url: url, content_text: testo }).catch(() => {});
    }
  } catch (e) {
    // La validazione è registrata comunque: lo dice la risposta, non si finge riuscito.
    return res.json({ ...aggiornato, pdf_url, pdfNonRigenerato: e.message });
  }
  return res.json({ ...aggiornato, pdf_url });
});
