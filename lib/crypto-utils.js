import crypto from 'crypto';

const SALT = process.env.SESSION_SECRET || 'eswork-default-salt';

/**
 * Anonimizza un IP per conformità GDPR.
 * Usa SHA-256 con salt — non reversibile, non tracciabile.
 */
export function hashIp(ip) {
  if (!ip || ip === 'unknown') return null;
  return crypto
    .createHmac('sha256', SALT)
    .update(ip)
    .digest('hex')
    .slice(0, 16); // 16 hex chars sufficienti per unicità pseudonima
}

/**
 * Hash SHA-256 del contenuto del documento firmato.
 * Serve come "impronta" del testo esatto al momento della firma.
 */
export function hashContent(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}
