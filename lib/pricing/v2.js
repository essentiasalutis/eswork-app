// ─────────────────────────────────────────────────────────────────────────────
// PRICING v2 — modello per le NUOVE aziende (clients.pricing_version='v2').
// Differenze rispetto a v1:
//   b) Prevenzione L2 in TUTTE le configurazioni (anche Core), a tariffa/sessione;
//   c) buffer 20% SOLO sulla clinica (a+b), MAI su formazione ed ergonomia;
//   e) ERGONOMIA: per persona (ufficio) + per postazione tipo (produzione),
//      minuti × tariffa oraria sportello del cliente (fattori, non valori secchi);
//      minimo fatturabile 4h → sotto: FLAG di avviso admin, nessun blocco.
//   Pacchetto d'ingresso "pacchetto_prevenzione": formazione + ergonomia +
//   assessment; ZERO voci cliniche, ZERO buffer. Regole dure in validatePacchetto.
// Modulo PURO (niente DB): i parametri arrivano da fuori (v2Params, override
// admin caricati server-side da ./settings); default qui sotto = seed della v38.
// Anno 2+: ergonomia ESCLUSA dal ricorrente (ricalcolata solo su neoassunti —
// aggancio futuro alla coda formazione org — e postazioni cambiate, a consumo
// con la stessa meccanica di org_sessione_formativa.importo_dovuto).
// ─────────────────────────────────────────────────────────────────────────────
import { CONFIG_V1, getTier } from './v1';

// Default dei fattori v2 (= seed pricing_settings v38). Gli override admin
// arrivano dal DB via lib/pricing/settings (server-side) come `v2Params`.
export const DEFAULTS_V2 = {
  l2_multiplier: 2,
  sessions_per_l1: 4,
  session_duration_min: 30,
  prevention_sessions_per_l2: 4,
  tariffa_sessione_prevenzione: 60,   // €/sessione prevenzione (tutte le configurazioni)
  buffer_pct: 0.20,                   // SOLO su clinica (cicli L1 + prevenzione L2)
  capienza_aula: 25,
  training_modules_y1: 2,
  training_modules_y2: 1,
  ergonomia_minuti_persona: 10,       // ufficio: 10' × tariffa/h sportello
  ergonomia_minuti_postazione: 60,    // produzione: 60' × tariffa/h sportello
  ergonomia_minimo_ore: 4,            // mezza giornata: sotto → avviso, nessun blocco
  soglia_ingresso: 80,                   // pacchetto selezionabile solo se popolazione ≤ soglia
  assessment_prezzo_per_dipendente: 15,  // pacchetto: €/dipendente DICHIARATO (fattore, non valore flat)
};

const P = (v2Params) => ({ ...DEFAULTS_V2, ...(v2Params || {}) });

// Ergonomia: ufficio per persona + produzione per postazione tipo (mista ok).
// Default forchetta (input non ancora raccolti al colloquio): tutta la
// popolazione in modalità ufficio, zero postazioni.
const r2 = (x) => Math.round(x * 100) / 100; // centesimi: niente derive floating-point

function computeErgonomia({ nUfficio, nPostazioni, rates, p }) {
  const uffH = (Math.max(0, nUfficio || 0) * p.ergonomia_minuti_persona) / 60;
  const postH = (Math.max(0, nPostazioni || 0) * p.ergonomia_minuti_postazione) / 60;
  const hours = uffH + postH;
  return {
    label: 'Consulenza ergonomico-posturale',
    detail: `${nUfficio || 0} persone (ufficio) × ${p.ergonomia_minuti_persona}′ + ${nPostazioni || 0} postazioni tipo × ${p.ergonomia_minuti_postazione}′`,
    hours,
    sell: r2(hours * rates.sportello_sell),
    cost: r2(hours * rates.sportello_cost),
    // Avviso (mai bloccante): "sotto minimo: accorpare ad altra attività in sede"
    sotto_minimo: hours > 0 && hours < p.ergonomia_minimo_ore,
    minimo_ore: p.ergonomia_minimo_ore,
  };
}

