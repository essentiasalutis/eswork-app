// POST /api/mc/auth/login — accesso del medico competente (chiave di sessione propria).
import { verifyPassword } from '../../../../lib/pro-auth';
import { setMcSessionCookie } from '../../../../lib/mc-auth';
import { medicoPerEmail, registra } from '../../../../lib/medico-competente-server';
import { checkRateLimit, getClientIp } from '../../../../lib/rate-limit';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const ip = getClientIp(req);
  const rl = checkRateLimit(`mc-login:${ip}`, 8, 15 * 60 * 1000);
  if (!rl.ok) return res.status(429).json({ error: `Troppi tentativi. Riprova tra ${Math.ceil(rl.resetIn / 60000)} minuti.` });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Credenziali mancanti' });
  const medico = await medicoPerEmail(email).catch(() => null);
  if (!medico) return res.status(401).json({ error: 'Credenziali non valide' });
  if (!medico.attivo || !verifyPassword(password, medico.password_hash)) {
    await registra({ medicoId: medico.id, azione: 'login', esito: 'rifiutato', dettaglio: medico.attivo ? 'password errata' : 'accesso disattivato', ip, userAgent: req.headers['user-agent'] });
    return res.status(medico.attivo ? 401 : 403).json({ error: medico.attivo ? 'Credenziali non valide' : 'Accesso disattivato. Contatta Essentia Salutis.' });
  }
  await registra({ medicoId: medico.id, azione: 'login', ip, userAgent: req.headers['user-agent'] });
  setMcSessionCookie(res, { medicoId: medico.id });
  return res.json({ ok: true, cambioPassword: !!medico.must_reset_password });
}
