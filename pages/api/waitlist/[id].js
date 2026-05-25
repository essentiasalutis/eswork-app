import { requireAuth } from '../../../lib/auth';
import { updateWaitlistEntry } from '../../../lib/store';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PATCH') {
    const { cohort, status, notes } = req.body || {};
    const fields = {};
    if (cohort !== undefined) fields.cohort = cohort;
    if (status !== undefined) fields.status = status;
    if (notes !== undefined) fields.notes = notes;

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'Nessun campo da aggiornare' });
    }

    try {
      const updated = await updateWaitlistEntry(id, fields);
      return res.json({ ok: true, entry: updated });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).end();
});
