import { CONFIG } from './config';

const C = CONFIG;

/**
 * Calcola prezzi Anno 1 e Anno 2+
 * @param {number} n  - totale dipendenti
 * @param {number} l1 - dipendenti Livello 1 (trattamento)
 * @param {number} l2 - dipendenti Livello 2 (prevenzione)
 */
export function calculatePricing(n, l1, l2) {
  if (!n || n <= 0) return null;
  const safeL1 = Math.max(0, l1 || 0);
  const safeL2 = Math.max(0, l2 || 0);

  // ─── Anno 1 ───────────────────────────────────────────────────────────────
  const sessions_y1_base = safeL1 * (C.sessions_intensive + C.sessions_maintenance) * C.completion_rate;
  const buffer_sessions = Math.round(sessions_y1_base * 0.15);
  const sessions_y1_total = sessions_y1_base + buffer_sessions;
  const days_osteo_y1 = Math.ceil(sessions_y1_total / C.slots_per_day);
  const groups = Math.ceil(n / C.max_group_size);
  const training_sessions_y1 = groups * C.training_topics_y1;

  const cost_osteo_y1 = days_osteo_y1 * C.hourly_rate * C.hours_per_day;
  const cost_training_y1 = training_sessions_y1 * C.hourly_rate * C.training_hours_paid;
  const cost_assessments_y1 = C.cost_initial_assessment + C.cost_final_assessment;
  const cost_reviews_y1 = 2 * C.cost_review;
  const total_cost_y1 = cost_osteo_y1 + cost_training_y1 + cost_assessments_y1 + cost_reviews_y1 + C.cost_annual_report;

  const price_y1 = Math.round(total_cost_y1 / (1 - C.margin_y1) / 100) * 100;
  const price_monthly_y1 = Math.round(price_y1 / 12);
  const price_per_employee_y1 = Math.round(price_y1 / n);

  // ─── Anno 2+ ──────────────────────────────────────────────────────────────
  const sessions_y2 =
    safeL1 * C.sessions_maintenance_y2 * C.completion_rate +
    safeL2 * C.sessions_prevention_y2 * C.completion_rate;
  const days_osteo_y2 = Math.ceil(sessions_y2 / C.slots_per_day);
  const training_sessions_y2 = groups * C.training_topics_y2;

  const cost_osteo_y2 = days_osteo_y2 * C.hourly_rate * C.hours_per_day;
  const cost_training_y2 = training_sessions_y2 * C.hourly_rate * C.training_hours_paid;
  const total_cost_y2 = cost_osteo_y2 + cost_training_y2 + C.cost_final_assessment + 2 * C.cost_review + C.cost_annual_report;
  const price_y2 = Math.round(total_cost_y2 / (1 - C.margin_y2) / 100) * 100;

  // ─── Tempo per dipendente ─────────────────────────────────────────────────
  const hours_treated =
    ((C.sessions_intensive + C.sessions_maintenance) * C.session_duration_min) / 60 +
    C.training_topics_y1;
  const hours_untreated = C.training_topics_y1;

  const buffer_hours = (buffer_sessions * C.session_duration_min) / 60;

  return {
    // Y1
    sessions_y1_base, buffer_sessions, buffer_hours,
    days_osteo_y1, groups, training_sessions_y1,
    cost_osteo_y1, cost_training_y1, cost_assessments_y1, cost_reviews_y1,
    cost_annual_report: C.cost_annual_report,
    total_cost_y1, price_y1, price_monthly_y1, price_per_employee_y1,
    // Y2
    days_osteo_y2, training_sessions_y2, total_cost_y2, price_y2, pop_y2: safeL1 + safeL2,
    // Tempo
    hours_treated, hours_untreated,
  };
}

export function calculateROI(price_y1, absence_days) {
  if (!absence_days || absence_days <= 0 || !price_y1) return null;
  const estimated_cost = absence_days * C.cost_per_absence_day;
  const breakeven_pct = Math.round((price_y1 / estimated_cost) * 100);
  return {
    estimated_cost,
    breakeven_pct,
    saving_15pct: Math.round(estimated_cost * 0.15 - price_y1),
    saving_20pct: Math.round(estimated_cost * 0.20 - price_y1),
  };
}

export function fmt(n) {
  return `€${Number(n).toLocaleString('it-IT')}`;
}
