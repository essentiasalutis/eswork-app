import test from 'node:test';
import assert from 'node:assert/strict';
import { prezzoConTetto, applicaTettoAlCalcolo, STATI } from '../lib/forbice.mjs';

// Il massimo promesso è il massimo: la forbice è l'unica promessa economica
// fatta prima del contratto. Questi test restano a guardia della regola.

test('dentro la forbice: il prezzo non si tocca', () => {
  const r = prezzoConTetto({ calcolato: 9000, min: 7000, max: 12000 });
  assert.equal(r.prezzo, 9000);
  assert.equal(r.stato, STATI.DENTRO);
  assert.equal(r.capApplicato, false);
});

test('sopra il massimo: si propone il massimo, non il calcolato', () => {
  const r = prezzoConTetto({ calcolato: 15000, min: 7000, max: 12000 });
  assert.equal(r.prezzo, 12000);
  assert.equal(r.stato, STATI.CAPATO);
  assert.equal(r.scostamento, 3000);
  assert.equal(r.calcolato, 15000, 'il dimensionamento reale non si perde: serve al rinnovo');
});

test('esattamente al massimo: dentro, nessun tetto', () => {
  const r = prezzoConTetto({ calcolato: 12000, min: 7000, max: 12000 });
  assert.equal(r.stato, STATI.DENTRO);
  assert.equal(r.prezzo, 12000);
});

test('con autorizzazione si supera, ma lo stato lo dice', () => {
  const r = prezzoConTetto({ calcolato: 15000, min: 7000, max: 12000, autorizzato: true });
  assert.equal(r.prezzo, 15000);
  assert.equal(r.stato, STATI.SOPRA_AUTORIZZATO);
  assert.equal(r.scostamento, 3000);
});

test('nessuna Stima emessa: nessuna promessa, nessun tetto — e si distingue da «dentro»', () => {
  const r = prezzoConTetto({ calcolato: 15000, max: null });
  assert.equal(r.prezzo, 15000);
  assert.equal(r.stato, STATI.NESSUNA_FORBICE);
  assert.notEqual(r.stato, STATI.DENTRO, 'le due situazioni non vanno confuse a schermo');
});

test('i derivati dell\'Anno 1 seguono il prezzo capato', () => {
  const r = prezzoConTetto({ calcolato: 24000, min: 7000, max: 12000 });
  const calc = { n: 100, price_y1: 24000, price_monthly_y1: 2000, price_per_employee_y1: 240, y1: { total_sell: 24000, total_with_vat: 29280 }, price_y2: 9000 };
  const out = applicaTettoAlCalcolo(calc, r);
  assert.equal(out.price_y1, 12000);
  assert.equal(out.price_monthly_y1, 1000);
  assert.equal(out.price_per_employee_y1, 120);
  assert.equal(out.y1.total_sell, 12000);
  assert.equal(out.y1.total_with_vat, 14640);
  assert.equal(out.price_y2, 9000, 'l\'Anno 2 non è capato: è un\'altra trattativa');
  assert.equal(out.tetto.calcolato, 24000);
});

test('senza tetto applicato il calcolo resta identico', () => {
  const r = prezzoConTetto({ calcolato: 9000, min: 7000, max: 12000 });
  const calc = { n: 100, price_y1: 9000 };
  assert.equal(applicaTettoAlCalcolo(calc, r), calc);
});
