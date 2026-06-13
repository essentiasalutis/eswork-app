import { getProfessionalByEmail, logAccess } from '../../../../lib/store';
import { verifyPassword, setProSessionCookie } from '../../../../lib/pro-auth';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Max 8 tentativi per IP ogni 15 minuti
  const ip = getClientIp(req);
  const rl = checkRateLimit(`pro-login:${ip}`, 8, 15 * 60 * 1000);
  if (!rl.ok) {
    const waitMin = Math.ceil(rl.resetIn / 60000);
    return res.status(429).json({ error: `Troppi tentativi. Riprova tra ${waitMin} minuti.` });
  }

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Credenziali mancanti' });

  const pro = await getProfessionalByEmail(email);
  if (!pro) return res.status(401).json({ error: 'Credenziali non valide' });
  if (!pro.active) return res.status(403).json({ error: 'Account disattivato. Contatta Essentia Salutis.' });

  const ok = verifyPassword(password, pro.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenziali non valide' });

  await logAccess({ professional_id: pro.id, action: 'login', ip, user_agent: req.headers['user-agent'], details: `Login da ${email}` });

  setProSessionCookie(res, {
    role: 'professional',
    proId: pro.id,
    proName: pro.name,
    proEmail: pro.email,
    mustReset: pro.must_reset_password,
  });

  return res.json({
    id: pro.id,
    name: pro.name,
    email: pro.email,
    mustReset: pro.must_reset_password,
  });
}
