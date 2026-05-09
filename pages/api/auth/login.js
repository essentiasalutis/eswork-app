import { setSessionCookie } from '../../../lib/auth';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Max 8 tentativi per IP ogni 15 minuti
  const ip = getClientIp(req);
  const rl = checkRateLimit(`admin-login:${ip}`, 8, 15 * 60 * 1000);
  if (!rl.ok) {
    const waitMin = Math.ceil(rl.resetIn / 60000);
    return res.status(429).json({ error: `Troppi tentativi. Riprova tra ${waitMin} minuti.` });
  }

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
