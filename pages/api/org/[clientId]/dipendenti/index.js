// POST /api/org/[clientId]/dipendenti → aggiunge un dipendente (admin) con dedup
// silenzioso → coda admin. Nominativo: SOLO ADMIN (requireAuth).
import { requireAuth } from '../../../../../lib/auth';
import { aggiungiDipendente } from '../../../../../lib/org';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { clientId } = req.query;
  const { nome, data_ingresso, matricola, identificativo_hr, straordinario } = req.body || {};
  if (!nome || !String(nome).trim()) return res.status(400).json({ error: 'nome obbligatorio' });
  try {
    return res.json(await aggiungiDipendente(clientId, { nome, data_ingresso, matricola, identificativo_hr, straordinario }));
  } catch (e) { return res.status(500).json({ error: e.message }); }
});
