// ─────────────────────────────────────────────────────────────────────────────
// INDIRIZZO DEL SITO — un solo punto. Modulo PURO (.mjs, testato).
//
// Due casi, due fonti:
//   · una PAGINA aperta: l'indirizzo è quello della richiesta (chi guarda la pagina
//     la sta usando da lì). Nessuna variabile da tenere allineata, e server e
//     browser disegnano lo stesso link.
//   · una EMAIL (cron, notifiche): non c'è una pagina aperta, serve la variabile
//     NEXT_PUBLIC_BASE_URL. Qui si rifiuta un valore palesemente sbagliato,
//     dicendo quale valore si è trovato e quale si aspettava.
//
// Perché (17/9): in produzione la variabile conteneva l'indirizzo di Supabase,
// copiato per sbaglio. La pagina di conformità non ha mai funzionato, la scheda
// azienda si correggeva solo ridisegnandosi nel browser, e ogni email con un link
// sarebbe partita con un link rotto.
// NB: le variabili NEXT_PUBLIC_ entrano nel codice alla build: dopo averle
// cambiate su Vercel serve un nuovo deploy.
// ─────────────────────────────────────────────────────────────────────────────

export const INDIRIZZO_PREDEFINITO = 'https://eswork-app.vercel.app';
const ATTESO = `l'indirizzo pubblico del sito, in https e senza percorso (per esempio ${INDIRIZZO_PREDEFINITO})`;

const locale = (host) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);

// Indirizzo della richiesta di una pagina (dietro Vercel: x-forwarded-*).
export function indirizzoDallaRichiesta(headers = {}) {
  const host = headers['x-forwarded-host'] || headers.host;
  if (!host) return INDIRIZZO_PREDEFINITO;
  const primo = String(host).split(',')[0].trim();
  const proto = String(headers['x-forwarded-proto'] || (locale(primo) ? 'http' : 'https')).split(',')[0].trim();
  return `${proto}://${primo}`;
}

// Indirizzo per i link nelle email. Ritorna { ok:true, indirizzo } oppure
// { ok:false, errore } con il valore trovato e quello atteso.
export function indirizzoPerEmail(env = {}) {
  const grezzo = env.NEXT_PUBLIC_BASE_URL;
  if (grezzo == null || String(grezzo).trim() === '') {
    return { ok: true, indirizzo: INDIRIZZO_PREDEFINITO, predefinito: true };
  }
  const valore = String(grezzo).trim();
  const rifiuta = (perche) => ({
    ok: false,
    valore,
    errore: `Email non inviata: NEXT_PUBLIC_BASE_URL vale «${valore}» — ${perche}. Atteso ${ATTESO}. Correggi la variabile su Vercel e rifai il deploy.`,
  });

  let u;
  try { u = new URL(valore); } catch (_) { return rifiuta('non è un indirizzo valido'); }
  const produzione = env.VERCEL_ENV === 'production';

  if (/(^|\.)supabase\.(co|in|com)$/i.test(u.hostname)) return rifiuta('è l\'indirizzo di Supabase, non quello del sito');
  if (locale(u.host)) {
    if (produzione) return rifiuta('è un indirizzo locale, in produzione i link non si aprirebbero');
  } else if (u.protocol !== 'https:') {
    return rifiuta('non è in https');
  }
  if ((u.pathname && u.pathname !== '/') || u.search || u.hash) return rifiuta('contiene un percorso: serve solo l\'indirizzo del sito');
  return { ok: true, indirizzo: `${u.protocol}//${u.host}` };
}
