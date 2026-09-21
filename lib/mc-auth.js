// ─────────────────────────────────────────────────────────────────────────────
// Sessione del MEDICO COMPETENTE. Chiave di firma propria (lib/firma-sessione.js):
// una sessione del medico non vale come amministratore o osteopata, né il contrario.
// A OGNI richiesta si rilegge il medico dalla banca dati: disattivato = fuori, anche
// con una sessione ancora valida. Le aziende non stanno nella sessione: si
// ricontrollano a ogni richiesta (lib/medico-competente-server.js, relazioneAttiva).
// ─────────────────────────────────────────────────────────────────────────────
import { firma, verifica } from './firma-sessione.js';
import { RUOLO_MC } from './medico-competente.mjs';

const COOKIE = 'esw_mc_session';
const DURATA_ORE = 12;

export function getMcSessionToken(req) {
  const header = (req.headers && req.headers.cookie) || '';
  for (const parte of header.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === COOKIE) { try { return decodeURIComponent(v.join('=')); } catch { return null; } }
  }
  return null;
}

export function setMcSessionCookie(res, { medicoId }) {
  const token = firma(RUOLO_MC, { medicoId, exp: Date.now() + DURATA_ORE * 3600 * 1000 });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DURATA_ORE * 3600}${secure}`);
}

export function clearMcSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

// Sessione valida + medico attivo, oppure null.
export async function sessioneMedico(req) {
  const s = verifica(RUOLO_MC, getMcSessionToken(req));
  if (!s || !s.medicoId) return null;
  const { medicoAttivo } = await import('./medico-competente-server.js');
  const medico = await medicoAttivo(s.medicoId).catch(() => null);
  return medico ? { medico } : null;
}

// API: 401 senza sessione valida; 403 se deve ancora cambiare la password.
export function requireMcAuth(handler, { consentiCambioPassword = false } = {}) {
  return async (req, res) => {
    const s = await sessioneMedico(req);
    if (!s) return res.status(401).json({ error: 'Non autorizzato' });
    if (s.medico.must_reset_password && !consentiCambioPassword) return res.status(403).json({ error: 'Imposta una nuova password prima di continuare.', cambioPassword: true });
    req.medico = s.medico;
    return handler(req, res);
  };
}

export function requireMcAuthSsr(gssp, { consentiCambioPassword = false } = {}) {
  return async (ctx) => {
    const s = await sessioneMedico(ctx.req);
    if (!s) return { redirect: { destination: '/mc/login', permanent: false } };
    if (s.medico.must_reset_password && !consentiCambioPassword) return { redirect: { destination: '/mc/cambio-password', permanent: false } };
    ctx.req.medico = s.medico;
    return gssp(ctx);
  };
}

// API di un'azienda: sessione valida E relazione attiva con QUELL'azienda, riletta a
// ogni richiesta. Senza relazione: 404 (non si rivela se l'azienda esiste) e riga
// «rifiutato» nel registro.
export function requireMcAzienda(handler) {
  return requireMcAuth(async (req, res) => {
    const clientId = String(req.query.clientId || '');
    const { relazioneAttiva, registra } = await import('./medico-competente-server.js');
    const ok = await relazioneAttiva(req.medico.id, clientId).catch(() => false);
    if (!ok) {
      await registra({ medicoId: req.medico.id, clientId: /^[A-Za-z0-9_-]{1,80}$/.test(clientId) ? clientId : null, azione: 'accesso_azienda', dettaglio: req.url ? String(req.url).slice(0, 200) : null, esito: 'rifiutato', ip: req.headers['x-forwarded-for'] || null, userAgent: req.headers['user-agent'] });
      return res.status(404).json({ error: 'Non disponibile' });
    }
    req.clientId = clientId;
    return handler(req, res);
  });
}
