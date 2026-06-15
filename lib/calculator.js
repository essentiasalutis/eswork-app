import { CONFIG } from './config';

export function fmt(n) {
  // useGrouping:'always' forza il separatore migliaia anche sui numeri a 4 cifre
  // (it-IT di default non raggruppa 1000-9999 → "1500" vs "12.500": incoerente)
  return `€${Math.round(Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;
}

// ─── Tier interno ─────────────────────────────────────────────────────────────
// Dipendenti = criterio base; fatturato sposta i borderline; maturità HR rifinisce.
// hrMaturity: 'low' | 'medium' | 'high' · fatturato in €/anno (numero) opzionale.
export function getTier(n, { fatturato = null, hrMaturity = null } = {}, cfg = CONFIG) {
  const emp = parseInt(n) || 0;
  let tier = emp <= cfg.tier_core_max ? 'core' : emp <= cfg.tier_plus_max ? 'plus' : 'enterprise';

  // Borderline Core↔Plus (~150) e Plus↔Enterprise (~500): fatturato/HR possono spostare
  const nearCorePlus = Math.abs(emp - cfg.tier_core_max) <= 15;
  const nearPlusEnt = Math.abs(emp - cfg.tier_plus_max) <= 30;
  const strong = (fatturato && fatturato >= 10_000_000) || hrMaturity === 'high';
  const weak = hrMaturity === 'low';

  if (nearCorePlus) {
    if (tier === 'core' && strong) tier = 'plus';
    else if (tier === 'plus' && weak && !strong) tier = 'core';
  }
  if (nearPlusEnt) {
    if (tier === 'plus' && strong) tier = 'enterprise';
    else if (tier === 'enterprise' && weak && !strong) tier = 'plus';
  }
  return tier;
}

export function tierIncludesL2Prevention(tier) {
  return tier === 'plus' || tier === 'enterprise';
}

// ─── Voci di un anno ──────────────────────────────────────────────────────────
function computeYear({ l1, l2, tier, groups, modules, rates, cfg, vatExempt }) {
  const dur = cfg.session_duration_min / 60; // ore per seduta
  const withPrevention = tierIncludesL2Prevention(tier);

  // Sportello trattamento L1: l1 × 4 sedute × durata
  const sportelloHours = l1 * cfg.sessions_per_l1 * dur;
  const sportello = {
    label: 'Sportello trattamento L1',
    detail: `${l1} L1 × ${cfg.sessions_per_l1} sedute × ${cfg.session_duration_min}′`,
    hours: sportelloHours,
    sell: sportelloHours * rates.sportello_sell,
    cost: sportelloHours * rates.sportello_cost,
  };

  // Pre-validazioni: 1 per L1 (15 min, tariffa fissa)
  const prevalidations = {
    label: 'Pre-validazioni',
    detail: `${l1} × 15′`,
    count: l1,
    sell: l1 * rates.prevalidation_sell,
    cost: l1 * rates.prevalidation_cost,
  };

  // Prevenzione attiva L2 (solo Plus/Enterprise)
  const preventionHours = withPrevention ? l2 * cfg.prevention_sessions_per_l2 * dur : 0;
  const prevention = {
    label: 'Prevenzione attiva L2',
    detail: withPrevention ? `${l2} L2 × ${cfg.prevention_sessions_per_l2} sessioni × ${cfg.session_duration_min}′` : 'non prevista (tier Core)',
    hours: preventionHours,
    sell: withPrevention ? preventionHours * rates.sportello_sell : 0,
    cost: withPrevention ? preventionHours * rates.sportello_cost : 0,
  };

  // Formazione: gruppi × moduli (1h/modulo)
  const trainingSessions = groups * modules;
  const training = {
    label: 'Formazione collettiva',
    detail: `${groups} gruppi × ${modules} ${modules === 1 ? 'modulo' : 'moduli'}`,
    sessions: trainingSessions,
    sell: trainingSessions * rates.training_sell,
    cost: trainingSessions * rates.training_cost,
  };

  const items = [sportello, prevalidations, prevention, training];
  const subtotal_sell = items.reduce((s, i) => s + i.sell, 0);
  const subtotal_cost = items.reduce((s, i) => s + i.cost, 0);

  const buffer_sell = subtotal_sell * cfg.buffer_pct;
  const buffer_cost = subtotal_cost * cfg.buffer_pct;

  const total_sell = subtotal_sell + buffer_sell;
  const total_cost = subtotal_cost + buffer_cost;
  const isExempt = vatExempt != null ? vatExempt : cfg.vat_exempt;
  const vat = isExempt ? 0 : total_sell * cfg.vat_pct;

  return {
    items,
    sportello, prevalidations, prevention, training,
    groups, modules, trainingSessions,
    subtotal_sell, subtotal_cost,
    buffer_pct: cfg.buffer_pct, buffer_sell, buffer_cost,
    total_sell, total_cost,
    margin: total_sell - total_cost,
    vat, total_with_vat: total_sell + vat,
    sportello_hours_total: sportelloHours + preventionHours,
  };
}

/**
 * calculatePricing — flessibile:
 *   - nuovo stile:  calculatePricing({ n, l1, l2, tier, groups, rates, cfg })
 *   - legacy:       calculatePricing(n, l1, l2)  (usa default sensati)
 * Restituisce { y1, y2, ... } + campi back-compat per la pagina offerta.
 */
export function calculatePricing(arg, l1Arg, l2Arg) {
  const cfg = CONFIG;
  let n, l1, l2, tier, groups, rates, vatExempt;

  if (arg && typeof arg === 'object') {
    n = parseInt(arg.n) || 0;
    l1 = Math.max(0, arg.l1 || 0);
    l2 = Math.max(0, arg.l2 || 0);
    tier = arg.tier || getTier(n);
    rates = arg.rates || cfg.rates_new;
    groups = arg.groups != null ? arg.groups : Math.ceil(n / cfg.classroom_capacity_default) || 1;
    vatExempt = arg.vatExempt;
  } else {
    n = parseInt(arg) || 0;
    l1 = Math.max(0, l1Arg || 0);
    l2 = Math.max(0, l2Arg || 0);
    tier = getTier(n);
    rates = cfg.rates_new;
    groups = Math.ceil(n / cfg.classroom_capacity_default) || 1;
  }
  if (n <= 0) return null;

  const y1 = computeYear({ l1, l2, tier, groups, modules: cfg.training_modules_y1, rates, cfg, vatExempt });
  const y2 = computeYear({ l1, l2, tier, groups, modules: cfg.training_modules_y2, rates, cfg, vatExempt });

  const price_y1 = Math.round(y1.total_sell);
  const price_y2 = Math.round(y2.total_sell);

  return {
    n, l1, l2, tier, groups, rates,
    y1, y2,
    // back-compat / comodità per la pagina offerta
    price_y1,
    price_y2,
    price_monthly_y1: Math.round(price_y1 / cfg.contract_months),
    price_per_employee_y1: Math.round(price_y1 / n),
    pop_y2: l1 + l2,
    days_osteo_y1: Math.ceil(y1.sportello_hours_total / cfg.hours_per_day),
    training_sessions_y1: y1.trainingSessions,
    // Tempo-dipendente/anno: il trattato fa sedute E formazione collettiva
    hours_treated: (cfg.sessions_per_l1 * cfg.session_duration_min) / 60 + cfg.training_module_hours * cfg.training_modules_y1,
    hours_untreated: cfg.training_module_hours * cfg.training_modules_y1,
  };
}

// ─── Forchetta di stima (pre-assessment) ───────────────────────────────────────
// 3 scenari (min/medio/max) di prevalenza L1 per settore, calcolati con le STESSE
// condizioni del colloquio (tier, gruppi, tariffe, IVA). SORGENTE UNICA della
// forbice: colloquio, pagina Stima, PDF Stima e (STEP 2) confronto dentro/fuori.
// Ogni scenario = { pct, l1, l2, ...output completo di calculatePricing }.
export function computeForchetta({ n, sector, tier, groups, rates, vatExempt, l2Mult } = {}) {
  const N = parseInt(n) || 0;
  const prev = (CONFIG.l1_prevalence && CONFIG.l1_prevalence[sector]) || [0.08, 0.13, 0.19];
  const mult = l2Mult != null ? l2Mult : CONFIG.l2_multiplier_default;
  const mk = (p) => {
    const l1 = Math.round(N * p);
    const l2 = Math.round(l1 * mult);
    const calc = N > 0 ? calculatePricing({ n: N, l1, l2, tier, groups, rates, vatExempt }) : null;
    return { pct: p, l1, l2, ...(calc || {}) };
  };
  return { min: mk(prev[0]), avg: mk(prev[1]), max: mk(prev[2]) };
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
