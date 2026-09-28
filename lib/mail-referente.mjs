// ─────────────────────────────────────────────────────────────────────────────
// Le mail al referente dopo l'incontro (Enrico, 28/9). Modulo PURO.
// Due documenti, due mail: la presentazione del Report e la proposta di intervento.
// La mail la apre Enrico nella sua posta (mailto): l'allegato lo aggiunge lui, finché
// il dominio di invio non è verificato (punto «email» in pausa).
// ─────────────────────────────────────────────────────────────────────────────
import { CONFIG } from './config';
import { fraseValidita } from './offerta';
import { GIORNI_FIRMA_CONTRATTO } from './presentazione-testi.mjs';

export const FIRMA_MAIL = `Cordiali saluti,
Dott. Enrico Maiolo — founder @ Essentia Salutis
Tel: ${CONFIG.contact_phone}
${CONFIG.contact_email}`;

const saluto = (referente) => (referente ? `Gentile ${referente},` : 'Gentile referente,');
// «S.p.A.» non diventa «S.p.A..» (prova su Officine, 28/9).
const conPunto = (t) => `${t}${/\.$/.test(String(t)) ? '' : '.'}`;

// La presentazione dei risultati del check-up, con i numeri del Report di Attivazione.
export function mailPresentazione({ azienda, referente }) {
  return {
    oggetto: `Risultati del check-up ES Work — ${azienda}`,
    corpo: `${saluto(referente)}
grazie per il tempo che ci ha dedicato. Le invio in allegato la presentazione dei risultati del check-up di ${conPunto(azienda)}

Resto a disposizione per qualsiasi domanda.

${FIRMA_MAIL}`,
  };
}

// La proposta di intervento (Enrico, 28/9): niente elenco del programma, che è nel
// documento allegato e che ha appena presentato; importo, validità, come si accetta.
export function mailProposta({ azienda, referente, importo, iva, scadenza }) {
  return {
    oggetto: `Proposta di intervento ES Work — ${azienda}`,
    corpo: `${saluto(referente)}
grazie per il tempo che ci ha dedicato alla presentazione dei risultati del check-up. Le invio in allegato la proposta di intervento per ${conPunto(azienda)}

Investimento Anno 1: ${importo} (${iva})
${scadenza ? `${fraseValidita(scadenza)}\n` : ''}
Per procedere basta firmare l'accettazione in fondo al documento e rinviarcela; il contratto si firma poi entro ${GIORNI_FIRMA_CONTRATTO} giorni dall'accettazione.

Resto a disposizione per qualsiasi domanda.

${FIRMA_MAIL}`,
  };
}
