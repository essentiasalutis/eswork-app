// ─────────────────────────────────────────────────────────────────────────────
// Anno 2 e successivi — le frasi al cliente, in un solo posto (Offerta e Presentazione).
// Modulo PURO.
//
// Il calcolo (lib/pricing/v2.js): l'Anno 2 ha gli stessi cicli e la stessa prevenzione
// dell'Anno 1 sui numeri di oggi, la formazione passa ai moduli degli anni successivi,
// l'analisi ergonomica non c'è più (è fatta nel primo anno), la regia resta.
// Quindi l'Anno 2 costa meno dell'Anno 1 pieno. Può costare di più dell'Anno 1 proposto
// solo se il primo anno è tenuto dentro la forbice di una Stima registrata (tetto) o
// scontato: la frase lo dice solo quando è vero (Enrico, 27/9).
// ─────────────────────────────────────────────────────────────────────────────
import { PROTOCOLLO, inLettere } from './protocollo.mjs';

const moduli = (n) => (n === 1 ? 'un modulo' : `${inLettere(n)} moduli`);

// Cosa ricevono nell'Anno 2 (testo approvato da Enrico il 27/9). Si nomina solo ciò
// che è davvero nel prezzo dell'Anno 2: senza persone in Livello 2 (o sul listino v1
// Core) la prevenzione non c'è, e la frase non la promette.
const nelPrezzo = (calc, voce) => !calc || !calc.y2 || !calc.y2[voce] || calc.y2[voce].sell > 0;
export function contenutoAnno2(calc) {
  const parti = [
    nelPrezzo(calc, 'sportello') ? 'i cicli per chi ne avrà bisogno' : null,
    nelPrezzo(calc, 'prevention') ? 'la prevenzione individuale' : null,
    `${moduli(PROTOCOLLO.formazione_moduli_anni_successivi)} di formazione`,
  ].filter(Boolean);
  return `Comprende ${parti.join(', ')} e la regia del programma.`;
}

// Perché l'Anno 2 costa meno dell'Anno 1: il motivo vero del calcolo.
export function fraseRiduzioneAnno2(calc) {
  const ergo = !!(calc && calc.y1 && calc.y1.ergonomia && calc.y1.ergonomia.sell > 0);
  const formazione = `la formazione passa a ${moduli(PROTOCOLLO.formazione_moduli_anni_successivi)}`;
  return `Si riduce rispetto all'Anno 1 perché ${ergo ? `l'analisi ergonomica è già fatta e ${formazione}` : formazione}.`;
}

// Primo anno tenuto nella forbice della Stima registrata (testo approvato da Enrico, 27/9).
export const FRASE_ANNO2_CON_TETTO = 'Nel primo anno l\'investimento resta entro la Stima presentata al colloquio; dal secondo vale il prezzo del programma sul dimensionamento di oggi, che si ricalcola con il check-up a 12 mesi.';

// La spiegazione per la schermata del preventivo: contenuto + il motivo, solo se vero.
//   conTetto: il prezzo dell'Anno 1 è stato abbassato al massimo della Stima registrata.
export function spiegazioneAnno2({ calc, conTetto = false } = {}) {
  if (!calc) return '';
  const motivo = conTetto && calc.price_y2 > calc.price_y1
    ? FRASE_ANNO2_CON_TETTO
    : calc.price_y2 < calc.price_y1 ? fraseRiduzioneAnno2(calc) : '';
  return [contenutoAnno2(calc), motivo].filter(Boolean).join(' ');
}
