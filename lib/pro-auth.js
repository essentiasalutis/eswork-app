import crypto from 'crypto';
import { firma, verifica } from './firma-sessione.js';
import supabase from './db';

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

// ─── Account ancora attivo? ────────────────────────────────────────────────────
// Disattivazione con effetto immediato (Enrico, 21/9). La firma del cookie dice chi
// è; la banca dati dice se può ancora entrare. Fino al 21/9 «Disattiva» fermava solo
// il login successivo: chi aveva già il cookie restava dentro fino a sette giorni,
// con accesso ai dati clinici. Ora un professionista disattivato o eliminato è fuori
// alla richiesta successiva. Se la lettura fallisce, non si entra.
async function statoAccount(proId) {
  if (!proId) return 'fuori';
  const { data, error } = await supabase.from('professionals').select('active').eq('id', proId).maybeSingle();
  if (error) {
    console.error(`[accesso professionista] verifica dell'account non riuscita: ${error.message}`);
    return 'non_verificabile';
  }
  return data && data.active === true ? 'attivo' : 'fuori';
}

// ─── Middleware ────────────────────────────────────────────────────────────────

export function requireProAuth(handler) {
  return async (req, res) => {
    const token = getProSessionToken(req);
    const session = verifyToken(token);
    if (!session || session.role !== 'professional') {
      return res.status(401).json({ error: 'Non autorizzato' });
    }
    const stato = await statoAccount(session.proId);
    if (stato === 'non_verificabile') {
      return res.status(503).json({ error: 'Verifica dell\'account non riuscita. Riprova tra poco.' });
    }
    if (stato !== 'attivo') {
      clearProSessionCookie(res);
      return res.status(401).json({ error: 'Account disattivato. Contatta Essentia Salutis.' });
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
    const stato = await statoAccount(session.proId);
    if (stato !== 'attivo') {
      // Disattivato o eliminato: il cookie non serve più. Se invece la verifica non è
      // riuscita, si torna al login senza toccarlo.
      if (stato === 'fuori') clearProSessionCookie(ctx.res);
      return { redirect: { destination: '/pro/login', permanent: false } };
    }
    ctx.req.proSession = session;
    return gssp(ctx);
  };
}
