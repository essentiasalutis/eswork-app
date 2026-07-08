// POST /api/org/[clientId]/hr-token — genera/revoca il token HR (ADMIN only).
// body { action: 'genera' | 'revoca' }. 'genera' = nuovo token (rigenera se già
// esiste → chiude il vecchio link); 'revoca' = null (chiude l'accesso). Ritorna il
// token all'admin per costruire il link pubblico /hr/<token>.
import { requireAuth } from '../../../../lib/auth';
import { setHrToken } from '../../../../lib/org';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const action = (req.body && req.body.action) === 'revoca' ? 'revoca' : 'genera';
  try {
    const { token } = await setHrToken(req.query.clientId, action);
    return res.json({ ok: true, token }); // token=null dopo revoca
  } catch (e) { return res.status(500).json({ error: e.message }); }
});
