import { clearSessionCookie } from '../../../lib/auth';

export default function handler(req, res) {
  clearSessionCookie(res);
  res.json({ ok: true });
}
