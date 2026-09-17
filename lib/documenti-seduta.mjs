// ─────────────────────────────────────────────────────────────────────────────
// NESSUNA SEDUTA SENZA DOCUMENTI — regola unica, usata dall'API delle sedute
// (blocco vero) e dalla cartella (che la mostra). Modulo PURO (.mjs, testato).
//
// Decisione di Enrico (17/9): ogni seduta, di trattamento (L1) o di prevenzione
// (L2), richiede consenso al trattamento, informativa estesa e anamnesi. Prima il
// blocco esisteva solo nella pagina: l'API registrava una seduta senza consenso.
//
// Un consenso vale solo se è legato a una versione dell'ARCHIVIO (v64): lo scrive
// il server, e solo dopo averlo accettato. Uno stato «firmato» senza testo
// d'archivio non conta — così nessuno stato intermedio fa risultare il paziente
// a posto (vale anche per la copia su carta, che il server accetta o rifiuta).
// ─────────────────────────────────────────────────────────────────────────────

export const DOCUMENTI_PER_SEDUTA = ['consent_treatment', 'privacy_extended', 'anamnesi'];

export function documentoValido(d) {
  if (!d) return false;
  if (d.type === 'anamnesi') return d.status === 'completed';
  return d.status === 'signed' && !!d.testo_legale_id;
}

export function documentiMancanti(docs) {
  const elenco = Array.isArray(docs) ? docs : [];
  return DOCUMENTI_PER_SEDUTA.filter(t => !documentoValido(elenco.find(d => d && d.type === t)));
}

// Chi ha un percorso che prevede sedute: L1 (trattamento) e L2 con diritto alla
// prevenzione. A loro la cartella mostra la sezione documenti.
export function prevedeSedute(patient) {
  if (!patient) return false;
  return patient.level === 'level1' || (patient.level === 'level2' && !!patient.prevention_eligible);
}
