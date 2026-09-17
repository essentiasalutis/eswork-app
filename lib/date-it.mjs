// ─────────────────────────────────────────────────────────────────────────────
// DATE IN ORA ITALIANA — un solo punto. Modulo PURO (.mjs, testato).
//
// Il server gira in UTC. Una data formattata senza fuso, tra mezzanotte e le 2
// italiane, esce come il GIORNO PRIMA: è successo il 17/9 con il check-up creato
// dopo la mezzanotte del 14 (il server scriveva 13/09). In un documento soggetto a
// conservazione decennale — esportazione della cartella, report, documenti
// firmati, registro accessi — un giorno sbagliato non è un dettaglio (Enrico).
//
// Regola: ogni data mostrata passa da qui. Le opzioni di formato restano quelle di
// chi chiama; il fuso è sempre Europe/Rome e non si può cambiare.
// ─────────────────────────────────────────────────────────────────────────────

export const FUSO = 'Europe/Rome';
const SOLO_GIORNO = /^\d{4}-\d{2}-\d{2}$/;

// Un giorno di calendario ('AAAA-MM-GG') resta quel giorno: lo si legge a mezzogiorno
// UTC, che in Italia è sempre lo stesso giorno. Un istante resta un istante.
function comeData(valore) {
  if (valore == null || valore === '') return null;
  if (valore instanceof Date) return Number.isNaN(valore.getTime()) ? null : valore;
  if (typeof valore === 'string' && SOLO_GIORNO.test(valore)) return new Date(`${valore}T12:00:00Z`);
  const d = new Date(valore);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Solo la data. Senza opzioni: 14/09/2026.
export function dataIt(valore, opzioni = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  const d = comeData(valore);
  return d ? d.toLocaleDateString('it-IT', { ...opzioni, timeZone: FUSO }) : '';
}

// Data e ora. Senza opzioni: 14/09/2026, 00:30:12.
export function dataOraIt(valore, opzioni = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) {
  const d = comeData(valore);
  return d ? d.toLocaleString('it-IT', { ...opzioni, timeZone: FUSO }) : '';
}

// Il giorno italiano di un istante, 'AAAA-MM-GG' (per salvare o confrontare giorni).
export function giornoIt(valore = new Date()) {
  const d = comeData(valore);
  return d ? new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d) : null;
}

// Scarto di Roma rispetto a UTC in un istante, in minuti (+60 inverno, +120 estate).
function scartoRoma(istante) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(istante).map(x => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(istante.getTime() / 1000) * 1000) / 60000;
}

// L'istante in cui inizia un giorno italiano ('AAAA-MM-GG' → mezzanotte a Roma).
export function inizioGiornoIt(giorno) {
  const [y, m, d] = String(giorno).split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  let t = utc - scartoRoma(new Date(utc)) * 60000;
  const s2 = scartoRoma(new Date(t));
  t = utc - s2 * 60000;
  return new Date(t);
}

// Aggiunge anni a un giorno di calendario (29/2 negli anni non bisestili → 1/3).
export function aggiungiAnni(giorno, n) {
  const [y, m, d] = String(giorno).split('-').map(Number);
  return new Date(Date.UTC(y + n, m - 1, d)).toISOString().slice(0, 10);
}
