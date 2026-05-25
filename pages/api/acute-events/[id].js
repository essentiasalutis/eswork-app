import { getSessionToken, verifyToken } from '../../../lib/auth';
import { updateAcuteEvent } from '../../../lib/store';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end();
  const token = getSessionToken(req);
  if (!token || !verifyToken(token)) return res.status(401).json({ error: 'Non autorizzato' });

  const { id } = req.query;
  const { status, contacted_at, resolved_at } = req.body;

  try {
    const fields = {};
    if (status) fields.status = status;
    if (contacted_at) fields.contacted_at = contacted_at;
    if (resolved_at) fields.resolved_at = resolved_at;

    const updated = await updateAcuteEvent(id, fields);
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
