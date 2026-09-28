// ─────────────────────────────────────────────────────────────────────────────
// «La fotografia a sei mesi» — sezione deterministica del report T6. Modulo PURO.
//
// Decisione di Enrico (12/9): a sei mesi il questionario torna a TUTTA la popolazione,
// così la fotografia è confrontabile con quella di partenza. È l'unico confronto che
// regge: stesse domande, stessa definizione di livello ai due capi.
//
// Tre onestà che il testo non può perdere:
//  · il confronto si fa su PERCENTUALI, mai su conteggi grezzi: chi risponde a sei
//    mesi non è mai esattamente chi ha risposto all'inizio;
//  · se risponde meno del 70% della popolazione iniziale, il confronto è INDICATIVO
//    e il testo lo dice (stessa soglia del report annuale);
//  · sotto la soglia di riservatezza non si pubblica nulla, a nessuno dei due capi.
// ─────────────────────────────────────────────────────────────────────────────
import { tooSmall, K_ANON, kAnonPartition, livelliLeggibili, nomeCella, maskCount, NOTA_LIVELLI_UNITI } from './kanon';

// Livelli sotto soglia UNITI in un solo dato, come in tutti gli altri documenti (Enrico,
// 27/9 «ovunque, presente e futuro»; 28/9 anche a 6 e 12 mesi). null = nessun livello
// mostrabile da solo. `s` = stratificazioneOsservata (n, l1, l2, l3).
export function distribuzioneLeggibile(s) {
  const n = (s && s.n) || 0;
  const L = livelliLeggibili(kAnonPartition([
    { key: 'l1', count: s.l1 }, { key: 'l2', count: s.l2 }, { key: 'l3', count: s.l3 },
  ], n), n);
  if (L.nessunaDistribuzione) return null;
  return { testo: L.celle.map(c => `${nomeCella(c)} ${c.pct}%`).join(', '), unite: !!L.unite };
}

// Il confronto della quota in Livello 1 regge solo se il Livello 1 ha almeno k persone
// in tutti e due i momenti; altrimenti si dice perché non si mostra (Enrico, 28/9).
export const L1_NON_CONFRONTABILE = `Il confronto della quota in Livello 1 non si mostra: in uno dei due momenti il Livello 1 conta meno di ${K_ANON} persone.`;
export const l1Confrontabile = (a, b) => maskCount(a && a.l1) != null && maskCount(b && b.l1) != null;

export const COORTE_MIN = 0.70;

export function rappresentativa(nT0, nT6, minimo = COORTE_MIN) {
  if (!nT0 || !nT6) return false;
  return (nT6 / nT0) >= minimo;
}

function verso(delta) {
  if (delta > 0) return `scende di ${delta} ${delta === 1 ? 'punto' : 'punti'}`;
  if (delta < 0) return `sale di ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'punto' : 'punti'}`;
  return 'resta invariata';
}

export function sezioneRifotografia({ t0, t6, pgic } = {}) {
  const righe = ['## La fotografia a sei mesi', ''];

  const nT0 = (t0 && t0.n) || 0;
  const nT6 = (t6 && t6.n) || 0;

  if (nT6 === 0) {
    righe.push('Il check-up dei sei mesi non è ancora stato compilato: la fotografia aggiornata sarà disponibile quando arriveranno le risposte.');
    return righe.join('\n');
  }
  if (tooSmall(nT0) || tooSmall(nT6)) {
    righe.push(`Le risposte non sono abbastanza per pubblicare una fotografia aggregata senza rischiare di identificare le persone (soglia: ${K_ANON}). Il confronto con la partenza non viene mostrato.`);
    return righe.join('\n');
  }

  const d0 = distribuzioneLeggibile(t0);
  const d6 = distribuzioneLeggibile(t6);
  const senza = `la distribuzione per livello non si mostra, perché ogni livello conta meno di ${K_ANON} persone`;
  righe.push(`Al check-up iniziale hanno risposto ${nT0} persone: ${d0 ? d0.testo : senza}.`);
  righe.push(`A sei mesi hanno risposto ${nT6} persone: ${d6 ? d6.testo : senza}.`);
  if ((d0 && d0.unite) || (d6 && d6.unite)) righe.push(NOTA_LIVELLI_UNITI);
  righe.push('');

  if (!l1Confrontabile(t0, t6)) {
    righe.push(L1_NON_CONFRONTABILE);
    return chiudi(righe, pgic);
  }

  const delta = t0.l1pct - t6.l1pct;
  const rap = rappresentativa(nT0, nT6);
  const quota = Math.round((nT6 / nT0) * 100);

  if (rap) {
    righe.push(`La quota in Livello 1 — le persone con un disturbo che limita l'attività — ${verso(delta)}: dal ${t0.l1pct}% al ${t6.l1pct}%. Il confronto è fra percentuali e non fra conteggi: chi risponde a sei mesi non è necessariamente chi ha risposto all'inizio, ma le domande e la definizione di livello sono le stesse ai due capi.`);
  } else {
    righe.push(`Ha risposto il ${quota}% di chi aveva compilato il check-up iniziale (${nT6} su ${nT0}): sotto il 70% il confronto è **indicativo**, non un risultato. La quota in Livello 1 passa dal ${t0.l1pct}% al ${t6.l1pct}%, e va letta con questa cautela.`);
  }

  return chiudi(righe, pgic);
}

function chiudi(righe, pgic) {
  if (pgic && pgic.n > 0 && !tooSmall(pgic.n)) {
    righe.push('');
    righe.push(`Alla domanda su come si sentono rispetto all'inizio del programma, ${pgic.migliorPct}% di chi ha risposto riferisce un miglioramento.`);
  }
  return righe.join('\n');
}

export const ANCORE_RIFOTO = ['## Documentazione degli interventi', '## Documentazione INAIL OT23', '## Documentazione INAIL', '## Raccomandazioni', '## Prossimi Passi'];

export function inserisciRifotografia(report, sezione) {
  if (!sezione) return report;
  for (const a of ANCORE_RIFOTO) {
    const i = report.indexOf(a);
    if (i !== -1) return `${report.slice(0, i)}${sezione}\n\n${report.slice(i)}`;
  }
  return `${report.trimEnd()}\n\n${sezione}`;
}
