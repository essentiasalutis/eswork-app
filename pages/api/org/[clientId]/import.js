// POST /api/org/[clientId]/import → import lista dipendenti (solo admin).
// body: { lista: [{ nome, data_ingresso?, matricola?, straordinario? }] }
import { requireAuth } from '../../../../lib/auth';
import { importDipendenti } from '../../../../lib/org';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const lista = (req.body && req.body.lista) || [];
  if (!Array.isArray(lista)) return res.status(400).json({ error: 'lista non valida' });
  try { return res.json(await importDipendenti(req.query.clientId, lista)); }
  catch (e) { return res.status(500).json({ error: e.message }); }
});
