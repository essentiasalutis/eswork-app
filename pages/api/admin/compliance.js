import { requireAuth } from '../../../lib/auth';
import { datiConformita } from '../../../lib/conformita';

// GET /api/admin/compliance — { aziende, carta }: vedi lib/conformita.js
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    return res.json(await datiConformita());
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
