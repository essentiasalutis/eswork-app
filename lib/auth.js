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

// Sessione dell'AMMINISTRATORE (21/9). verifyToken da solo accetta qualunque
// sessione firmata con SESSION_SECRET — anche quella di un osteopata, firmata con
// lo stesso segreto e lo stesso formato (lib/pro-auth.js): copiata nel cookie
// esw_session apriva tutta l'amministrazione. Ora l'amministratore è SOLO chi ha
// l'email di amministrazione e nessun altro ruolo. Le sessioni emesse prima di
// oggi (senza «role») restano valide: hanno l'email giusta e nessun ruolo.
export function sessioneAdmin(session) {
  const admin = process.env.ADMIN_EMAIL;
  return !!(session && admin && session.email === admin && (session.role === undefined || session.role === 'admin'));
}

export function verifyAdminToken(token) {
  const s = verifyToken(token);
  return sessioneAdmin(s) ? s : null;
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
  const token = signToken({ ...payload, role: 'admin', exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${secure}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function requireAuth(handler) {
  return async (req, res) => {
    const token = getSessionToken(req);
    const session = verifyAdminToken(token);
    if (!session) return res.status(401).json({ error: 'Non autorizzato' });
    req.session = session;
    return handler(req, res);
  };
}

export function requireAuthSsr(gssp) {
  return async (ctx) => {
    const token = getSessionToken(ctx.req);
    const session = verifyAdminToken(token);
    if (!session) {
      return { redirect: { destination: '/', permanent: false } };
    }
    ctx.req.session = session;
    return gssp(ctx);
  };
}
