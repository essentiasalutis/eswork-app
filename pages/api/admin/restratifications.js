import { getSessionToken, verifyToken } from '../../../lib/auth';
import { getAllRestratAlerts, updateRestratAlertStatus } from '../../../lib/store';

export default async function handler(req, res) {
  const token = getSessionToken(req);
  const session = verifyToken(token);
  if (!session) return res.status(401).json({ error: 'Non autorizzato' });

  if (req.method === 'GET') {
    try {
      const alerts = await getAllRestratAlerts();
      return res.json(alerts);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'PATCH') {
    const { id, status, notes } = req.body;
    if (!id || !status) return res.status(400).json({ error: 'id e status obbligatori' });
    try {
      const updated = await updateRestratAlertStatus(id, status, notes);
      return res.json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
}
