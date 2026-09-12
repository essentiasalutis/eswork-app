// ─────────────────────────────────────────────────────────────────────────────
// «Il movimento» — la sezione del report a 3 mesi. Modulo PURO.
//
// Decisione di Enrico (12/9): a tre mesi non si ri-somministra il questionario a
// nessuno — sarebbe fastidioso e il movimento è ancora poco. Il report racconta
// quindi COSA SI È MOSSO usando i dati che la piattaforma ha già: percorsi aperti e
// chiusi, sedute erogate, prevenzione avviata, segnalazioni spontanee, nuovi ingressi.
// La ri-fotografia vera, sulla stessa base del check-up iniziale, arriva a sei mesi.
//
// REGOLA CHE NON SI TOCCA: la distribuzione «di oggi» non deriva da un nuovo
// questionario, e il testo lo DICE. Senza quella frase il lettore crede di leggere
// una nuova rilevazione, e il confronto con la fotografia iniziale diventa una
// promessa che i dati non reggono.
//
// Riservatezza: stessa soglia del resto (lib/kanon). I gruppi piccoli non si
// pubblicano, nemmeno quando sarebbero ricavabili per differenza.
// ─────────────────────────────────────────────────────────────────────────────
import { kAnonPartition, maskCount, tooSmall, K_ANON, SUPPRESSED } from './kanon';

const nd = (v) => (v == null ? 'n.d.' : String(v));

// Conteggio singolo: sotto soglia non si pubblica.
function conta(n) {
  const m = maskCount(n);
  return m == null ? null : m;
}

// Distribuzione L1/L2/L3 pubblicabile (con soppressione secondaria).
export function distribuzionePubblicabile(l1, l2, l3) {
  const tot = (l1 || 0) + (l2 || 0) + (l3 || 0);
  if (tooSmall(tot)) return { pubblicabile: false, tot };
  const P = Object.fromEntries(
    kAnonPartition([{ key: 'l1', count: l1 || 0 }, { key: 'l2', count: l2 || 0 }, { key: 'l3', count: l3 || 0 }], tot)
      .map(c => [c.key, c]));
  const cella = k => (P[k].suppressed ? SUPPRESSED : `${P[k].count} (${P[k].pct}%)`);
  return { pubblicabile: true, tot, l1: cella('l1'), l2: cella('l2'), l3: cella('l3') };
}

// I movimenti si dividono in due: quelli che si possono pubblicare e quelli che
// stanno sotto la soglia di riservatezza. I secondi NON si buttano via — si dicono
// insieme, in una frase sola: una sfilza di «meno di 5» non si legge, e l'azienda
// ha comunque diritto di sapere che quel movimento c'è stato.
// Lo zero si pubblica: non identifica nessuno, e «nessun percorso avviato» serve.
const VOCI = [
  { k: 'trattamentiAvviati', uno: 'percorso di trattamento avviato', molti: 'percorsi di trattamento avviati', zero: 'nessun percorso di trattamento avviato', nome: 'i percorsi avviati' },
  { k: 'trattamentiChiusi', uno: 'percorso concluso', molti: 'percorsi conclusi', zero: 'nessun percorso concluso', nome: 'i percorsi conclusi' },
  { k: 'prevenzioneAvviata', uno: 'persona ha iniziato la prevenzione attiva', molti: 'persone hanno iniziato la prevenzione attiva', zero: 'nessuno ha iniziato la prevenzione attiva', nome: 'le persone entrate in prevenzione' },
  { k: 'segnalazioni', uno: 'persona ha segnalato un disturbo nuovo dalla propria area personale', molti: 'persone hanno segnalato un disturbo nuovo dalla propria area personale', zero: null, nome: 'le segnalazioni spontanee' },
  { k: 'nuoviIngressi', uno: 'nuovo ingresso ha compilato il check-up', molti: 'nuovi ingressi hanno compilato il check-up', zero: null, nome: 'i nuovi ingressi' },
];

function righeMovimento(m) {
  const pubblicate = [];
  const soppresse = [];
  if (m.seduteErogate > 0) pubblicate.push(`${m.seduteErogate} sedute erogate`);
  for (const v of VOCI) {
    const n = maskCount(m[v.k]);
    if (n === null) { soppresse.push(v.nome); continue; }       // 1..k-1
    if (n === 0) { if (v.zero) pubblicate.push(v.zero); continue; }
    pubblicate.push(`${n} ${n === 1 ? v.uno : v.molti}`);
  }
  return { pubblicate, soppresse };
}

function elenco(voci) {
  if (voci.length === 1) return voci[0];
  return `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}`;
}

export function sezioneMovimento({ inizio, attuale, movimenti, checkLabel = '3 mesi' } = {}) {
  const righe = [];
  righe.push(`## Il movimento dei primi ${checkLabel}`);
  righe.push('');

  if (inizio && inizio.n > 0 && !tooSmall(inizio.n)) {
    righe.push(`Alla partenza il check-up ha fotografato ${inizio.n} persone: ${inizio.l1pct}% in Livello 1, ${inizio.l2pct}% in Livello 2, ${inizio.l3pct}% in Livello 3.`);
  } else {
    righe.push('La fotografia di partenza non è pubblicabile: le risposte al check-up iniziale sono troppo poche perché i dati aggregati non identifichino le persone.');
  }
  righe.push('');

  const { pubblicate, soppresse } = righeMovimento(movimenti || {});
  if (pubblicate.length) righe.push(`In questi ${checkLabel}: ${pubblicate.join('; ')}.`);
  else if (!soppresse.length) righe.push(`In questi ${checkLabel} non risultano movimenti registrati sui percorsi.`);
  if (soppresse.length) {
    const testa = elenco(soppresse);
    righe.push(`${testa.charAt(0).toUpperCase()}${testa.slice(1)}: ${soppresse.length === 1 ? 'meno di' : 'ciascuno meno di'} ${K_ANON}, quindi non pubblicati per riservatezza.`);
  }
  righe.push('');

  const d = distribuzionePubblicabile(attuale?.l1, attuale?.l2, attuale?.l3);
  if (d.pubblicabile) {
    righe.push(`Oggi la popolazione seguita si distribuisce così: Livello 1 ${d.l1}, Livello 2 ${d.l2}, Livello 3 ${d.l3}.`);
  } else {
    righe.push(`La distribuzione per livello non è pubblicabile: il gruppo conta meno di ${K_ANON} persone.`);
  }
  righe.push('');
  righe.push('Questa distribuzione **non deriva da un nuovo questionario**: è lo stato aggiornato dei percorsi, così come risulta oggi. La prossima fotografia sulla stessa base del check-up iniziale è prevista a sei mesi, quando il questionario torna a tutta la popolazione.');

  return righe.join('\n');
}

export const ANCORE_MOVIMENTO = ['## Documentazione INAIL OT23', '## Documentazione INAIL', '## Raccomandazioni'];

// Inserisce la sezione prima delle raccomandazioni; in coda se non trova l'ancora.
export function inserisciMovimento(report, sezione) {
  if (!sezione) return report;
  for (const a of ANCORE_MOVIMENTO) {
    const i = report.indexOf(a);
    if (i !== -1) return `${report.slice(0, i)}${sezione}\n\n${report.slice(i)}`;
  }
  return `${report.trimEnd()}\n\n${sezione}`;
}

export { nd };
