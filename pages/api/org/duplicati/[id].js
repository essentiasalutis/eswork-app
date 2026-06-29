// PUT /api/org/duplicati/[id] → risolve una voce della coda duplicati (solo admin).
// body { azione: 'unisci' | 'distinto' }
//  'unisci'   → stessa persona: disattiva il record nuovo, tiene l'esistente.
//  'distinto' → persone diverse: chiude l'avviso.
import { requireAuth } from '../../../../lib/auth';
import { risolviDuplicato } from '../../../../lib/org';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).end();
  const azione = (req.body && req.body.azione) || 'distinto';
  try {
    const r = await risolviDuplicato(req.query.id, azione);
    if (!r) return res.status(404).json({ error: 'voce non trovata' });
    return res.json(r);
  } catch (e) { return res.status(500).json({ error: e.message }); }
});
