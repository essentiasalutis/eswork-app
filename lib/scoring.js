// Ported from ES_Work_App_1.jsx — logica di scoring certificata

export const BODY_ZONES = [
  'Collo', 'Spalle', 'Schiena alta (dorsale)', 'Schiena bassa (lombare)',
  'Gomiti', 'Polsi / Mani', 'Anche / Cosce', 'Ginocchia', 'Caviglie / Piedi',
];

export const NMQ_LABELS = [
  'Negli ultimi 12 mesi, hai avuto fastidi o dolori a:',
  'Questo problema ti ha impedito di svolgere le normali attività?',
  'Negli ultimi 7 giorni, hai avuto fastidi o dolori a:',
];

// ─── Individual scoring ───────────────────────────────────────────────────────

export function scoreNMQ(answers) {
  return BODY_ZONES.map((zone, zi) => ({
    zone,
    q12: answers[`nmq_${zi}_0`] === 1,
    qImp: answers[`nmq_${zi}_1`] === 1,
    q7: answers[`nmq_${zi}_2`] === 1,
  }));
}

// ─── STRATIFICAZIONE v4 — fonte di verità unica ──────────────────────────────
//
// Formato canonico per zona: { pain_recent, pain_12m, functional_impact } (boolean)
//   • pain_recent       — dolore negli ultimi 7 giorni / in corso  → DETERMINA il livello
//   • pain_12m          — dolore negli ultimi 12 mesi (storia)     → solo prevalenza, NON il livello
//   • functional_impact — il problema ha limitato/impedito le normali attività
//
// Criteri di classificazione (UNICI, applicati ovunque):
//   • L1 = almeno una zona con dolore presente (pain_recent) E impatto funzionale
//   • L2 = almeno una zona con dolore presente MA nessuna con impatto funzionale
//   • L3 = nessuna zona con dolore presente
//
// L'NRS non entra MAI nella stratificazione (resta solo in pre-validazione e sessioni).

function truthy(v) {
  return v === true || v === 1 || v === '1' || v === 'true' || v === 'yes' || v === 'sì' || v === 'si';
}

// Mappa un singolo oggetto-zona (formato misto/legacy) ai 3 campi canonici.
function normalizeZone(obj) {
  if (!obj || typeof obj !== 'object') return { pain_recent: false, pain_12m: false, functional_impact: false };
  return {
    pain_recent:
      obj.pain_recent !== undefined ? truthy(obj.pain_recent)
      : obj.pain_7days !== undefined ? truthy(obj.pain_7days)
      : false,
    pain_12m: obj.pain_12m !== undefined ? truthy(obj.pain_12m) : false,
    functional_impact: obj.functional_impact !== undefined ? truthy(obj.functional_impact) : false,
  };
}

// Converte QUALSIASI formato di risposte NMQ nel formato canonico (array di zone).
// Gestisce esplicitamente i campi mancanti (default false). Formati riconosciuti:
//   (A) chiavi piatte per zona:  nmq_{zi}_0 (12 mesi), nmq_{zi}_1 (impatto), nmq_{zi}_2 (7 giorni)
//   (B) oggetto piatto singolo:  { functional_impact, pain_7days, pain_recent, pain_12m }
//   (C) oggetto per-zona:        { "Collo": { functional_impact, pain_7days, nrs, ... }, ... }
export function normalizeNMQ(raw) {
  if (!raw || typeof raw !== 'object') return [];
  const keys = Object.keys(raw);

  // (A) chiavi piatte nmq_{zi}_{qi}
  if (keys.some(k => /^nmq_\d+_\d+$/.test(k))) {
    return BODY_ZONES.map((_, zi) => ({
      pain_12m: truthy(raw[`nmq_${zi}_0`]),
      functional_impact: truthy(raw[`nmq_${zi}_1`]),
      pain_recent: truthy(raw[`nmq_${zi}_2`]),
    }));
  }

  // (C) oggetto per-zona: i valori sono oggetti
  const objectKeys = keys.filter(k => raw[k] && typeof raw[k] === 'object' && !Array.isArray(raw[k]));
  if (objectKeys.length > 0) {
    return objectKeys.map(k => normalizeZone(raw[k]));
  }

  // (B) oggetto piatto singolo con campi canonici/legacy
  if ('functional_impact' in raw || 'pain_7days' in raw || 'pain_recent' in raw || 'pain_12m' in raw) {
    return [normalizeZone(raw)];
  }

  return [];
}