// Voci di un anno v2. includeErgonomia=false per Anno 2+ (a consumo).
function computeYearV2({ l1, l2, groups, modules, rates, p, vatExempt, ergonomia, includeErgonomia }) {
  const dur = p.session_duration_min / 60;

  // a) Cicli L1 — invariato rispetto a v1
  const sportelloHours = l1 * p.sessions_per_l1 * dur;
  const sportello = {
    label: 'Sportello trattamento L1',
    detail: `${l1} L1 × ${p.sessions_per_l1} sedute × ${p.session_duration_min}′`,
    hours: sportelloHours,
    sell: sportelloHours * rates.sportello_sell,
    cost: sportelloHours * rates.sportello_cost,
  };
  const prevalidations = {
    label: 'Pre-validazioni',
    detail: `${l1} × 15′`,
    count: l1,
    sell: l1 * rates.prevalidation_sell,
    cost: l1 * rates.prevalidation_cost,
  };

  // b) Prevenzione L2 — in TUTTE le configurazioni, tariffa a sessione
  const preventionSessions = l2 * p.prevention_sessions_per_l2;
  const prevention = {
    label: 'Prevenzione attiva L2',
    detail: `${l2} L2 × ${p.prevention_sessions_per_l2} sessioni × €${p.tariffa_sessione_prevenzione}`,
    hours: preventionSessions * dur,
    sessions: preventionSessions,
    sell: preventionSessions * p.tariffa_sessione_prevenzione,
    cost: preventionSessions * dur * rates.sportello_cost,
  };

  // c) Buffer SOLO su clinica (a + b)
  const clinico_sell = sportello.sell + prevalidations.sell + prevention.sell;
  const clinico_cost = sportello.cost + prevalidations.cost + prevention.cost;
  const buffer_sell = clinico_sell * p.buffer_pct;
  const buffer_cost = clinico_cost * p.buffer_pct;

  // d) Formazione — invariata
  const trainingSessions = groups * modules;
  const training = {
    label: 'Formazione collettiva',
    detail: `${groups} gruppi × ${modules} ${modules === 1 ? 'modulo' : 'moduli'}`,
    sessions: trainingSessions,
    sell: trainingSessions * rates.training_sell,
    cost: trainingSessions * rates.training_cost,
  };

  // e) Ergonomia — mai col buffer; solo Anno 1 (Anno 2+ a consumo)
  const ergo = includeErgonomia ? computeErgonomia({ ...ergonomia, rates, p }) : null;

  const items = ergo ? [sportello, prevalidations, prevention, training, ergo] : [sportello, prevalidations, prevention, training];
  const subtotal_sell = items.reduce((s, i) => s + i.sell, 0);
  const subtotal_cost = items.reduce((s, i) => s + i.cost, 0);
  const total_sell = subtotal_sell + buffer_sell;
  const total_cost = subtotal_cost + buffer_cost;
  const isExempt = vatExempt != null ? vatExempt : CONFIG_V1.vat_exempt;
  const vat = isExempt ? 0 : total_sell * CONFIG_V1.vat_pct;

  return {
    items,
    sportello, prevalidations, prevention, training, ergonomia: ergo,
    groups, modules, trainingSessions,
    subtotal_sell, subtotal_cost,
    subtotal_clinico_sell: clinico_sell, subtotal_clinico_cost: clinico_cost,
    buffer_pct: p.buffer_pct, buffer_sell, buffer_cost, // buffer applicato SOLO alla clinica
    total_sell, total_cost,
    margin: total_sell - total_cost,
    vat, total_with_vat: total_sell + vat,
    sportello_hours_total: sportello.hours + prevention.hours,
    ergonomia_sotto_minimo: !!(ergo && ergo.sotto_minimo),
  };
}

// Stessa API di v1.calculatePricing (+ v2Params, ergonomia). Shape output compatibile.
export function calculatePricing(arg) {
  const a = arg && typeof arg === 'object' ? arg : { n: arg };
  const p = P(a.v2Params);
  const n = parseInt(a.n) || 0;
  if (n <= 0) return null;
  const l1 = Math.max(0, a.l1 || 0);
  const l2 = Math.max(0, a.l2 || 0);
  const tier = a.tier || getTier(n);
  const rates = a.rates || CONFIG_V1.rates_new;
  const groups = a.groups != null ? a.groups : Math.ceil(n / p.capienza_aula) || 1;
  const ergonomia = { nUfficio: a.ergonomia?.nUfficio ?? n, nPostazioni: a.ergonomia?.nPostazioni ?? 0 };

  const base = { l1, l2, groups, rates, p, vatExempt: a.vatExempt, ergonomia };
  const y1 = computeYearV2({ ...base, modules: p.training_modules_y1, includeErgonomia: true });
  // Anno 2+: formazione 1 modulo; ergonomia ESCLUSA (solo neoassunti/postazioni
  // cambiate, a consumo — meccanica org_sessione_formativa, aggancio futuro).
  const y2 = computeYearV2({ ...base, modules: p.training_modules_y2, includeErgonomia: false });

  const price_y1 = Math.round(y1.total_sell);
  const price_y2 = Math.round(y2.total_sell);

  return {
    pricing_version: 'v2',
    n, l1, l2, tier, groups, rates,
    y1, y2,
    price_y1, price_y2,
    price_monthly_y1: Math.round(price_y1 / CONFIG_V1.contract_months),
    price_per_employee_y1: Math.round(price_y1 / n),
    pop_y2: l1 + l2,
    days_osteo_y1: Math.ceil(y1.sportello_hours_total / CONFIG_V1.hours_per_day),
    training_sessions_y1: y1.trainingSessions,
    hours_treated: (p.sessions_per_l1 * p.session_duration_min) / 60 + CONFIG_V1.training_module_hours * p.training_modules_y1,
    hours_untreated: CONFIG_V1.training_module_hours * p.training_modules_y1,
    ergonomia_sotto_minimo: y1.ergonomia_sotto_minimo,
  };
}

