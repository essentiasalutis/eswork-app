// ─────────────────────────────────────────────────────────────────────────────
// Testi della Presentazione del Report (revisione di Enrico, 27/9). Modulo PURO.
// Gli stessi testi vanno nell'Offerta e nella Sintesi: «deve essere tutto unico tra
// presentazione e preventivo» (Enrico, 27/9). I numeri vengono dal protocollo
// (lib/protocollo.mjs), mai scritti a mano.
// ─────────────────────────────────────────────────────────────────────────────
import { PROTOCOLLO, durataInMesi } from './protocollo.mjs';
import { isYmd, ilGiorno } from './checkup';
import { finoAl } from './offerta';

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
    { titolo: 'Livello 1 (dolore con impatto funzionale)', testo: `un ciclo di ${p.sedute_per_ciclo} trattamenti da ${p.durata_seduta_min} minuti entro ${durataInMesi(p.durata_max_ciclo_giorni)}, con misura del dolore prima e dopo ogni trattamento; fino a ${p.cicli_trattamento_per_anno} cicli nell'anno.` },
    { titolo: 'Livello 2 (segnali senza impatto)', testo: `${p.sessioni_prevenzione_l2} trattamenti di prevenzione nell'anno.` },
    { titolo: 'Tutti, compreso il Livello 3', testo: `${tutti}.` },
    { titolo: null, testo: '4 report nell\'anno (Attivazione, review a 3 e 6 mesi, annuale).' },
  ];
}

// Dall'accettazione dell'offerta alla firma del contratto: 15 giorni, per tutti, sempre
// (Enrico, 27/9). Un numero solo: slide, Offerta, Sintesi, mail.
export const GIORNI_FIRMA_CONTRATTO = 15;

// Ultima schermata e ultima pagina dell'Offerta: i prossimi passi (testo di Enrico,
// 27/9). Prima l'accettazione dell'offerta (la firma in fondo all'Offerta), poi il
// contratto entro 15 giorni. Chi ha già firmato parte dal calendario.
//   scadenzaOfferta: 'YYYY-MM-DD', la stessa data stampata in fondo all'Offerta.
const DOPO_IL_CONTRATTO = [
  'Calendario: date di sportello e formazione, spazio riservato, referente operativo.',
  'Comunicazione ai dipendenti, con il kit di avvio che vi prepariamo noi.',
  'Avvio: pre-validazioni, primi cicli e prevenzione, prima formazione.',
  'Review al mese 3 per chi è stato in Livello 1 al check-up; al mese 6 nuovo check-up di tutta la popolazione, per vedere l\'efficacia generale del programma; a fine anno check-up e Report annuale.',
];

const entroIl = (ymd) => (isYmd(ymd) ? `entro ${ilGiorno(ymd)} ${ymd.slice(0, 4)}` : '');

export function prossimiPassi({ firmato = false, scadenzaOfferta = null } = {}) {
  if (firmato) return DOPO_IL_CONTRATTO.slice();
  const entro = entroIl(scadenzaOfferta);
  return [
    `Accettazione dell'offerta: la firma in fondo all'Offerta${entro ? `, ${entro}` : ''}.`,
    `Firma del contratto, entro ${GIORNI_FIRMA_CONTRATTO} giorni dall'accettazione.`,
    ...DOPO_IL_CONTRATTO,
  ];
}

// Il prossimo passo in una riga (Sintesi, una pagina sola).
export function prossimoPassoInBreve({ firmato = false, scadenzaOfferta = null } = {}) {
  if (firmato) return 'Avvio del programma in sede secondo il calendario concordato.';
  const entro = entroIl(scadenzaOfferta);
  return `Accettazione dell'offerta${entro ? ` ${entro}` : ''}, poi firma del contratto entro ${GIORNI_FIRMA_CONTRATTO} giorni e avvio del programma.`;
}

// Accettazione in fondo all'Offerta — strada B scelta da Enrico (27/9): l'accettazione
// fissa le condizioni, il programma parte con il contratto. Chi firma scrive nome e
// ruolo; l'importo è nella frase, così la pagina firmata porta il prezzo anche da sola.
//   importo: già formattato («€5.576»); iva: la dicitura breve (lib/iva.mjs).
export function testoAccettazione({ importo, iva, scadenza } = {}) {
  return {
    dichiarazione: `dichiara di accettare integralmente la presente proposta di intervento ES Work, nei termini e alle condizioni indicate${importo ? `, per un investimento nel primo anno di ${importo}${iva ? ` (${iva})` : ''}` : ''}.`,
    condizioni: `L'accettazione fissa le condizioni di questa offerta per ${GIORNI_FIRMA_CONTRATTO} giorni: il programma si attiva con la firma del contratto entro questo termine.`,
    validita: isYmd(scadenza) ? `La presente offerta è valida ${finoAl(scadenza)}.` : '',
  };
}
