/**
 * Rate limiter in-memory — senza dipendenze esterne.
 * Funziona su Vercel (ogni serverless instance ha la sua memoria,
 * ma per il login è sufficiente: un attacco da una singola IP viene bloccato).
 */

const store = new Map(); // ip -> { count, resetAt }

/**
 * @param {string} key       — di solito l'IP del richiedente
 * @param {number} limit     — max tentativi
 * @param {number} windowMs  — finestra temporale in ms
 * @returns {{ ok: boolean, remaining: number, resetIn: number }}
 */
export function checkRateLimit(key, limit = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetIn: windowMs };
  }

  entry.count += 1;

  if (entry.count > limit) {
    return { ok: false, remaining: 0, resetIn: entry.resetAt - now };
  }

  return { ok: true, remaining: limit - entry.count, resetIn: entry.resetAt - now };
}

/** Estrae l'IP reale anche dietro proxy/Vercel */
export function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}