// Forchetta v2: scenari per prevalenza COME IN v1 (min/medio/max per settore).
export function computeForchetta({ n, sector, tier, groups, rates, vatExempt, l2Mult, v2Params, ergonomia } = {}) {
  const p = P(v2Params);
  const N = parseInt(n) || 0;
  const prev = (CONFIG_V1.l1_prevalence && CONFIG_V1.l1_prevalence[sector]) || [0.08, 0.13, 0.19];
  const mult = l2Mult != null ? l2Mult : p.l2_multiplier;
  const mk = (pct) => {
    const l1 = Math.round(N * pct);
    const l2 = Math.round(l1 * mult);
    const calc = N > 0 ? calculatePricing({ n: N, l1, l2, tier, groups, rates, vatExempt, v2Params, ergonomia }) : null;
    return { pct, l1, l2, ...(calc || {}) };
  };
  return { min: mk(prev[0]), avg: mk(prev[1]), max: mk(prev[2]) };
}

// Identica alla v1 nella sostanza (prevalenza osservata × forza lavoro);
// default del moltiplicatore dai parametri v2.
export function realL1L2FromAssessment({ l1Responders, responders, employees, l2Mult, v2Params } = {}) {
  const p = P(v2Params);
  const N = parseInt(employees) || 0;
  const resp = parseInt(responders) || 0;
  const obsPrev = resp > 0 ? (l1Responders || 0) / resp : 0;
  const l1 = Math.round(obsPrev * N);
  const l2 = Math.round(l1 * (l2Mult != null ? l2Mult : p.l2_multiplier));
  return { l1, l2, obsPrev };
}

// ─── Pacchetto d'ingresso "pacchetto_prevenzione" ─────────────────────────────
// REGOLE DURE (da applicare lato server, non solo UI).
export function validatePacchetto({ employees, pricingVersion, v2Params } = {}) {
  const p = P(v2Params);
  const n = parseInt(employees) || 0;
  if (pricingVersion !== 'v2') {
    return { ok: false, motivo: 'il pacchetto prevenzione è disponibile solo per aziende sul listino v2' };
  }
  if (n <= 0 || n > p.soglia_ingresso) {
    return { ok: false, motivo: `il pacchetto prevenzione è disponibile solo fino a ${p.soglia_ingresso} dipendenti (popolazione: ${n})` };
  }
  return { ok: true };
}

// Calcolo pacchetto: formazione (2 moduli) + ergonomia + assessment, prezzo pieno.
// ZERO voci cliniche (niente cicli L1, niente prevenzione L2), ZERO buffer.
// L'assessment è quello COMPLETO (stessi flussi/consensi del programma): qui se
// ne prezza solo l'erogazione (parametro prezzo_assessment_pacchetto).
export function calculatePacchetto({ n, groups, rates, vatExempt, v2Params, ergonomia } = {}) {
  const p = P(v2Params);
  const N = parseInt(n) || 0;
  if (N <= 0) return null;
  const r = rates || CONFIG_V1.rates_new;
  const grp = groups != null ? groups : Math.ceil(N / p.capienza_aula) || 1;

  const trainingSessions = grp * p.training_modules_y1; // 2 moduli
  const training = {
    label: 'Formazione collettiva',
    detail: `${grp} gruppi × ${p.training_modules_y1} moduli`,
    sessions: trainingSessions,
    sell: trainingSessions * r.training_sell,
    cost: trainingSessions * r.training_cost,
  };
  const ergo = computeErgonomia({ nUfficio: ergonomia?.nUfficio ?? N, nPostazioni: ergonomia?.nPostazioni ?? 0, rates: r, p });
  const assessment = {
    label: 'Assessment completo',
    detail: `${N} dipendenti dichiarati × €${p.assessment_prezzo_per_dipendente} — consensi e flussi clinici identici al programma completo`,
    sell: r2(N * p.assessment_prezzo_per_dipendente),
    cost: 0,
  };

  const items = [training, ergo, assessment];
  const total_sell = items.reduce((s, i) => s + i.sell, 0);
  const total_cost = items.reduce((s, i) => s + i.cost, 0);
  const isExempt = vatExempt != null ? vatExempt : CONFIG_V1.vat_exempt;
  const vat = isExempt ? 0 : total_sell * CONFIG_V1.vat_pct;

  return {
    pricing_version: 'v2',
    tipo_prodotto: 'pacchetto_prevenzione',
    n, groups: grp, rates: r,
    items, training, ergonomia: ergo, assessment,
    // niente clinica, niente buffer: totale = somma diretta delle tre componenti
    total_sell, total_cost, margin: total_sell - total_cost,
    vat, total_with_vat: total_sell + vat,
    price: Math.round(total_sell),
    durata_mesi: 12, // NON rinnovabile: alla scadenza upgrade a programma_completo o chiusura
    ergonomia_sotto_minimo: !!ergo.sotto_minimo,
  };
}
