import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'dev-secret';
const COOKIE = 'esw_session';

export function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token) {
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

export function getSessionToken(req) {
  const header = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    header.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), decodeURIComponent(v.join('='))];
    })
  );
  return cookies[COOKIE];
}

export function setSessionCookie(res, payload) {
  const token = signToken({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${secure}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function requireAuth(handler) {
  return async (req, res) => {
    const token = getSessionToken(req);
    const session = verifyToken(token);
    if (!session) return res.status(401).json({ error: 'Non autorizzato' });
    req.session = session;
    return handler(req, res);
  };
}

export function requireAuthSsr(gssp) {
  return async (ctx) => {
    const token = getSessionToken(ctx.req);
    const session = verifyToken(token);
    if (!session) {
      return { redirect: { destination: '/', permanent: false } };
    }
    ctx.req.session = session;
    return gssp(ctx);
  };
}
