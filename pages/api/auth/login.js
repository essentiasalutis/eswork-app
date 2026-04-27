import { setSessionCookie } from '../../../lib/auth';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password } = req.body || {};
  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    setSessionCookie(res, { email });
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Credenziali non valide' });
}
