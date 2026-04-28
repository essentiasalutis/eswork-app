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

export const PSS_QUESTIONS = [
  { t: "Nell'ultimo mese, quanto spesso ti sei sentito/a turbato/a per qualcosa accaduto inaspettatamente?", r: false },
  { t: 'Quanto spesso hai sentito di non riuscire a controllare le cose importanti della tua vita?', r: false },
  { t: 'Quanto spesso ti sei sentito/a nervoso/a o stressato/a?', r: false },
  { t: 'Quanto spesso ti sei sentito/a sicuro/a della tua capacità di gestire i problemi personali?', r: true },
  { t: 'Quanto spesso hai sentito che le cose andavano come volevi?', r: true },
  { t: 'Quanto spesso hai sentito di non riuscire a far fronte a tutto ciò che dovevi fare?', r: false },
  { t: 'Quanto spesso sei riuscito/a a controllare le fonti di irritazione nella tua vita?', r: true },
  { t: 'Quanto spesso hai sentito di avere il controllo della situazione?', r: true },
  { t: 'Quanto spesso ti sei arrabbiato/a per cose fuori dal tuo controllo?', r: false },
  { t: 'Quanto spesso hai sentito che le difficoltà si accumulavano al punto da non superarle?', r: false },
];

export const UWES_QUESTIONS = [
  { t: 'Al lavoro mi sento pieno/a di energia.', d: 'Vigore' },
  { t: 'Il mio lavoro mi fa sentire forte e vigoroso/a.', d: 'Vigore' },
  { t: 'Sono entusiasta del mio lavoro.', d: 'Dedizione' },
  { t: 'Il mio lavoro mi ispira.', d: 'Dedizione' },
  { t: 'Quando mi alzo la mattina, ho voglia di andare al lavoro.', d: 'Vigore' },
  { t: 'Mi sento felice quando lavoro intensamente.', d: 'Assorbimento' },
  { t: 'Sono orgoglioso/a del lavoro che faccio.', d: 'Dedizione' },
  { t: 'Sono immerso/a nel mio lavoro.', d: 'Assorbimento' },
  { t: 'Mi lascio trasportare dal lavoro.', d: 'Assorbimento' },
];

export const PSS_OPTS = ['Mai', 'Quasi mai', 'A volte', 'Abbastanza spesso', 'Molto spesso'];
export const UWES_OPTS = ['Mai', 'Quasi mai', 'Raramente', 'A volte', 'Spesso', 'Molto spesso', 'Sempre'];

// ─── Individual scoring ───────────────────────────────────────────────────────

export function scoreNMQ(answers) {
  return BODY_ZONES.map((zone, zi) => ({
    zone,
    q12: answers[`nmq_${zi}_0`] === 1,
    qImp: answers[`nmq_${zi}_1`] === 1,
    q7: answers[`nmq_${zi}_2`] === 1,
  }));
}

export function scorePSS(answers) {
  return PSS_QUESTIONS.reduce((sum, q, i) => {
    const v = answers[`pss_${i}`] ?? 0;
    return sum + (q.r ? 4 - v : v);
  }, 0);
}

export function scoreUWES(answers) {
  const dims = { Vigore: [0, 1, 4], Dedizione: [2, 3, 6], Assorbimento: [5, 7, 8] };
  const result = {};
  let total = 0, count = 0;
  for (const [dim, idx] of Object.entries(dims)) {
    const vals = idx.map(i => answers[`uwes_${i}`] ?? 0);
    result[dim] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10;
    total += vals.reduce((a, b) => a + b, 0);
    count += vals.length;
  }
  result.total = Math.round(total / count * 10) / 10;
  return result;
}

// ─── Classificazione NMQ a 3 livelli ─────────────────────────────────────────
//
// Livello 1 — Trattamento (basta UNO):
//   • qImp in almeno 1 zona
//   • q7 in almeno 2 zone
//
// Livello 2 — Prevenzione (NON L1, basta UNO):
//   • q12 in 3+ zone
//   • q7 in esattamente 1 zona
//
// Livello 3 — Solo formazione: tutti gli altri

