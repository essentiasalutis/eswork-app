// GET /api/admin/pricing-regression/[clientId] — snapshot COMPLETO e di SOLA
// LETTURA dei numeri pricing correnti di un cliente: forchetta (tutti i campi),
// prezzo reale, calculatePricing completo e il compliance autoritativo del
// percorso di produzione (buildQuoteBlock). Baseline/verifica di regressione per
// il versionamento v1/v2: stessi input → output identici al centesimo.
// Nessuna scrittura: solo SELECT via store. Solo admin.
import { requireAuth } from '../../../../lib/auth';
import { getClientById, getFirstMeeting, getResponsesForClient } from '../../../../lib/store';
import { aggregateNMQ } from '../../../../lib/scoring';
import { computeForchetta, realL1L2FromAssessment, calculatePricing } from '../../../../lib/calculator';
import { CONFIG } from '../../../../lib/config';
import { buildQuoteBlock } from '../../clients/[id]/generate-activation-report';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { clientId } = req.query;
  try {
    const client = await getClientById(clientId);
    if (!client) return res.status(404).json({ error: 'cliente non trovato' });
    const responses = await getResponsesForClient(clientId).catch(() => ({}));
    // Array piatto di answers: stessa forma di generate-activation-report.js
    const answers = Object.values((responses && responses.responses) || {}).flat();

    // Risoluzione condizioni IDENTICA a buildQuoteBlock (il percorso che
    // persiste il flag) — replicata qui SOLO per esporre gli oggetti completi;
    // il compliance confrontato come autoritativo esce da buildQuoteBlock vero.
    const fm = await getFirstMeeting(clientId);
    const fmd = fm?.data || null;
    const s2 = fmd?.step2 || {};
    const sp = fmd?.params || {};
    const cap = Math.max(1, parseInt(s2.capienza) || CONFIG.classroom_capacity_default);
    const responders = answers.length;
    const nEmp = parseInt(client.employees) || responders;
    const sedi = Array.isArray(s2.sedi) ? s2.sedi : [];
    const groups = s2.training_mode === 'accorpa'
      ? Math.max(1, Math.ceil(nEmp / cap))
      : (sedi.reduce((a, e) => a + Math.ceil((parseInt(e.employees) || 0) / cap), 0) || Math.max(1, Math.ceil(nEmp / cap)));
    const conditions = { tier: s2.tier || undefined, groups, rates: sp.rates || undefined, vatExempt: sp.vat_exempt };
    const sectorKey = fmd?.step1?.sector || (client.sector === 1 ? 'manufacturing' : 'services');
    const l2Mult = sp.l2_mult != null ? Number(sp.l2_mult) : CONFIG.l2_multiplier_default;

    // Versione dal record cliente (fail-safe v1) — NON entra in computed.inputs:
    // la shape confrontata con la baseline resta invariata.
    const pricingVersion = client.pricing_version || 'v1';
    const nmq = aggregateNMQ(answers);
    const real = realL1L2FromAssessment({ l1Responders: nmq.level1.count, responders, employees: nEmp, l2Mult, pricingVersion });
    const calc = calculatePricing({ n: nEmp, l1: real.l1, l2: real.l2, pricingVersion, ...conditions });
    const forchetta = computeForchetta({ n: nEmp, sector: sectorKey, l2Mult, pricingVersion, ...conditions });
    const { block, compliance } = await buildQuoteBlock(clientId, client, answers);

    return res.json({
      meta: { clientId, generatedAt: new Date().toISOString() }, // esclusa dal confronto
      computed: {
        inputs: { nEmp, responders, l1Responders: nmq.level1.count, sectorKey, l2Mult, conditions },
        real, calc, forchetta, compliance, block,
      },
    });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});
