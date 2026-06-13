import { clearProSessionCookie, getProSession } from '../../../../lib/pro-auth';
import { logAccess } from '../../../../lib/store';
import { getClientIp } from '../../../../lib/rate-limit';

export default async function handler(req, res) {
  // Traccia il logout (se c'è una sessione valida) PRIMA di cancellare il cookie.
  const session = getProSession(req);
  if (session?.proId) {
    await logAccess({
      professional_id: session.proId,
      action: 'logout',
      ip: getClientIp(req),
      user_agent: req.headers['user-agent'],
      details: 'Logout',
    }).catch(() => {});
  }
  clearProSessionCookie(res);
  res.json({ ok: true });
}
