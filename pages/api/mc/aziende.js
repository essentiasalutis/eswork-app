// GET /api/mc/aziende — le aziende assegnate (solo il nome).
import { requireMcAuth } from '../../../lib/mc-auth';
import { aziendeDelMedico, registra } from '../../../lib/medico-competente-server';

export default requireMcAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const aziende = await aziendeDelMedico(req.medico.id);
  await registra({ medicoId: req.medico.id, azione: 'elenco_aziende', ip: req.headers['x-forwarded-for'] || null, userAgent: req.headers['user-agent'] });
  return res.json({ medico: { nome: req.medico.nome }, aziende });
});
