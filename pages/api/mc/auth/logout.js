import { clearMcSessionCookie } from '../../../../lib/mc-auth';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  clearMcSessionCookie(res);
  return res.json({ ok: true });
}