// FONTE DI VERITÀ UNICA: livello candidato (computed_level) da risposte NMQ.
// Restituisce 'level1' | 'level2' | 'level3'.
export function computeLevel(raw) {
  const zones = normalizeNMQ(raw);
  if (zones.some(z => z.pain_recent && z.functional_impact)) return 'level1';
  if (zones.some(z => z.pain_recent)) return 'level2';
  return 'level3';
}

// Versione numerica (1/2/3) usata internamente dalle aggregazioni dei report.
function classifyNMQ(answers) {
  const level = computeLevel(answers);
  return level === 'level1' ? 1 : level === 'level2' ? 2 : 3;
}

function aggregateRoleGroup(group) {
  const ng = group.length;
  const empty = { count: 0, pct: 0 };
  if (ng === 0) return { n: 0, level1: empty, level2: empty, level3: empty, zones: [] };
  const lvls = group.map(classifyNMQ);
  const l1 = lvls.filter(l => l === 1).length;
  const l2 = lvls.filter(l => l === 2).length;
  const l3 = lvls.filter(l => l === 3).length;
  const zoneData = BODY_ZONES.map((zone, zi) => {
    let c12 = 0;
    for (const a of group) if (scoreNMQ(a)[zi].q12) c12++;
    return { zone, count12: c12, pct12: Math.round(c12 / ng * 100) };
  }).sort((a, b) => b.pct12 - a.pct12);
  return {
    n: ng,
    level1: { count: l1, pct: Math.round(l1 / ng * 100) },
    level2: { count: l2, pct: Math.round(l2 / ng * 100) },
    level3: { count: l3, pct: Math.round(l3 / ng * 100) },
    zones: zoneData,
  };
}

// ─── Aggregate scoring ────────────────────────────────────────────────────────

export function aggregateNMQ(allAnswers) {
  const n = allAnswers.length;
  const empty = { count: 0, pct: 0 };
  const emptyRole = { n: 0, level1: empty, level2: empty, level3: empty, zones: [] };
  if (n === 0) {
    return {
      zones: [], level1: empty, level2: empty, level3: empty,
      prevalence: empty,
      byRole: { production: emptyRole, office: emptyRole, unknown: emptyRole },
      n,
    };
  }

  // Zone bar chart data
  const zones = BODY_ZONES.map((zone, zi) => {
    let c12 = 0, cImp = 0, c7 = 0;
    for (const a of allAnswers) {
      const s = scoreNMQ(a);
      if (s[zi].q12) c12++;
      if (s[zi].qImp) cImp++;
      if (s[zi].q7) c7++;
    }
    return {
      zone,
      count12: c12,
      pct12: Math.round(c12 / n * 100),
      pctImp: c12 > 0 ? Math.round(cImp / c12 * 100) : 0,
      pct7: Math.round(c7 / n * 100),
    };
  }).sort((a, b) => b.pct12 - a.pct12);

  // 3-level classification
  const levels = allAnswers.map(classifyNMQ);
  const l1 = levels.filter(l => l === 1).length;
  const l2 = levels.filter(l => l === 2).length;
  const l3 = levels.filter(l => l === 3).length;

  // Prevalenza generica (almeno 1 sì alla domanda A)
  const prevCount = allAnswers.filter(a => scoreNMQ(a).some(z => z.q12)).length;

  // By role
  const roleGroups = { production: [], office: [], unknown: [] };
  for (const a of allAnswers) {
    const key = a.role === 'production' || a.role === 'office' ? a.role : 'unknown';
    roleGroups[key].push(a);
  }

  return {
    zones,
    level1: { count: l1, pct: Math.round(l1 / n * 100) },
    level2: { count: l2, pct: Math.round(l2 / n * 100) },
    level3: { count: l3, pct: Math.round(l3 / n * 100) },
    prevalence: { count: prevCount, pct: Math.round(prevCount / n * 100) },
    byRole: {
      production: aggregateRoleGroup(roleGroups.production),
      office: aggregateRoleGroup(roleGroups.office),
      unknown: aggregateRoleGroup(roleGroups.unknown),
    },
    n,
  };
}

