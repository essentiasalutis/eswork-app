import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// FIRMA DELLE SESSIONI — una chiave per ruolo (Enrico, 21/9).
//
// Fino al 21/9 amministratore e osteopati firmavano con lo stesso segreto e lo
// stesso formato: una sessione da osteopata, copiata nel cookie dell'amministratore,
// apriva l'amministrazione. La difesa era un controllo del ruolo che una pagina nuova
// poteva dimenticare. Qui lo scambio è impossibile per costruzione: ogni ruolo firma
// con una chiave propria, e una sessione firmata per un ruolo non supera la verifica
// di un altro.
//
// Derivazione: chiave(ruolo) = HMAC-SHA256(SESSION_SECRET, "eswork-sessione-v1:" + ruolo).
// È una derivazione crittografica (l'HMAC è una funzione pseudocasuale): conoscere la
// chiave di un ruolo non dice nulla sulle altre né sul segreto. Non è una
// concatenazione di stringhe usata come chiave.
//
// Non si verifica una sessione senza dire di quale ruolo: non esiste una verifica
// generica. Il ruolo è anche scritto dentro la sessione e ricontrollato (seconda difesa).
// ─────────────────────────────────────────────────────────────────────────────

export const RUOLI = Object.freeze(['admin', 'professional', 'medico_competente']);
const ETICHETTA = 'eswork-sessione-v1:';

function segreto() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  // In produzione senza segreto non si firma e non si verifica nulla: prima si
  // ripiegava su un valore scritto nel codice, noto a chiunque lo legga.
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET mancante: nessuna sessione si firma né si verifica');
  return 'dev-secret';
}

function chiave(ruolo) {
  if (!RUOLI.includes(ruolo)) throw new Error(`Ruolo di sessione sconosciuto: ${ruolo}`);
  return crypto.createHmac('sha256', segreto()).update(ETICHETTA + ruolo).digest();
}

const b64 = buf => Buffer.from(buf).toString('base64url');

// Firma: il ruolo nella sessione è sempre quello della chiave, qualunque cosa ci sia nei dati.
export function firma(ruolo, dati) {
  const data = b64(JSON.stringify({ ...dati, role: ruolo }));
  const sig = crypto.createHmac('sha256', chiave(ruolo)).update(data).digest('base64url');
  return `${data}.${sig}`;
}

// Verifica per UN ruolo: firma con la chiave di quel ruolo, ruolo scritto dentro
// uguale, non scaduta. Altrimenti null. Confronto a tempo costante.
export function verifica(ruolo, token) {
  if (!token || typeof token !== 'string') return null;
  const parti = token.split('.');
  if (parti.length !== 2) return null;
  const [data, sig] = parti;
  let atteso;
  try { atteso = crypto.createHmac('sha256', chiave(ruolo)).update(data).digest(); }
  catch { return null; }
  let ricevuto;
  try { ricevuto = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (ricevuto.length !== atteso.length || !crypto.timingSafeEqual(ricevuto, atteso)) return null;
  try {
    const sessione = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!sessione || sessione.role !== ruolo) return null;
    // Scadenza obbligatoria: ogni sessione emessa la porta.
    if (!Number.isFinite(sessione.exp) || sessione.exp < Date.now()) return null;
    return sessione;
  } catch {
    return null;
  }
}
