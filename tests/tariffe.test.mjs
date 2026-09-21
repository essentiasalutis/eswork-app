// Stima senza tariffe (Enrico, 21/9): si rifiuta e dice quale manca; nessun ripiego
// silenzioso su quelle standard; nessuno scenario a zero arriva a un documento.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tariffeMancanti, messaggioTariffe, scenariValidi } from '../lib/tariffe.mjs';

const piene = { sportello_sell: 120, sportello_cost: 60, prevalidation_sell: 30, prevalidation_cost: 15, training_sell: 250, training_cost: 100 };

test('tariffe complete: nessuna mancante', () => {
  assert.deepEqual(tariffeMancanti(piene), []);
  assert.deepEqual(tariffeMancanti({ ...piene, sportello_sell: '120' }), [], 'dall\'indirizzo arrivano stringhe numeriche');
});

test('assenti, vuote, a zero, non numeriche: tutte mancanti, per nome', () => {
  assert.equal(tariffeMancanti(undefined).length, 6, 'nessun ripiego sulle standard');
  assert.equal(tariffeMancanti({}).length, 6, 'l\'elenco vuoto che dava €0');
  assert.deepEqual(tariffeMancanti({ ...piene, sportello_sell: 0 }), ['sportello, vendita (€/ora)']);
  assert.deepEqual(tariffeMancanti({ ...piene, training_cost: '' }), ['formazione, costo (a modulo)']);
  assert.deepEqual(tariffeMancanti({ ...piene, prevalidation_sell: 'abc', prevalidation_cost: -5 }), ['pre-validazione, vendita', 'pre-validazione, costo']);
  assert.deepEqual(tariffeMancanti({ ...piene, sportello_cost: null }), ['sportello, costo (€/ora)']);
  assert.match(messaggioTariffe(['sportello, vendita (€/ora)']), /^Tariffe mancanti o a zero: sportello, vendita/);
});

test('scenari: nessuno a zero o non numerico', () => {
  const f = (a, b, c) => ({ min: { price_y1: a }, avg: { price_y1: b }, max: { price_y1: c } });
  assert.equal(scenariValidi(f(41120, 54620, 68120)), true);
  assert.equal(scenariValidi(f(0, 0, 0)), false);
  assert.equal(scenariValidi(f(41120, NaN, 68120)), false);
  assert.equal(scenariValidi(null), false);
});

test('la Stima controlla le tariffe prima di scrivere qualunque cosa', () => {
  const src = fs.readFileSync('pages/api/stima.js', 'utf8');
  const controllo = src.indexOf('tariffeMancanti(b.rates)');
  assert.ok(controllo > 0);
  for (const scrittura of ['applySnapshot({', 'avanzaPipeline(', 'generateAndStorePdf(']) {
    assert.ok(controllo < src.indexOf(scrittura, src.indexOf('export default')), `${scrittura} dopo il controllo`);
  }
  assert.ok(src.indexOf('scenariValidi(forchetta)') < src.lastIndexOf('applySnapshot({'), 'il risultato si controlla prima di impegnare la forbice');
});

test('l\'Offerta non legge più tariffe né numeri stimati dall\'indirizzo', () => {
  const src = fs.readFileSync('pages/dashboard/offer.js', 'utf8');
  for (const via of ['readPricingParams', 'q.rs', 'syntheticNmq', 'estimate: true', 'custom']) assert.ok(!src.includes(via), via);
  assert.ok(!fs.readFileSync('lib/offerta-server.js', 'utf8').includes('custom'));
});
