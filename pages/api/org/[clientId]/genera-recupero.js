// POST /api/org/[clientId]/genera-recupero → genera la sessione di recupero dalla
// coda corrente + le partecipazioni 'pianificata' (solo admin).
// body opzionale: { origine: 'recupero_autonomo' | 'campagna_aggiornamento' }
import { requireAuth } from '../../../../lib/auth';
import { generaSessioneRecupero } from '../../../../lib/org';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const today = new Date().toISOString().slice(0, 10);
  const origine = (req.body && req.body.origine) || 'recupero_autonomo';
  try {
    const r = await generaSessioneRecupero(req.query.clientId, { today, origine });
    if (!r.ok) return res.status(400).json(r);
    return res.json(r);
  } catch (e) { return res.status(500).json({ error: e.message }); }
});
