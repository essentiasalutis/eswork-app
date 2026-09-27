// Prezzo dopo il check-up (Enrico, 27/9): rispetta SEMPRE i numeri osservati; forbice e
// tetto solo con una Stima registrata; l'Anno 2 spiegato solo con frasi vere.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { realL1L2FromAssessment, computeForchetta } from '../lib/pricing/v2.js';
import { spiegazioneAnno2, fraseRiduzioneAnno2, FRASE_ANNO2_CON_TETTO } from '../lib/anno2.mjs';

const src = f => fs.readFileSync(f, 'utf8');
const RATES = { training_cost: 100, training_sell: 250, sportello_cost: 60, sportello_sell: 120, prevalidation_cost: 15, prevalidation_sell: 30 };

test('Livello 2 dalle risposte, non dal moltiplicatore (Weisoft: 6 su 9 → 8 su 12)', () => {
  const r = realL1L2FromAssessment({ l1Responders: 2, l2Responders: 6, responders: 9, employees: 12, l2Mult: 2 });
  assert.equal(r.l1, 3);
  assert.equal(r.l2, 8);
});

test('senza il conteggio del Livello 2 il calcolo si ferma e lo dice', () => {
  assert.throws(() => realL1L2FromAssessment({ l1Responders: 2, responders: 9, employees: 12 }), e => e.name === 'NumeriCheckupMancanti');
});

test('mai più persone della popolazione, né dopo il check-up né nella Stima', () => {
  const r = realL1L2FromAssessment({ l1Responders: 3, l2Responders: 3, responders: 6, employees: 5 });
  assert.ok(r.l1 + r.l2 <= 5);
  const f = computeForchetta({ n: 10, sector: 'services', groups: 1, rates: RATES, vatExempt: true, l2Mult: 5 });
  for (const s of ['min', 'avg', 'max']) assert.ok(f[s].l1 + f[s].l2 <= 10, s);
});

test('ogni prezzo dopo il check-up passa il Livello 2 osservato; nessun numero dall\'indirizzo', () => {
  for (const f of ['lib/offerta-server.js', 'pages/api/clients/[id]/generate-activation-report.js', 'pages/api/admin/pricing-regression/[clientId].js']) {
    assert.match(src(f), /realL1L2FromAssessment\(\{ l1Responders: nmq\.level1\.count, l2Responders: nmq\.level2\.count,/, f);
  }
  assert.match(src('lib/offerta-server.js'), /export async function datiOffertaDaCheckup\(\{ assessmentId, n \} = \{\}\)/);
  for (const f of ['pages/dashboard/offer.js', 'pages/api/clients/[id]/offerta.js', 'lib/sconto-server.js']) {
    assert.ok(!/query\?\.l1|b\.l1|l1: b\.|, l1, l2/.test(src(f)), f);
  }
});

test('forbice e tetto solo da una Stima registrata', () => {
  const offerta = src('lib/offerta-server.js');
  assert.ok(!/computeForchetta/.test(offerta), 'l\'Offerta non ricalcola una forbice dalla scheda');
  assert.match(offerta, /if \(usableSnap\) forchetta = \{/);
  const report = src('pages/api/clients/[id]/generate-activation-report.js');
  assert.ok(!/computeForchetta/.test(report), 'il Report non ricalcola una forbice dalla scheda');
  assert.match(report, /min = null; avg = null; max = null;/);
});

test('l\'avviso sullo scarto del Livello 2 non esiste più (il prezzo usa i numeri osservati)', () => {
  for (const f of ['lib/offerta.js', 'lib/presentazione-server.js', 'pages/dashboard/offer.js', 'pages/dashboard/presentazione/[clientId].js', 'lib/org.js', 'pages/dashboard/pricing-v2.js']) {
    assert.ok(!/scartoLivello2|scarto_l2_soglia|scartoL2/.test(src(f)), f);
  }
});

test('Anno 2: il motivo del calo è quello vero, e con il tetto la frase approvata', () => {
  assert.equal(fraseRiduzioneAnno2({ y1: { ergonomia: { sell: 120 } } }), 'Si riduce rispetto all\'Anno 1 perché l\'analisi ergonomica è già fatta e la formazione passa a un modulo.');
  assert.equal(fraseRiduzioneAnno2({ y1: {} }), 'Si riduce rispetto all\'Anno 1 perché la formazione passa a un modulo.');
  const tetto = spiegazioneAnno2({ calc: { price_y1: 4100, price_y2: 4630, y1: {} }, conTetto: true });
  assert.ok(tetto.endsWith(FRASE_ANNO2_CON_TETTO));
  const sconto = spiegazioneAnno2({ calc: { price_y1: 4000, price_y2: 4630, y1: {} } });
  assert.ok(!/Si riduce|entro la Stima/.test(sconto), 'con un prezzo scontato nessun motivo inventato');
  assert.ok(!/fase intensiva iniziale di trattamento è già stata completata/.test(src('pages/dashboard/offer.js')));
});

test('riservatezza: nel prezzo niente quote né persone di un livello nascosto', () => {
  const report = src('pages/api/clients/[id]/generate-activation-report.js');
  assert.ok(!/const obsPct = /.test(report), 'la quota del Livello 1 non si scrive senza controllo');
  assert.match(report, /const vis = k => !!\(partLiv && !partLiv\[k\]\.suppressed\);/);
  // L'Offerta non scrive più le persone dell'Anno 2: la frase è quella della presentazione.
  assert.ok(!/pop_y2/.test(src('pages/dashboard/offer.js')));
});
