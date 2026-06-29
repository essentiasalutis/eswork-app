// PUT /api/org/[clientId]/dipendenti/[id] → correzione/cessazione/straordinario
// (solo admin). Le correzioni ai dati di un ingresso sono esclusive dell'admin.
import { requireAuth } from '../../../../../lib/auth';
import { updateOrgDipendente } from '../../../../../lib/org';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).end();
  const { id } = req.query;
  const b = req.body || {};
  const allowed = ['nome', 'matricola', 'identificativo_hr', 'data_ingresso', 'data_cessazione', 'attivo', 'straordinario'];
  const patch = {};
  for (const k of allowed) if (k in b) patch[k] = b[k] === '' ? null : b[k];
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'nessun campo da aggiornare' });
  try { return res.json(await updateOrgDipendente(id, patch)); }
  catch (e) { return res.status(500).json({ error: e.message }); }
});
