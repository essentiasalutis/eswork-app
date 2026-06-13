import { requireAuth } from '../../../../lib/auth';
import { updateDataRequest } from '../../../../lib/store';

const STATUSES = ['pending', 'processing', 'done', 'rejected'];

// PUT /api/admin/data-requests/[id] — il titolare processa una richiesta GDPR.
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).end();
  const { id } = req.query;
  const { status, response_note } = req.body || {};
  if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Stato non valido' });

  const fields = {};
  if (status) fields.status = status;
  if (response_note !== undefined) fields.response_note = response_note;
  if (status === 'done' || status === 'rejected') {
    fields.processed_at = new Date().toISOString();
    fields.processed_by = req.session?.email || 'admin';
  }

  try {
    const updated = await updateDataRequest(id, fields);
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
