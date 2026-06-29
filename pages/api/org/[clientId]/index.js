// GET  /api/org/[clientId]  → stato organizzativo COMPLETO (nominativo) — SOLO ADMIN.
// PUT  /api/org/[clientId]  → aggiorna i parametri di programma dell'azienda.
// Nominativo: protetto da requireAuth (sessione admin). Nessun accesso non-admin.
import { requireAuth } from '../../../../lib/auth';
import { getStatoOrg, updateClientOrgParams } from '../../../../lib/org';

export default requireAuth(async function handler(req, res) {
  const { clientId } = req.query;
  if (req.method === 'GET') {
    const today = new Date().toISOString().slice(0, 10);
    const stato = await getStatoOrg(clientId, today).catch(() => null);
    if (!stato) return res.status(404).json({ error: 'Cliente non trovato' });
    return res.json(stato);
  }
  if (req.method === 'PUT') {
    try { return res.json(await updateClientOrgParams(clientId, req.body || {})); }
    catch (e) { return res.status(500).json({ error: e.message }); }
  }
  return res.status(405).end();
});
