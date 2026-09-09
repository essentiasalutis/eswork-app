// ─────────────────────────────────────────────────────────────────────────────
// NRS (Numeric Rating Scale del dolore) — fonte unica di parsing e validazione.
//
// Regola operativa: una seduta NON si chiude senza NRS di inizio E di fine.
// Non è un capriccio di completezza: la "Riduzione del dolore" dei report di
// checkpoint è calcolata SOLO sulle sedute che hanno entrambi i valori
// (generate-checkpoint-report: `nrs_pre != null && nrs_post != null`). Con un
// solo estremo la seduta non entra nel KPI, e il report esce con "n.d." su
// quello che è il principale indicatore di efficacia del programma.
//
// Le sedute già chiuse in passato senza NRS restano com'erano: il vincolo vale
// al momento della CHIUSURA, non sulla modifica di una seduta storica.
// ─────────────────────────────────────────────────────────────────────────────

export const NRS_MIN = 0;
export const NRS_MAX = 10;

// null se assente/non valido; altrimenti intero dentro [NRS_MIN, NRS_MAX].
export function parseNrs(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  if (!Number.isInteger(n) || n < NRS_MIN || n > NRS_MAX) return null;
  return n;
}

// Ritorna il messaggio d'errore da mostrare, o null se si può chiudere.
export function validaNrsChiusura({ nrs_pre, nrs_post }) {
  const pre = parseNrs(nrs_pre);
  const post = parseNrs(nrs_post);
  if (pre === null && post === null) return `Registra l'NRS di inizio e di fine seduta (0-${NRS_MAX}) prima di chiudere`;
  if (pre === null) return `Registra l'NRS di inizio seduta (0-${NRS_MAX}) prima di chiudere`;
  if (post === null) return `Registra l'NRS di fine seduta (0-${NRS_MAX}) prima di chiudere`;
  return null;
}
