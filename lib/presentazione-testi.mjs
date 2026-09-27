// ─────────────────────────────────────────────────────────────────────────────
// Testi della Presentazione del Report (revisione di Enrico, 27/9). Modulo PURO.
// I numeri vengono dal protocollo (lib/protocollo.mjs), mai scritti a mano.
// ─────────────────────────────────────────────────────────────────────────────
import { PROTOCOLLO } from './protocollo.mjs';

const mesi = (giorni) => (giorni % 30 === 0 ? `${giorni / 30} mesi` : `${giorni} giorni`);
const ore = (n) => (n === 1 ? 'da un\'ora' : `da ${n} ore`);

// «Il vostro programma nel primo anno»: cosa riceve ciascun livello (testo di Enrico).
// Al posto delle «giornate di sportello», che sono una misura interna.
//   ergonomia: l'analisi ergonomica è nel prezzo di questa azienda.
export function pianoPerLivello({ ergonomia = true } = {}) {
  const p = PROTOCOLLO;
  const tutti = [
    `${p.formazione_moduli_primo_anno} sessioni di formazione collettiva su postura ed ergonomia, ${ore(p.formazione_ore_modulo)}`,
    ergonomia ? 'analisi ergonomica delle postazioni di lavoro, con indicazioni pratiche e personalizzate' : null,
  ].filter(Boolean).join('; ');
  return [
    { titolo: 'Livello 1 (dolore con impatto funzionale)', testo: `un ciclo di ${p.sedute_per_ciclo} trattamenti da ${p.durata_seduta_min} minuti entro ${mesi(p.durata_max_ciclo_giorni)}, con misura del dolore prima e dopo ogni trattamento; fino a ${p.cicli_trattamento_per_anno} cicli nell'anno.` },
    { titolo: 'Livello 2 (segnali senza impatto)', testo: `${p.sessioni_prevenzione_l2} trattamenti di prevenzione nell'anno.` },
    { titolo: 'Tutti, compreso il Livello 3', testo: `${tutti}.` },
    { titolo: null, testo: '4 report nell\'anno (Attivazione, review a 3 e 6 mesi, annuale).' },
  ];
}

// Ultima schermata: i prossimi passi (testo di Enrico, 27/9). Chi ha già firmato parte
// dal calendario.
const PASSI = [
  'Firma del contratto.',
  'Calendario: date di sportello e formazione, spazio riservato, referente operativo.',
  'Comunicazione ai dipendenti, con il kit di avvio che vi prepariamo noi.',
  'Avvio: pre-validazioni, primi cicli e prevenzione, prima formazione.',
  'Review al mese 3 per chi è stato in Livello 1 al check-up; al mese 6 nuovo check-up di tutta la popolazione, per vedere l\'efficacia generale del programma; a fine anno check-up e Report annuale.',
];

export function prossimiPassi({ firmato = false } = {}) {
  return firmato ? PASSI.slice(1) : PASSI.slice();
}
