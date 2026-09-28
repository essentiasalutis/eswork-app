// ─── k-anonymity per gli output verso l'azienda ──────────────────────────────
// Nessun gruppo con meno di k persone viene mostrato. Per le PARTIZIONI con
// totale noto (es. L1/L2/L3 che sommano a N pubblicato), applica anche la
// SOPPRESSIONE SECONDARIA: se sopprimo una sola cella, il suo valore è ricavabile
// per differenza (valore = totale − somma delle altre), quindi sopprimo anche la
// cella visibile più piccola, così nessun gruppo sotto soglia è deducibile.

import { CONFIG } from './config';

export const K_ANON = CONFIG.k_anon_min || 5;
export const SUPPRESSED = 'n.d.'; // etichetta per una cella soppressa per privacy


// Soglia PIÙ ALTA per i dati INCROCIATI (zone e livelli dentro la suddivisione per
// tipologia di lavoro). Motivo: nell'incrocio il gruppo di riferimento è già piccolo,
// e conoscere due attributi insieme — «in ufficio, 3 persone con mal di schiena» —
// restringe molto più della stessa cifra sul totale aziendale. La soglia generale
// può scendere; questa no.
export const K_ANON_INCROCIO = Math.max(5, K_ANON);

// Una popolazione/gruppo troppo piccolo per qualsiasi aggregato sicuro.
export function tooSmall(n, k = K_ANON) {
  return (n || 0) < k;
}

// Maschera un conteggio singolo (non partizione). Un gruppo VUOTO (0) non è un
// rischio di re-identificazione e va mostrato; si maschera solo 1..k-1.
export function maskCount(count, k = K_ANON) {
  const n = count || 0;
  if (n === 0) return 0;
  return n < k ? null : count;
}

// Partizione con totale noto. cells: [{ key, label, count }].
// Ritorna [{ key, label, count, pct, suppressed }] (count/pct null se soppresso).
// totalKnown=true (default): il totale è pubblicato ⇒ serve la soppressione secondaria.
export function kAnonPartition(cells, total, { k = K_ANON, totalKnown = true } = {}) {
  // Un gruppo VUOTO (0) non è re-identificabile: si sopprime solo 1..k-1.
  const work = (cells || []).map(c => ({ ...c, suppressed: (c.count || 0) > 0 && (c.count || 0) < k }));

  if (totalKnown) {
    const suppressedCount = work.filter(c => c.suppressed).length;
    // Esattamente 1 soppressa + totale noto ⇒ ricavabile per differenza.
    // Sopprimo anche la cella VISIBILE più piccola (e non vuota): soppressione secondaria.
    if (suppressedCount === 1) {
      const visible = work.filter(c => !c.suppressed && c.count > 0);
      if (visible.length > 0) {
        const smallest = visible.reduce((m, c) => (c.count < m.count ? c : m), visible[0]);
        smallest.suppressed = true;
      }
    }
  }

  const denom = total > 0 ? total : 1;
  return work.map(c => ({
    key: c.key,
    label: c.label,
    count: c.suppressed ? null : c.count,
    pct: c.suppressed ? null : Math.round((c.count / denom) * 100),
    suppressed: c.suppressed,
  }));
}

// Nei documenti del cliente un dato nascosto si scrive sempre così (Enrico, 28/9).
export const ND_POCHI = `N.d. poiché < ${K_ANON} persone`;

// Comodità per i testi dei report: "10 (20%)" oppure «N.d. poiché < k persone».
export function fmtCell(cell, { withPct = true } = {}) {
  if (!cell || cell.suppressed) return ND_POCHI;
  return withPct && cell.pct != null ? `${cell.count} (${cell.pct}%)` : `${cell.count}`;
}

// Vista riservata di un check-up per i documenti che legge l'azienda (Offerta,
// Presentazione del Report, Sintesi): stessa regola del Report sulla scheda. Con meno
// di k risposte nessun dato; livelli con soppressione secondaria; zone e prevalenza
// mascherate sotto k. `l1Visibile` = il gruppo del Livello 1 si può citare (quantità).
export function vistaRiservata(nmq) {
  const n = (nmq && nmq.n) || 0;
  if (!nmq || tooSmall(n)) return { pubblicabile: false, n, livelli: null, zone: [], prevalenza: null, l1Visibile: false };
  const livelli = kAnonPartition([
    { key: 'l1', count: nmq.level1.count },
    { key: 'l2', count: nmq.level2.count },
    { key: 'l3', count: nmq.level3.count },
  ], n);
  const zone = (nmq.zones || []).map(z => (maskCount(z.count12) == null ? { ...z, count12: null, pct12: null, soppressa: true } : { ...z, soppressa: false }));
  const prevalenza = maskCount(nmq.prevalence && nmq.prevalence.count) == null ? null : nmq.prevalence.pct;
  return { pubblicabile: true, n, livelli, zone, prevalenza, l1Visibile: !livelli.find(c => c.key === 'l1').suppressed };
}

// ─── Livelli per la lettura (Enrico, 27/9) ───────────────────────────────────
// I livelli sotto soglia non si mostrano più come «n.d.» uno per uno: si UNISCONO in un
// solo dato («Livello 1 e Livello 3: 33%, 3 persone»). È sempre sicuro: quel numero si
// ricava già dal totale meno i livelli mostrati, quindi non rivela niente di nuovo.
// I livelli con almeno k persone restano separati. Se nessun livello è mostrabile da
// solo, la distribuzione per livello non si mostra.
// `celle`: uscita di kAnonPartition (chiavi l1/l2/l3, nell'ordine), `n`: il totale.
export function livelliLeggibili(celle, n) {
  if (!celle || !celle.length) return { celle: [], unite: null, nessunaDistribuzione: true };
  const soppresse = celle.filter(c => c.suppressed);
  const visibili = celle.filter(c => !c.suppressed);
  if (!soppresse.length) return { celle: celle.map(c => ({ ...c, keys: [c.key], unite: false })), unite: null, nessunaDistribuzione: false };
  // Con una sola cella soppressa l'unione la mostrerebbe da sola: kAnonPartition non lo
  // permette (soppressione secondaria), ma se capitasse non si mostra niente. Se sono
  // soppresse tutte, unite farebbero il 100%: non dice niente, non si mostra.
  if (soppresse.length < 2 || !visibili.length) return { celle: [], unite: null, nessunaDistribuzione: true };
  const count = n - visibili.reduce((s, c) => s + (c.count || 0), 0);
  const unite = { key: soppresse.map(c => c.key).join('+'), keys: soppresse.map(c => c.key), count, pct: n > 0 ? Math.round((count / n) * 100) : 0, suppressed: false, unite: true };
  const out = [];
  let messa = false;
  for (const c of celle) {
    if (!c.suppressed) out.push({ ...c, keys: [c.key], unite: false });
    else if (!messa) { out.push(unite); messa = true; }
  }
  return { celle: out, unite, nessunaDistribuzione: false };
}

// «Livello 1 e Livello 3» — il nome di una cella (singola o unita).
export function nomeCella(c) {
  const nomi = (c.keys || [c.key]).map(k => `Livello ${String(k).replace('l', '')}`);
  return nomi.length > 1 ? `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}` : nomi[0];
}

export const NOTA_LIVELLI_UNITI = `Alcuni livelli sono mostrati insieme: separati, uno dei gruppi conterebbe meno di ${K_ANON} persone.`;
export const NOTA_NESSUNA_DISTRIBUZIONE = `La distribuzione per livello non si mostra: ogni livello conta meno di ${K_ANON} persone.`;
