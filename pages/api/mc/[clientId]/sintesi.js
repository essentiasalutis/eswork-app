// GET /api/mc/[clientId]/sintesi — Sintesi sanitaria: stessi dati e soglie dell'azienda,
// senza sezioni commerciali (lib/medico-competente-server.js).
import { requireMcAzienda } from '../../../../lib/mc-auth';
import { sintesiPerMedico, registra } from '../../../../lib/medico-competente-server';

export default requireMcAzienda(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const r = await sintesiPerMedico(req.clientId);
  await registra({ medicoId: req.medico.id, clientId: req.clientId, azione: 'sintesi', esito: r.html ? 'ok' : 'rifiutato', dettaglio: r.html ? null : r.motivo, ip: req.headers['x-forwarded-for'] || null, userAgent: req.headers['user-agent'] });
  return res.json({ html: r.html, motivo: r.html ? null : (r.trattenuto ? 'Documento non disponibile.' : r.motivo) });
});
