// GET /api/mc/[clientId]/report — i report di monitoraggio validati dell'azienda.
import { requireMcAzienda } from '../../../../../lib/mc-auth';
import { reportPerMedico, registra } from '../../../../../lib/medico-competente-server';

export default requireMcAzienda(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const report = await reportPerMedico(req.clientId);
  await registra({ medicoId: req.medico.id, clientId: req.clientId, azione: 'elenco_report', ip: req.headers['x-forwarded-for'] || null, userAgent: req.headers['user-agent'] });
  return res.json({ report });
});
