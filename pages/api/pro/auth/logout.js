import { clearProSessionCookie } from '../../../../lib/pro-auth';

export default function handler(req, res) {
  clearProSessionCookie(res);
  res.json({ ok: true });
}
