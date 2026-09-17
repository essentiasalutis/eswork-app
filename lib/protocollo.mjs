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
  durata_prevalidazione_min: 15,    // videochiamata di pre-validazione clinica
  // Formazione collettiva: temi (moduli) per anno di programma e durata di ciascuno.
  formazione_moduli_primo_anno: 2,
  formazione_moduli_anni_successivi: 1,
  formazione_ore_modulo: 1,
  // Formazione dei neoassunti — contratto azienda, Art. 5-bis comma 5:
  recupero_finestra_mesi: 6,        // il recupero parte entro 6 mesi dall'ingresso del primo in coda…
  recupero_soglie: Object.freeze([  // …oppure quando la coda raggiunge la soglia della fascia
    Object.freeze({ max: 50, soglia: 5 }),
    Object.freeze({ max: 200, soglia: 10 }),
    Object.freeze({ max: Infinity, soglia: 20 }),
  ]),
});

// I parametri del Listino v2 che sono regole del protocollo: nel prezzo valgono
// SEMPRE questi, qualunque cosa sia salvata nella banca dati.
export const PARAMETRI_PROTOCOLLO_LISTINO = Object.freeze({
  sessions_per_l1: PROTOCOLLO.sedute_per_ciclo,
  session_duration_min: PROTOCOLLO.durata_seduta_min,
  prevention_sessions_per_l2: PROTOCOLLO.sessioni_prevenzione_l2,
  buffer_pct: PROTOCOLLO.buffer_pct,
  training_modules_y1: PROTOCOLLO.formazione_moduli_primo_anno,
  training_modules_y2: PROTOCOLLO.formazione_moduli_anni_successivi,
});

// Chiavi del Listino (numeriche o testuali) che sono regole del protocollo: non si
// salvano, non si leggono dalla banca dati, non si modificano da nessuna pagina.
export const CHIAVI_PROTOCOLLO_LISTINO = Object.freeze([
  ...Object.keys(PARAMETRI_PROTOCOLLO_LISTINO),
  'finestra_recupero_mesi',
  'soglia_recupero_fasce',
]);

export function eRegolaDelProtocollo(chiaveListino) {
  return CHIAVI_PROTOCOLLO_LISTINO.includes(chiaveListino);
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

// «due temi nel primo anno di programma e uno negli anni successivi»
export function fraseTemiFormazione() {
  const temi = (n) => (n === 1 ? 'un tema' : `${inLettere(n)} temi`);
  const dopo = PROTOCOLLO.formazione_moduli_anni_successivi;
  return `${temi(PROTOCOLLO.formazione_moduli_primo_anno)} nel primo anno di programma e ${dopo === 1 ? 'uno' : inLettere(dopo)} negli anni successivi`;
}

// Tempo richiesto a una persona nel primo anno di programma, in ore (Enrico, 17/9).
//   · in trattamento: pre-validazione + un ciclo di sedute + formazione del primo anno;
//   · in prevenzione: le sessioni di prevenzione + formazione del primo anno;
//   · tutti gli altri: la formazione del primo anno.
// Arrotondato PER ECCESSO all'ora: meglio promettere un po' più del tempo che si
// chiede che sembrare precisi e sbagliare per difetto.
export function oreRichiestePrimoAnno(p = PROTOCOLLO) {
  const formazione = p.formazione_moduli_primo_anno * p.formazione_ore_modulo;
  const trattamento = p.durata_prevalidazione_min / 60 + (p.sedute_per_ciclo * p.durata_seduta_min) / 60 + formazione;
  const prevenzione = (p.sessioni_prevenzione_l2 * p.durata_seduta_min) / 60 + formazione;
  return {
    trattamento: Math.ceil(trattamento),
    prevenzione: Math.ceil(prevenzione),
    altri: Math.ceil(formazione),
    esatte: { trattamento, prevenzione, altri: formazione },
  };
}

// «circa 5 ore nel primo anno di programma per chi è in trattamento, circa 4 per chi fa
// prevenzione, 2 ore per tutti gli altri» — testo di Enrico, numeri dal protocollo.
export function fraseTempoRichiesto({ maiuscola = false } = {}) {
  const o = oreRichiestePrimoAnno();
  const ore = (n) => `${n} ${n === 1 ? 'ora' : 'ore'}`;
  const t = `circa ${ore(o.trattamento)} nel primo anno di programma per chi è in trattamento, circa ${o.prevenzione} per chi fa prevenzione, ${ore(o.altri)} per tutti gli altri`;
  return maiuscola ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}
