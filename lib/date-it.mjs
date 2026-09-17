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
