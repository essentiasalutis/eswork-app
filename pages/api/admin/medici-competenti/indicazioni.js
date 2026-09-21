// /api/admin/medici-competenti/indicazioni — le indicazioni dei medici, visibili solo al
// coordinamento. La marcatura «non utilizzabile» resta visibile e non cancella nulla.
import { requireAuth } from '../../../../lib/auth';
import { indicazioniPerAzienda, marcaNonUtilizzabile } from '../../../../lib/medico-competente-server';

export default requireAuth(async function handler(req, res) {
  if (req.method === 'GET') return res.json({ indicazioni: await indicazioniPerAzienda(String(req.query.clientId || '')) });
  if (req.method !== 'POST') return res.status(405).end();
  const b = req.body || {};
  if (b.azione !== 'non_utilizzabile') return res.status(400).json({ error: 'Azione non valida' });
  const r = await marcaNonUtilizzabile({ indicazioneId: String(b.id || ''), admin: req.session.email, motivo: b.motivo });
  return r.ok ? res.json({ ok: true }) : res.status(400).json({ error: r.errore });
});
