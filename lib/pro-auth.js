import crypto from 'crypto';
import { firma, verifica } from './firma-sessione.js';

// Sessioni degli osteopati: chiave del ruolo 'professional' (lib/firma-sessione.js),
// diversa da quella dell'amministratore e del medico competente (21/9).
const PRO_COOKIE = 'esw_pro_session';

// ─── Password hashing (scrypt) ─────────────────────────────────────────────────

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    const [salt, hash] = stored.split(':');
    const attempt = crypto.scryptSync(password, salt, 64).toString('hex');
    return attempt === hash;
  } catch {
    return false;
  }
}

// ─── Token: chiave del ruolo «professional» ───────────────────────────────────

function signToken(payload) {
  return firma('professional', payload);
}

function verifyToken(token) {
  return verifica('professional', token);
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

// Sessione pro verificata (o null) senza enforcing — utile es. al logout per
// loggare l'accesso prima di cancellare il cookie.
export function getProSession(req) {
  return verifyToken(getProSessionToken(req));
}

export function getProSessionToken(req) {
  const header = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    header.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), decodeURIComponent(v.join('='))];
    })
  );
  return cookies[PRO_COOKIE];
}

export function setProSessionCookie(res, payload) {
  const token = signToken({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }); // 7 giorni
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${PRO_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${secure}`
  );
}

export function clearProSessionCookie(res) {
  res.setHeader('Set-Cookie', `${PRO_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// ─── Middleware ────────────────────────────────────────────────────────────────

export function requireProAuth(handler) {
  return async (req, res) => {
    const token = getProSessionToken(req);
    const session = verifyToken(token);
    if (!session || session.role !== 'professional') {
      return res.status(401).json({ error: 'Non autorizzato' });
    }
    req.proSession = session;
    return handler(req, res);
  };
}

export function requireProAuthSsr(gssp) {
  return async (ctx) => {
    const token = getProSessionToken(ctx.req);
    const session = verifyToken(token);
    if (!session || session.role !== 'professional') {
      return { redirect: { destination: '/pro/login', permanent: false } };
    }
    ctx.req.proSession = session;
    return gssp(ctx);
  };
}
