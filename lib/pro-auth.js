import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'dev-secret';
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

// ─── Token (same HMAC pattern as admin auth) ──────────────────────────────────

function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const [data, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
    if (sig !== expected) return null;
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (parsed.exp && parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

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
  const token = signToken({ ...payload, exp: Date.now() + 12 * 60 * 60 * 1000 }); // 12h
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${PRO_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${12 * 60 * 60}${secure}`
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
