// ─────────────────────────────────────────────────────────────────────────────
// calculator — DISPATCHER del pricing versionato.
// API pubblica invariata (computeForchetta, calculatePricing,
// realL1L2FromAssessment, getTier, fmt, calculateROI): i chiamanti passano
// `pricingVersion` ('v1' | 'v2') letto da clients.pricing_version — MAI dalla
// querystring. FAIL-SAFE: qualunque valore diverso da 'v2' (assente, null,
// sconosciuto) instrada su v1: l'errore residuo possibile è "nuovo cliente
// calcolato come v1", mai il contrario (nessuna regressione sugli esistenti).
// Le formule v1 sono CONGELATE in ./pricing/v1 (baseline al centesimo:
// scripts/pricing-v1-baseline.json). Il motore v2 arriva nel Blocco B.
// ─────────────────────────────────────────────────────────────────────────────
import { CONFIG } from './config';
import * as v1 from './pricing/v1';
import * as v2 from './pricing/v2';

const engineFor = (pricingVersion) => (pricingVersion === 'v2' ? v2 : v1);

export function fmt(n) {
  // useGrouping:'always' forza il separatore migliaia anche sui numeri a 4 cifre
  // (it-IT di default non raggruppa 1000-9999 → "1500" vs "12.500": incoerente)
  return `€${Math.round(Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;
}

// Tier interno (le "configurazioni" Core/Plus/Enterprise): condiviso tra versioni.
export { getTier, tierIncludesL2Prevention } from './pricing/v1';

export function calculatePricing(arg, l1Arg, l2Arg) {
  const version = arg && typeof arg === 'object' ? arg.pricingVersion : undefined;
  return engineFor(version).calculatePricing(arg, l1Arg, l2Arg);
}

export function computeForchetta(opts = {}) {
  return engineFor(opts.pricingVersion).computeForchetta(opts);
}

export function realL1L2FromAssessment(opts = {}) {
  return engineFor(opts.pricingVersion).realL1L2FromAssessment(opts);
}

export function calculateROI(price_y1, absence_days, cfg = CONFIG) {
  if (!absence_days || absence_days <= 0 || !price_y1) return null;
  const estimated_cost = absence_days * cfg.cost_per_absence_day;
  const breakeven_pct = Math.round((price_y1 / estimated_cost) * 100);
  return {
    estimated_cost,
    breakeven_pct,
    saving_15pct: Math.round(estimated_cost * 0.15 - price_y1),
    saving_20pct: Math.round(estimated_cost * 0.20 - price_y1),
  };
}
