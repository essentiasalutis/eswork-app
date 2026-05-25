import { getSessionToken, verifyToken } from '../../../../lib/auth';
import { getBufferStatusByClient } from '../../../../lib/store';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const token = getSessionToken(req);
  if (!token || !verifyToken(token)) return res.status(401).json({ error: 'Non autorizzato' });
  try {
    const status = await getBufferStatusByClient(req.query.id);
    return res.json(status);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
