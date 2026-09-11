// PATCH /api/admin/comunicazioni/[id] — risposta STRUTTURATA di Essentia Salutis:
// stato (+ data programmata) e letto/non letto. Nessun testo libero verso l'HR.
import { requireAuth } from '../../../../lib/auth';
import { aggiornaComunicazione } from '../../../../lib/org';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end();
  const { stato, data_programmata, letta } = req.body || {};
  try {
    return res.json(await aggiornaComunicazione(req.query.id, { stato, data_programmata, letta }));
  } catch (e) {
    return res.status(e.code === 'INVALID' ? 422 : 500).json({ error: e.message });
  }
});
