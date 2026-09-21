import { firma, verifica } from './firma-sessione.js';

const COOKIE = 'esw_session';

// Sessione dell'AMMINISTRATORE. Fino al 21/9 la verifica accettava qualunque
// sessione firmata con SESSION_SECRET — anche quella di un osteopata: copiata nel
// cookie esw_session apriva tutta l'amministrazione. Ora la sessione è firmata con
// la chiave del ruolo 'admin' (lib/firma-sessione.js): una sessione di un altro
// ruolo non passa per costruzione. In più deve portare l'email di amministrazione.
export function sessioneAdmin(session) {
  const admin = process.env.ADMIN_EMAIL;
  return !!(session && admin && session.role === 'admin' && session.email === admin);
}

export function verifyAdminToken(token) {
  const s = verifica('admin', token);
  return sessioneAdmin(s) ? s : null;
}

// Solo per l'emissione (login) e per le prove.
export function signAdminToken(dati) {
  return firma('admin', dati);
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
  const token = firma('admin', { ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
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
