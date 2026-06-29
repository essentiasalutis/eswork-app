// PUT /api/org/sessioni/[id] → gestione sessione (solo admin).
//  body { azione:'eroga', data_erogazione?, presenti:[dipendente_id] } → marca erogata,
//        presenti → 'svolta', non presenti restano 'da_recuperare'.
//  body { data_pianificata?|gruppo?|stato?|note? } → update semplice.
import { requireAuth } from '../../../../lib/auth';
import { markSessioneErogata, updateOrgSessione } from '../../../../lib/org';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).end();
  const { id } = req.query;
  const b = req.body || {};
  try {
    if (b.azione === 'eroga') {
      return res.json(await markSessioneErogata(id, { data_erogazione: b.data_erogazione, presentiDipendentiIds: b.presenti || [] }));
    }
    const allowed = ['data_pianificata', 'gruppo', 'stato', 'note', 'anno_programma'];
    const patch = {};
    for (const k of allowed) if (k in b) patch[k] = b[k] === '' ? null : b[k];
    return res.json(await updateOrgSessione(id, patch));
  } catch (e) { return res.status(500).json({ error: e.message }); }
});
