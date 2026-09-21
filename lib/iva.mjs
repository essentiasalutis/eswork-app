// ─────────────────────────────────────────────────────────────────────────────
// DICITURA IVA — un solo punto del codice (Enrico, 21/9).
//
// Regime forfettario: le operazioni sono senza applicazione dell'IVA. Sostituisce
// «esente IVA ai sensi dell'art. 10, n. 18, DPR 633/72», che riguarda le prestazioni
// sanitarie e contraddice il contratto.
//
// Regole: compare UNA sola volta per documento, sul totale, mai sulle singole voci;
// solo nei documenti che portano un importo. Quando Essentia Salutis passerà a
// società si cambiano soltanto queste due righe, INSIEME (e, se servirà, l'aliquota
// sui totali): la dicitura dei documenti e quella breve delle email.
// ─────────────────────────────────────────────────────────────────────────────
export const DICITURA_IVA = 'Operazione senza applicazione dell\'IVA ai sensi dell\'art. 1, commi 54-89, L. 190/2014 — regime forfettario';
// Email con un importo (Stima, riepilogo, Offerta — Enrico, 21/9): breve, accanto
// all'importo, una volta per email. «Non applicata» e non «senza IVA», che nel
// linguaggio commerciale si legge come «IVA esclusa», cioè da aggiungere.
export const DICITURA_IVA_BREVE = 'IVA non applicata — regime forfettario';
