// ─────────────────────────────────────────────────────────────────────────────
// PROTOCOLLO — FONTE UNICA delle regole cliniche e contrattuali. Modulo PURO (.mjs).
//
// Decisione di Enrico (17/9): «ciò che vendo, ciò che scrivo e ciò che la
// piattaforma consente sono lo stesso numero». Queste regole sono contrattuali:
// vivono QUI, con i test, e non si modificano da nessun pannello. Le leggono:
//   · la piattaforma (cartella, avvio dei cicli, sedute, auto-segnalazioni, capacità);
//   · il prezzo (Listino v2: parametri non modificabili, mostrati come regola);
//   · i testi al cliente, che interpolano i numeri da qui e non li scrivono a mano.
//
// Il buffer è contrattuale: definisce quanti percorsi l'azienda ha pagato ed è nel
// Report che il cliente firma. Un buffer modificabile cambierebbe la capacità di
// un'azienda che ha già firmato.
//
// Cambiare un valore qui cambia tutto insieme: prezzo, testi e limiti. Per questo
// si fa solo con una decisione, un commit e i test aggiornati.
// ─────────────────────────────────────────────────────────────────────────────

export const PROTOCOLLO = Object.freeze({
  sedute_per_ciclo: 4,              // ciclo di trattamento (Livello 1)
  durata_seduta_min: 30,            // minuti per seduta o sessione
  sessioni_prevenzione_l2: 4,       // prevenzione attiva per Livello 2, per anno di programma
  cicli_trattamento_per_anno: 2,    // per persona, per anno di programma
  cicli_prevenzione_per_anno: 1,    // per persona, per anno di programma
  giorni_tra_cicli: 60,             // distanza minima tra la fine di un ciclo e l'inizio del successivo
  autosegnalazioni_per_anno: 2,     // per dipendente, per anno di programma
  buffer_pct: 0.20,                 // percorsi pagati = Livello 1 a contratto × (1 + buffer)
});

// I parametri del Listino v2 che sono regole del protocollo: nel prezzo valgono
// SEMPRE questi, qualunque cosa sia salvata nella banca dati.
export const PARAMETRI_PROTOCOLLO_LISTINO = Object.freeze({
  sessions_per_l1: PROTOCOLLO.sedute_per_ciclo,
  session_duration_min: PROTOCOLLO.durata_seduta_min,
  prevention_sessions_per_l2: PROTOCOLLO.sessioni_prevenzione_l2,
  buffer_pct: PROTOCOLLO.buffer_pct,
});

export function eRegolaDelProtocollo(chiaveListino) {
  return Object.prototype.hasOwnProperty.call(PARAMETRI_PROTOCOLLO_LISTINO, chiaveListino);
}

// Sovrascrive i parametri del listino con le regole del protocollo.
export function conProtocollo(parametri) {
  return { ...(parametri || {}), ...PARAMETRI_PROTOCOLLO_LISTINO };
}

// Numeri in lettere per le frasi («fino a due cicli l'anno»).
const LETTERE = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'];
export function inLettere(n, { maiuscola = false } = {}) {
  const t = Number.isInteger(n) && n >= 0 && n < LETTERE.length ? LETTERE[n] : String(n);
  return maiuscola ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// 0.2 → «20%»
export function percento(x) {
  return `${Math.round(x * 100)}%`;
}
