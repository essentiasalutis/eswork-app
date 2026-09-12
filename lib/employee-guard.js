// ─────────────────────────────────────────────────────────────────────────────
// Limite di tentativi sul link personale del dipendente (care_token).
// Il token è una credenziale permanente che viaggia nell'indirizzo: da quando
// dietro quel link c'è anche lo storico clinico, il suo valore sale (Enrico, 12/9).
//
// LIMITE DICHIARATO, non venduto per più di quello che è: il contatore vive nella
// memoria della singola istanza serverless (stesso meccanismo del login). Frena chi
// martella da un punto solo; NON ferma un attacco distribuito. Il contatore robusto
// (in banca dati) è in lista, non è questo.
//
// Due chiavi: per token (protegge il singolo link) e per indirizzo di rete (protegge
// dal setaccio di molti token). La risposta è neutra: un 429 non dice se il token
// esista o meno.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import { checkRateLimit, getClientIp } from './rate-limit';

const FINESTRA_MS = 10 * 60 * 1000;
const MAX_PER_TOKEN = 30;
const MAX_PER_IP = 60;

// Il token non finisce mai nella chiave in chiaro, nemmeno in memoria.
const impronta = (t) => crypto.createHash('sha256').update(String(t || '')).digest('base64url').slice(0, 16);

// true = si può procedere. false = ha già risposto 429 (chi chiama si ferma).
export function limiteAreaPersonale(req, res, token) {
  const perToken = checkRateLimit(`emp:tok:${impronta(token)}`, MAX_PER_TOKEN, FINESTRA_MS);
  const perIp = checkRateLimit(`emp:ip:${getClientIp(req)}`, MAX_PER_IP, FINESTRA_MS);
  if (!perToken.ok || !perIp.ok) {
    res.status(429).json({ error: 'Troppe richieste. Riprova tra qualche minuto.' });
    return false;
  }
  return true;
}