function classifyNMQ(answers) {
  const s = scoreNMQ(answers);
  const hasImp = s.some(z => z.qImp);
  const count7 = s.filter(z => z.q7).length;
  if (hasImp || count7 >= 2) return 1;
  const count12 = s.filter(z => z.q12).length;
  if (count12 >= 3 || count7 === 1) return 2;
  return 3;
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
    return { zone, pct12: Math.round(c12 / ng * 100) };
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

export function aggregatePSS(allAnswers) {
  const n = allAnswers.length;
  if (n === 0) return { mean: 0, low: 0, mod: 0, high: 0, highCount: 0, n };
  const scores = allAnswers.map(scorePSS);
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const low = scores.filter(s => s <= 13).length;
  const mod = scores.filter(s => s >= 14 && s <= 26).length;
  const high = scores.filter(s => s >= 27).length;
  return {
    mean: Math.round(mean * 10) / 10,
    low: Math.round(low / n * 100),
    mod: Math.round(mod / n * 100),
    high: Math.round(high / n * 100),
    highCount: high,
    n,
  };
}

export function aggregateUWES(allAnswers) {
  const n = allAnswers.length;
  if (n === 0) return { mean: 0, vigore: 0, dedizione: 0, assorbimento: 0, n };
  const scores = allAnswers.map(scoreUWES);
  return {
    mean: Math.round(scores.reduce((a, b) => a + b.total, 0) / n * 10) / 10,
    vigore: Math.round(scores.reduce((a, b) => a + b.Vigore, 0) / n * 10) / 10,
    dedizione: Math.round(scores.reduce((a, b) => a + b.Dedizione, 0) / n * 10) / 10,
    assorbimento: Math.round(scores.reduce((a, b) => a + b.Assorbimento, 0) / n * 10) / 10,
    n,
  };
}

export function aggregateENPS(allAnswers) {
  const n = allAnswers.length;
  if (n === 0) return { score: 0, promoters: 0, passives: 0, detractors: 0, n };
  const vals = allAnswers.map(a => a.enps ?? 0);
  const prom = vals.filter(v => v >= 9).length;
  const pass = vals.filter(v => v >= 7 && v <= 8).length;
  const det = vals.filter(v => v <= 6).length;
  return {
    score: Math.round((prom / n - det / n) * 100),
    promoters: Math.round(prom / n * 100),
    passives: Math.round(pass / n * 100),
    detractors: Math.round(det / n * 100),
    n,
  };
}

// ─── Traffic light ────────────────────────────────────────────────────────────
// NMQ usa % Livello 1: verde <20%, giallo 20-40%, rosso >40%

export function trafficLight(type, value) {
  const v = parseFloat(value);
  if (type === 'nmq') return v > 40 ? 'red' : v >= 20 ? 'yellow' : 'green';
  if (type === 'pss') return v > 20 ? 'red' : v >= 14 ? 'yellow' : 'green';
  if (type === 'uwes') return v < 2.5 ? 'red' : v < 4.5 ? 'yellow' : 'green';
  if (type === 'enps') return v < 0 ? 'red' : v < 20 ? 'yellow' : 'green';
  return 'gray';
}

export function generateSummaryText(nmq, pss, uwes, enps) {
  const lines = [];
  const l1pct = nmq.level1?.pct ?? 0;
  const nmqColor = trafficLight('nmq', l1pct);
  const topZone = nmq.zones[0];
  if (nmqColor === 'red') {
    lines.push(`Il ${l1pct}% dei dipendenti necessita di intervento osteopatico diretto (Livello 1 — problemi con impatto funzionale). La zona più critica è ${topZone?.zone || 'non rilevata'} (${topZone?.pct12 || 0}%).`);
  } else if (nmqColor === 'yellow') {
    lines.push(`Il ${l1pct}% dei dipendenti è in Livello 1 (intervento diretto). La zona più colpita è ${topZone?.zone || 'non rilevata'} (${topZone?.pct12 || 0}%).`);
  } else {
    lines.push(`Il ${l1pct}% dei dipendenti è classificato Livello 1 (trattamento), con ${topZone?.zone || 'schiena'} come area prioritaria.`);
  }
  if (pss) {
    const pssColor = trafficLight('pss', pss.mean);
    if (pssColor === 'red') lines.push(`Lo stress percepito è elevato (PSS-10 medio ${pss.mean}/40): ${pss.high}% dei dipendenti è in fascia critica.`);
    else if (pssColor === 'yellow') lines.push(`Lo stress percepito è moderato (PSS-10 medio ${pss.mean}/40): ${pss.mod}% in fascia moderata.`);
    else lines.push(`Lo stress percepito è nella norma (PSS-10 medio ${pss.mean}/40).`);
  }
  const uwesColor = trafficLight('uwes', uwes.mean);
  if (uwesColor === 'red') lines.push(`L'engagement è basso (UWES-9: ${uwes.mean}/6): priorità di intervento su motivazione e benessere organizzativo.`);
  else if (uwesColor === 'yellow') lines.push(`L'engagement è nella media (UWES-9: ${uwes.mean}/6).`);
  else lines.push(`L'engagement è buono (UWES-9: ${uwes.mean}/6).`);
  const enpsColor = trafficLight('enps', enps.score);
  if (enpsColor === 'red') lines.push(`Il clima aziendale è critico (eNPS ${enps.score > 0 ? '+' : ''}${enps.score}): ${enps.detractors}% di detrattori richiede attenzione immediata.`);
  else if (enpsColor === 'yellow') lines.push(`Il clima aziendale è nella media (eNPS ${enps.score > 0 ? '+' : ''}${enps.score}).`);
  else lines.push(`Il clima aziendale è positivo (eNPS +${enps.score}): ${enps.promoters}% di promotori.`);
  return lines.join(' ');
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
