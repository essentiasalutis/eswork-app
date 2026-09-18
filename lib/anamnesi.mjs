// ─────────────────────────────────────────────────────────────────────────────
// ANAMNESI — l'originale firmato non si riscrive. Modulo PURO (.mjs, testato).
//
// Fino al 18/9 «Modifica anamnesi» sovrascriveva il documento firmato (contenuto
// e data della firma) e l'esportazione mostrava il testo nuovo sotto la firma del
// paziente. Decisione di Enrico (18/9): la firma prova cosa ha dichiarato il
// paziente, le integrazioni provano cosa ha aggiunto il professionista, e le due
// cose non si mescolano mai. Finché le integrazioni (v71) non sono pronte, la
// modifica è BLOCCATA: meglio un pulsante spento che un documento clinico falsificato.
// ─────────────────────────────────────────────────────────────────────────────

export const MESSAGGIO_BLOCCO_ANAMNESI = 'L\'anamnesi firmata dal paziente non si può riscrivere: la firma copre quel testo. '
  + 'Le integrazioni dell\'osteopata, con data e motivo e senza toccare l\'originale, sono in preparazione.';

// Un'anamnesi c'è già (compilata o firmata): da qui in avanti non si sovrascrive.
export function anamnesiGiaCompilata(docs) {
  return (docs || []).some(d => d && d.type === 'anamnesi' && (d.status === 'completed' || d.status === 'signed'));
}
