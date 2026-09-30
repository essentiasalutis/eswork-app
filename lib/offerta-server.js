// ─────────────────────────────────────────────────────────────────────────────
// Offerta dopo il check-up — FONTE UNICA dei numeri per Offerta e Presentazione del
// Report (punto 7): stesso prezzo, stessa forbice, stessa stratificazione.
// Codice spostato qui da pages/dashboard/offer.js (getServerSideProps), invariato.
//   n / l1 / l2: override manuali (query dell'Offerta). Le tariffe vengono solo dalla
//   Stima congelata o dalla scheda del colloquio, mai dall'indirizzo (21/9).
// ─────────────────────────────────────────────────────────────────────────────
import { getAssessmentById, getClientById, getResponsesByAssessment, getFirstMeeting, contaSchedeColloquio, messaggioSchedeDoppie } from './store';
import { getPricingSettingsV2 } from './pricing/settings';
import { getForchettaSnapshot } from './pricing/snapshot';
import { aggregateNMQ } from './scoring';
import { calculatePricing, realL1L2FromAssessment } from './calculator';
import { ergonomiaDaColloquio } from './pricing/v2';
import { CONFIG } from './config';
import { prezzoConTetto, applicaTettoAlCalcolo, posizioneNellaForbice } from './forbice.mjs';
import { parametriDaStimaCongelata, DEFAULTS_V2 } from './pricing/v2-defaults.mjs';
import { statoScontoCliente, applicaScontoAlCalcolo, avvisoRevisioneForbice, margine } from './sconto.mjs';
import { tariffeMancanti, messaggioTariffeDove } from './tariffe.mjs';

