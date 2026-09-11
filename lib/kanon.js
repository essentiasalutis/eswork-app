// ─── k-anonymity per gli output verso l'azienda ──────────────────────────────
// Nessun gruppo con meno di k persone viene mostrato. Per le PARTIZIONI con
// totale noto (es. L1/L2/L3 che sommano a N pubblicato), applica anche la
// SOPPRESSIONE SECONDARIA: se sopprimo una sola cella, il suo valore è ricavabile
// per differenza (valore = totale − somma delle altre), quindi sopprimo anche la
// cella visibile più piccola, così nessun gruppo sotto soglia è deducibile.

import { CONFIG } from './config';

export const K_ANON = CONFIG.k_anon_min || 5;
export const SUPPRESSED = 'n.d.'; // etichetta per una cella soppressa per privacy

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

// Comodità per i testi dei report: "10 (20%)" oppure "n.d. (gruppo < k)".
export function fmtCell(cell, { withPct = true } = {}) {
  if (!cell || cell.suppressed) return `${SUPPRESSED} (gruppo < ${K_ANON})`;
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
