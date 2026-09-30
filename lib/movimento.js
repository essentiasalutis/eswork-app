// ─────────────────────────────────────────────────────────────────────────────
// «I percorsi di trattamento» — la sezione del report a 3 mesi. Modulo PURO.
//
// Decisione di Enrico (30/9): il report a tre mesi monitora SOLO il Livello 1 partito
// dall'avvio del programma — i percorsi di trattamento avviati e, dopo tre mesi, quelli
// conclusi. Il resto (prevenzione, formazione, nuovi ingressi, distribuzione per livello)
// si vede a sei mesi, con il check-up di tutta la popolazione, e nel report annuale.
// Prima (12/9) questa sezione raccontava «il movimento» di tutto: prevenzione avviata,
// segnalazioni, nuovi ingressi e la distribuzione «di oggi».
//
// A tre mesi nessuno ricompila il questionario: la sezione parla solo di percorsi.
// Riservatezza: stessa soglia del resto (lib/kanon). Lo zero si pubblica: non identifica
// nessuno, e «nessun percorso avviato» serve.
// ─────────────────────────────────────────────────────────────────────────────
import { maskCount, K_ANON } from './kanon';
import { giornoIt, inizioGiornoIt, aggiungiAnni } from './date-it.mjs';

// Aggiunge mesi a un giorno di calendario (31/11 non esiste → 30/11).
function piuMesi(giorno, n) {
  const [y, m, d] = String(giorno).split('-').map(Number);
  const primo = new Date(Date.UTC(y, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(primo.getUTCFullYear(), primo.getUTCMonth() + 1, 0)).getUTCDate();
  return `${primo.toISOString().slice(0, 7)}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

// I «primi tre mesi» del report (30/9): dall'inizio dell'anno di programma ai tre mesi.
// Si prende l'ultimo anno i cui tre mesi sono già passati (un report rifatto dopo
// racconta ancora quei tre mesi, non tutto lo storico); se nessuno, il primo anno fino
// a oggi. Il primo anno è aperto all'indietro, come in lib/anno-programma.mjs.
// null senza data di avvio: si conta tutto, come prima.
export function finestraTreMesi(dataAvvio, adesso = new Date()) {
  if (typeof dataAvvio !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dataAvvio)) return null;
  const oggi = giornoIt(adesso);
  let n = 0;
  while (piuMesi(aggiungiAnni(dataAvvio, n + 1), 3) <= oggi) n += 1;
  const inizio = aggiungiAnni(dataAvvio, n);
  return {
    anno: n + 1,
    dal: n === 0 ? null : inizioGiornoIt(inizio).toISOString(),
    al: inizioGiornoIt(piuMesi(inizio, 3)).toISOString(),
  };
}

export function nellaFinestra(istante, f) {
  if (!f) return true;
  const t = Date.parse(istante);
  if (!Number.isFinite(t)) return false;
  return (!f.dal || t >= Date.parse(f.dal)) && t < Date.parse(f.al);
}

const VOCI = [
  { k: 'trattamentiAvviati', uno: 'percorso di trattamento avviato', molti: 'percorsi di trattamento avviati', zero: 'nessun percorso di trattamento avviato', nome: 'i percorsi avviati' },
  { k: 'trattamentiChiusi', uno: 'percorso concluso', molti: 'percorsi conclusi', zero: 'nessun percorso concluso', nome: 'i percorsi conclusi' },
];

export function sezioneMovimento({ movimenti, checkLabel = '3 mesi', anno = 1 } = {}) {
  const m = movimenti || {};
  const pubblicate = [];
  const soppresse = [];
  for (const v of VOCI) {
    const n = maskCount(m[v.k]);
    if (n === null) { soppresse.push(v.nome); continue; }       // 1..k-1
    pubblicate.push(n === 0 ? v.zero : `${n} ${n === 1 ? v.uno : v.molti}`);
  }
  const righe = [`## I percorsi di trattamento nei primi ${checkLabel}`, ''];
  const quando = anno > 1 ? `dall'inizio del ${anno}° anno di programma` : "dall'avvio del programma";
  if (pubblicate.length) righe.push(`Livello 1, ${quando}: ${pubblicate.join('; ')}.`);
  if (soppresse.length) {
    const testa = soppresse.join(' e ');
    righe.push(`${testa.charAt(0).toUpperCase()}${testa.slice(1)}: ${soppresse.length === 1 ? 'meno di' : 'ciascuno meno di'} ${K_ANON}, quindi non pubblicati per riservatezza.`);
  }
  righe.push('');
  righe.push('Il quadro di tutta la popolazione torna a sei mesi, con il check-up di tutti.');
  return righe.join('\n');
}

export const ANCORE_MOVIMENTO = ['## Documentazione degli interventi', '## Documentazione INAIL OT23', '## Documentazione INAIL', '## Raccomandazioni'];

// Inserisce la sezione prima delle raccomandazioni; in coda se non trova l'ancora.
export function inserisciMovimento(report, sezione) {
  if (!sezione) return report;
  for (const a of ANCORE_MOVIMENTO) {
    const i = report.indexOf(a);
    if (i !== -1) return `${report.slice(0, i)}${sezione}\n\n${report.slice(i)}`;
  }
  return `${report.trimEnd()}\n\n${sezione}`;
}