// Dopo il check-up il prezzo rispetta i numeri osservati (Enrico, 27/9): Livello 1 e
// Livello 2 si prendono SOLO dalle risposte. Tolto l'override di l1/l2 dall'indirizzo o
// dal corpo della richiesta: nessun link lo usava e permetteva di scavalcare i numeri.
export async function datiOffertaDaCheckup({ assessmentId, n } = {}) {
  // Un valore ASSENTE può arrivare come undefined (query) o come null/'' (JSON di una POST).
  const vuoto = (v) => v === undefined || v === null || v === '';
  if (vuoto(n)) n = undefined;
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
  // Priorità: Stima congelata > scheda del colloquio. Nessuna tariffa di riserva (21/9).
  let schedaDefaults = null;
  let forchetta = null; // forbice della Stima REGISTRATA (min/med/max), altrimenti nessuna
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
      // Il moltiplicatore serve solo al listino v1 (congelato): nel v2 il Livello 2 viene
      // dalle risposte.
      l2Mult = sp.l2_mult != null ? Number(sp.l2_mult) : CONFIG.l2_multiplier_default;
      // Lettura unica (lib/pricing/v2): stessi numeri della Stima e del Report.
      ergonomiaV2 = ergonomiaDaColloquio(s2, fmN);
      // Forbice e tetto SOLO da una Stima registrata (Enrico, 27/9): la forbice che si
      // ricalcola dalla scheda non è stata promessa a nessuno e non limita il prezzo.
    }
  } catch (_) {}

  // Precedenza: SNAPSHOT (promessa congelata) → live. Se lo snapshot esiste, il
  // banner confronta il prezzo reale (parametri snapshottati) contro la forbice
  // PERSISTITA — coerente col flag quote_compliance del Report.
  const usableSnap = snap && snap.forchetta;
  const si = usableSnap ? (snap.inputs || {}) : null;
  const nBasis = usableSnap ? (parseInt(si.n) || totalN) : totalN;
  const l2MultBasis = usableSnap ? (si.l2Mult != null ? Number(si.l2Mult) : l2Mult) : l2Mult;
  // Stima congelata prima della quota «Programma, misurazione e regia»: la quota vale zero.
  const v2ParamsBasis = usableSnap ? parametriDaStimaCongelata(snap.v2Params) : v2Params;
  const ergBasis = usableSnap ? si.ergonomia : ergonomiaV2;
  const condBasis = usableSnap
    ? { tier: si.tier, groups: si.groups, rates: si.rates, vatExempt: si.vatExempt }
    : schedaDefaults;
  if (usableSnap) forchetta = { min: snap.forchetta.min?.price_y1, avg: snap.forchetta.avg?.price_y1, max: snap.forchetta.max?.price_y1 };

  // Prezzo reale: le persone di Livello 1 e 2 trovate dal check-up (30/9, non più
  // riportate su tutti i dipendenti). Mai numeri presi da fuori.
  const real = realL1L2FromAssessment({ l1Responders: nmq.level1.count, l2Responders: nmq.level2.count, responders, employees: nBasis, l2Mult: l2MultBasis, pricingVersion, v2Params: v2ParamsBasis });
  const l1v = real.l1;
  const l2v = real.l2;

  // Tariffe (Enrico, 21/9): dalla Stima congelata o dalla scheda del colloquio, mai
  // di riserva. Se mancano, l'Offerta — e con lei Presenta e prezzo applicato
  // — si rifiuta e dice dove mancano.
  const mancantiTariffe = tariffeMancanti(condBasis && condBasis.rates);
  if (mancantiTariffe.length) {
    if (!usableSnap && !schedaDefaults) {
      const nSchede = await contaSchedeColloquio(assessment.client_id).catch(() => 0);
      if (nSchede > 1) return { errore: messaggioSchedeDoppie(nSchede, client?.name), client, assessment: { ...assessment, n: responses.length } };
    }
    const dove = usableSnap ? 'nella Stima congelata' : schedaDefaults ? 'nella scheda del colloquio' : 'nella scheda del colloquio (non compilata)';
    return { errore: messaggioTariffeDove(mancantiTariffe, `${dove} di ${client?.name || 'questa azienda'}`), client, assessment: { ...assessment, n: responses.length } };
  }

  const calcPieno = calculatePricing({ n: nBasis, l1: l1v, l2: l2v, pricingVersion, v2Params: v2ParamsBasis, ergonomia: ergBasis, ...(condBasis || {}) });

  // IL MASSIMO PROMESSO È IL MASSIMO (Enrico, 14/9): il corrispettivo dell'Anno 1
  // non supera il massimo della forbice della Stima. Si può uscirne, ma solo con
  // una conferma e una motivazione registrate — lo stato le distingue.
  // Senza Stima REGISTRATA non c'è promessa: nessun tetto, prezzo pieno (27/9).
  const autorizzato = !!(client && client.sforamento_forbice_motivo);
  const tetto = prezzoConTetto({
    calcolato: calcPieno ? calcPieno.price_y1 : null,
    min: forchetta ? forchetta.min : null,
    max: forchetta ? forchetta.max : null,
    autorizzato,
  });
  const calcDopoTetto = applicaTettoAlCalcolo(calcPieno, tetto, { contractMonths: CONFIG.contract_months || 12 });

  // PREZZO APPLICATO PIÙ BASSO (lib/sconto.mjs, Enrico 21/9): ultimo anello della
  // stessa catena. Si applica solo se deciso su QUESTO prezzo di partenza; altrimenti
  // è sospeso e va riconfermato. Tocca solo l'Anno 1: il rinnovo resta pieno.
  // La soglia di avviso è una guardia commerciale di OGGI: sempre dal Listino in
  // vigore, mai dai parametri congelati nella Stima (che potrebbero non averla).
  let soglia = DEFAULTS_V2.sconto_margine_avviso_pct;
  try {
    const pv = v2Params || (await getPricingSettingsV2()).params;
    if (pv && pv.sconto_margine_avviso_pct != null && Number.isFinite(Number(pv.sconto_margine_avviso_pct))) soglia = Number(pv.sconto_margine_avviso_pct);
  } catch (_) {}
  const costoAnno1 = calcPieno && calcPieno.y1 ? Math.round(calcPieno.y1.total_cost) : null;
  const prezzoBase = calcDopoTetto ? calcDopoTetto.price_y1 : null;
  const sconto = statoScontoCliente(client, prezzoBase);
  const calc = applicaScontoAlCalcolo(calcDopoTetto, sconto, { contractMonths: CONFIG.contract_months || 12 });
  const posizione = posizioneNellaForbice({ prezzo: calc ? calc.price_y1 : null, min: forchetta ? forchetta.min : null, max: forchetta ? forchetta.max : null, conSconto: sconto.stato === 'attivo' });

  return {
    client, assessment: { ...assessment, n: responses.length }, nmq, calc, forchetta, responders, tetto,
    // Solo per la vista amministratore (mai nei documenti del cliente):
    prezzoBase, costoAnno1, sogliaMargine: soglia, sconto, posizione,
    margineFinale: calc ? margine(calc.price_y1, costoAnno1) : null,
    rinnovoPieno: calcPieno ? calcPieno.price_y2 : null,
    revisioneForbice: calcPieno ? avvisoRevisioneForbice(tetto, costoAnno1, soglia) : null,
  };
}
