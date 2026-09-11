// ─────────────────────────────────────────────────────────────────────────────
// Offerta dopo il check-up — FONTE UNICA dei numeri per Offerta, Presentazione del
// Report e Sintesi (punto 7): stesso prezzo, stessa forbice, stessa stratificazione.
// Codice spostato qui da pages/dashboard/offer.js (getServerSideProps), invariato.
//   n / l1 / l2: override manuali (query dell'Offerta); custom: tariffe dalla scheda.
// ─────────────────────────────────────────────────────────────────────────────
import { getAssessmentById, getClientById, getResponsesByAssessment, getFirstMeeting } from './store';
import { getPricingSettingsV2 } from './pricing/settings';
import { getForchettaSnapshot } from './pricing/snapshot';
import { aggregateNMQ } from './scoring';
import { calculatePricing, computeForchetta, realL1L2FromAssessment } from './calculator';
import { ergonomiaDaColloquio } from './pricing/v2';
import { CONFIG } from './config';

export async function datiOffertaDaCheckup({ assessmentId, n, l1, l2, custom = null } = {}) {
  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) return null;

  const [client, responses] = await Promise.all([
    getClientById(assessment.client_id),
    getResponsesByAssessment(assessmentId),
  ]);

  const nmq = aggregateNMQ(responses);
  const responders = responses.length;
  const totalN = n ? parseInt(n) : (client?.employees || responders);

  // ── Parametri salvati dalla scheda colloquio ─────────────────────────────
  // Il preventivo post-assessment usa le STESSE condizioni concordate al
  // colloquio (tier, tariffe, IVA, gruppi) con i numeri REALI dell'assessment.
  // Priorità: override in query > parametri scheda > default di config.
  let schedaDefaults = null;
  let forchetta = null; // stima colloquio min/med/max (vista admin, non nel PDF)
  let l2Mult = CONFIG.l2_multiplier_default;
  // Versione listino SEMPRE dal record cliente (mai da query); fail-safe v1.
  const pricingVersion = client?.pricing_version || 'v1';
  const v2Params = pricingVersion === 'v2' ? (await getPricingSettingsV2()).params : null;
  let ergonomiaV2; // input colloquio (Blocco C li scrive in step2); default motore: tutta la popolazione ufficio
  let snap = null;
  try {
    const fm = await getFirstMeeting(assessment.client_id);
    snap = getForchettaSnapshot(fm);
    const fmd = fm?.data;
    if (fmd) {
      const s2 = fmd.step2 || {};
      const sp = fmd.params || {};
      const sedi = Array.isArray(s2.sedi) ? s2.sedi : [];
      const cap = Math.max(1, parseInt(s2.capienza) || CONFIG.classroom_capacity_default);
      const fmN = sedi.reduce((a, e) => a + (parseInt(e.employees) || 0), 0) || totalN;
      const fmGroups = s2.training_mode === 'accorpa'
        ? Math.max(1, Math.ceil(fmN / cap))
        : (sedi.reduce((a, e) => a + Math.ceil((parseInt(e.employees) || 0) / cap), 0) || Math.max(1, Math.ceil(totalN / cap)));
      schedaDefaults = {
        tier: s2.tier || undefined,
        groups: fmGroups,
        rates: sp.rates || undefined,
        vatExempt: sp.vat_exempt,
      };
      // Forchetta del colloquio (SORGENTE UNICA computeForchetta) per il confronto
      // dentro/fuori — vista admin, non nel PDF cliente.
      const sectorKey = fmd.step1?.sector || (client?.sector === 1 ? 'manufacturing' : 'services');
      l2Mult = sp.l2_mult != null ? Number(sp.l2_mult) : CONFIG.l2_multiplier_default;
      // Lettura unica (lib/pricing/v2): stessi numeri della Stima e del Report.
      ergonomiaV2 = ergonomiaDaColloquio(s2, fmN);
      const fch = computeForchetta({ n: fmN, sector: sectorKey, l2Mult, pricingVersion, v2Params, ergonomia: ergonomiaV2, ...schedaDefaults });
      if (fch.min.price_y1 != null) forchetta = { min: fch.min.price_y1, avg: fch.avg.price_y1, max: fch.max.price_y1 };
    }
  } catch (_) {}

  // Precedenza: SNAPSHOT (promessa congelata) → live. Se lo snapshot esiste, il
  // banner confronta il prezzo reale (parametri snapshottati) contro la forbice
  // PERSISTITA — coerente col flag quote_compliance del Report.
  const usableSnap = snap && snap.forchetta;
  const si = usableSnap ? (snap.inputs || {}) : null;
  const nBasis = usableSnap ? (parseInt(si.n) || totalN) : totalN;
  const l2MultBasis = usableSnap ? (si.l2Mult != null ? Number(si.l2Mult) : l2Mult) : l2Mult;
  const v2ParamsBasis = usableSnap ? snap.v2Params : v2Params;
  const ergBasis = usableSnap ? si.ergonomia : ergonomiaV2;
  const condBasis = usableSnap
    ? { tier: si.tier, groups: si.groups, rates: si.rates, vatExempt: si.vatExempt }
    : (custom || schedaDefaults);
  if (usableSnap) forchetta = { min: snap.forchetta.min?.price_y1, avg: snap.forchetta.avg?.price_y1, max: snap.forchetta.max?.price_y1 };

  // "Prezzo reale" OMOGENEO con la forbice: prevalenza L1 osservata × forza
  // lavoro (snapshottata se presente), L2 derivato. Override manuale via query l1/l2.
  const auto = realL1L2FromAssessment({ l1Responders: nmq.level1.count, responders, employees: nBasis, l2Mult: l2MultBasis, pricingVersion, v2Params: v2ParamsBasis });
  const l1v = l1 !== undefined ? parseInt(l1) : auto.l1;
  const l2v = l2 !== undefined ? parseInt(l2) : auto.l2;

  const calc = calculatePricing({ n: nBasis, l1: l1v, l2: l2v, pricingVersion, v2Params: v2ParamsBasis, ergonomia: ergBasis, ...(condBasis || {}) });

  return { client, assessment: { ...assessment, n: responses.length }, nmq, calc, forchetta, responders };
}
