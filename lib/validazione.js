import { dataIt } from './date-it.mjs';
// ─────────────────────────────────────────────────────────────────────────────
// Validazione registrata dei report (v60). Modulo PURO.
//
// Regola (Enrico, 12/9): un documento può dichiarare la validazione professionale
// SOLO se quella validazione è registrata. La riga non vive nel testo salvato — che
// resta la fotografia di ciò che è stato prodotto — ma viene aggiunta al momento in
// cui il documento si stampa o si genera in PDF, leggendo il record. Così il testo
// non può dire di essere validato se il registro non lo conferma.
//
// La riga dice chi e quando. Dal 12/9 non contiene formule come «che ne assume la
// responsabilità clinica».
//
// Cambiata il 18/9 (Enrico): chi valida si presenta con il suo RUOLO, «osteopata,
// responsabile clinico del programma». Il nome resta perché la responsabilità clinica
// è personale; il ruolo distingue chi risponde del metodo da chi eroga le sedute.
// È una dichiarazione di responsabilità clinica personale: vive SOLO qui, non in un
// pannello modificabile (tolta dal Listino, v72).
// ─────────────────────────────────────────────────────────────────────────────

export const VALIDATORE = 'Dott. Enrico Maiolo, osteopata, responsabile clinico del programma';
// Nome storico dell'esportazione, stesso valore.
export const VALIDATORE_DEFAULT = VALIDATORE;

export function isValidato(rec) {
  return !!(rec && rec.validato_da && rec.validato_il);
}

export function dataValidazione(rec) {
  if (!isValidato(rec)) return null;
  return dataIt(rec.validato_il, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function rigaValidazione(rec) {
  if (!isValidato(rec)) return null;
  // Virgola prima della data: il nome porta con sé il ruolo (18/9).
  return `Validato da ${rec.validato_da}, il ${dataValidazione(rec)}.`;
}

// Il testo come va stampato: contenuto salvato + riga di validazione, se c'è.
export function testoConValidazione(contentText, rec) {
  const riga = rigaValidazione(rec);
  return riga ? `${contentText || ''}\n\n*${riga}*` : (contentText || '');
}

// Nuovo stato del record dopo un gesto di validazione o di revoca. La sequenza degli
// eventi non si riscrive mai: si aggiunge in fondo.
export function applicaValidazione(rec, { azione, chi, quando } = {}) {
  const ora = quando || new Date().toISOString();
  const nome = (chi || VALIDATORE_DEFAULT).trim();
  const storico = Array.isArray(rec && rec.validazioni) ? rec.validazioni.slice() : [];
  if (azione === 'revoca') {
    if (!isValidato(rec)) return null;   // niente da revocare
    storico.push({ azione: 'revocato', chi: nome, quando: ora });
    return { validato_da: null, validato_il: null, validazioni: storico };
  }
  if (azione === 'valida') {
    if (isValidato(rec)) return null;    // già validato: nessun doppione
    storico.push({ azione: 'validato', chi: nome, quando: ora });
    return { validato_da: nome, validato_il: ora, validazioni: storico };
  }
  return null;
}