// ─── Stratificazione OSSERVATA (fonte omogenea per il confronto T0↔T12) ────────
// % L1/L2/L3 + N della coorte, da risposte NMQ grezze, con la STESSA strumentazione
// usata ovunque (aggregateNMQ → classifyNMQ → computeLevel: stessa definizione di L1).
// Va usata ai DUE capi del confronto anno-su-anno: T0 = risposte CONGELATE dell'assessment
// iniziale (tabella responses), T12 = nmq_data CONGELATI dei re-assessment (reassessments_t12).
// MAI patients.level: quello deriva col trattamento e falserebbe il confronto (undercount L1).
export function stratificazioneOsservata(answers) {
  const a = aggregateNMQ(answers || []);
  return { l1pct: a.level1.pct, l2pct: a.level2.pct, l3pct: a.level3.pct, n: a.n };
}

// ─── Traffic light ────────────────────────────────────────────────────────────
// NMQ usa % Livello 1: verde <20%, giallo 20-40%, rosso >40%

export function trafficLight(type, value) {
  const v = parseFloat(value);
  if (type === 'nmq') return v > 40 ? 'red' : v >= 20 ? 'yellow' : 'green';
  return 'gray';
}

export function generateSummaryText(nmq) {
  const l1pct = nmq.level1?.pct ?? 0;
  const l2pct = nmq.level2?.pct ?? 0;
  const nmqColor = trafficLight('nmq', l1pct);
  const topZone = nmq.zones[0];
  const zoneTxt = topZone ? `${topZone.zone} (${topZone.pct12}%)` : 'non rilevata';
  if (nmqColor === 'red') {
    return `Il ${l1pct}% dei dipendenti presenta disturbi muscolo-scheletrici con impatto funzionale (Livello 1) e necessita di trattamento osteopatico. Un ulteriore ${l2pct}% è in Livello 2 (dolore senza impatto, da monitorare). La zona più critica è ${zoneTxt}.`;
  }
  if (nmqColor === 'yellow') {
    return `Il ${l1pct}% dei dipendenti è in Livello 1 (disturbi con impatto funzionale, candidati al trattamento), il ${l2pct}% in Livello 2 (da monitorare). La zona più colpita è ${zoneTxt}.`;
  }
  return `Il ${l1pct}% dei dipendenti è in Livello 1 (trattamento) e il ${l2pct}% in Livello 2 (monitoraggio). La popolazione mostra un quadro muscolo-scheletrico complessivamente buono; zona prioritaria: ${zoneTxt}.`;
}

export const TL_COLOR = { green: '#16a34a', yellow: '#ca8a04', red: '#dc2626', gray: '#9ca3af' };
export const TL_BG = { green: '#f0fdf4', yellow: '#fefce8', red: '#fef2f2', gray: '#f9fafb' };
export const TL_BORDER = { green: '#bbf7d0', yellow: '#fde68a', red: '#fecaca', gray: '#e5e7eb' };

export const TYPE_LABELS = {
  initial: 'Assessment iniziale',
  '3month': 'Checkpoint 3 mesi',
  '6month': 'Review 6 mesi',
  final: 'Assessment finale',
};

export const TYPE_COLORS = {
  initial: '#16a34a',
  '3month': '#ca8a04',
  '6month': '#2563eb',
  final: '#7c3aed',
};
