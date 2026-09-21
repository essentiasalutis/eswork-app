// GET /api/mc/[clientId]/report/[reportId] — lo stesso HTML del PDF dell'azienda.
import { requireMcAzienda } from '../../../../../lib/mc-auth';
import { reportHtmlPerMedico, registra } from '../../../../../lib/medico-competente-server';

export default requireMcAzienda(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const r = await reportHtmlPerMedico(req.clientId, req.query.reportId);
  await registra({ medicoId: req.medico.id, clientId: req.clientId, azione: 'report', dettaglio: String(req.query.reportId || '').slice(0, 80) + (r.html ? '' : ` — ${r.motivo}`), esito: r.html ? 'ok' : 'rifiutato', ip: req.headers['x-forwarded-for'] || null, userAgent: req.headers['user-agent'] });
  if (!r.html) return res.status(404).json({ error: 'Report non disponibile' });
  return res.json({ html: r.html });
});
