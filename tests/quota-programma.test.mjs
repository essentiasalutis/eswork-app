// Quota «Programma, misurazione e regia» (Enrico, 21/9): €1.500 + €15 a dipendente per
// anno di programma, nel prezzo, nella forbice e nel rinnovo; nel Pacchetto solo la
// parte per dipendente; le Stime già congelate non cambiano.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { calculatePricing, computeForchetta, calculatePacchetto } from '../lib/pricing/v2.js';
import { DEFAULTS_V2, parametriDaStimaCongelata } from '../lib/pricing/v2-defaults.mjs';
import { CONFIG } from '../lib/config.js';
// Tariffe standard passate in modo esplicito: il motore non ripiega più da sé (21/9).
const TARIFFE_STANDARD = CONFIG.rates_new;

const PRIMA = { quota_programma_fissa: 0, quota_programma_per_dipendente: 0 };
const cento = (pct, v2Params) => { const l1 = Math.round(100 * pct); return calculatePricing({ rates: TARIFFE_STANDARD, n: 100, l1, l2: l1 * 2, v2Params }); };

test('azienda da 100 al 3% e al 12%: prima e dopo la quota', () => {
  assert.equal(cento(0.03, PRIMA).price_y1, 5700);
  assert.equal(cento(0.03).price_y1, 8700);
  assert.equal(cento(0.03).price_per_employee_y1, 87);
  assert.equal(cento(0.12, PRIMA).price_y1, 13800);
  assert.equal(cento(0.12).price_y1, 16800);
  // rinnovo: la quota si rifà ogni anno
  assert.equal(cento(0.03, PRIMA).price_y2, 3700);
  assert.equal(cento(0.03).price_y2, 6700);
  assert.equal(cento(0.12).price_y2, 14800);
});

test('la quota è una voce propria, fuori dal buffer, con costo al 30%', () => {
  const c = cento(0.12);
  const q = c.y1.items.find(i => i.label === 'Programma, misurazione e regia');
  assert.equal(q.sell, 3000);
  assert.equal(q.cost, 900);
  assert.equal(c.y1.buffer_sell, cento(0.12, PRIMA).y1.buffer_sell, 'il buffer non cambia');
  assert.equal(DEFAULTS_V2.quota_programma_costo_pct, 0.3);
});

test('la forbice include la quota in entrambi gli estremi: il definitivo non la supera', () => {
  for (const sector of ['manufacturing', 'services']) {
    const f = computeForchetta({ rates: TARIFFE_STANDARD, n: 100, sector });
    const fPrima = computeForchetta({ rates: TARIFFE_STANDARD, n: 100, sector, v2Params: PRIMA });
    assert.equal(f.min.price_y1 - fPrima.min.price_y1, 3000);
    assert.equal(f.max.price_y1 - fPrima.max.price_y1, 3000);
    for (const s of [f.min, f.avg, f.max]) {
      const definitivo = calculatePricing({ rates: TARIFFE_STANDARD, n: 100, l1: s.l1, l2: s.l2 }).price_y1;
      assert.ok(definitivo >= f.min.price_y1 && definitivo <= f.max.price_y1, `${sector} ${s.pct}: ${definitivo} dentro ${f.min.price_y1}–${f.max.price_y1}`);
      // senza la quota nella forbice, lo stesso definitivo sfonderebbe il massimo
      if (s === f.max) assert.ok(definitivo > fPrima.max.price_y1);
    }
  }
});

test('Pacchetto da 30: invariato, il check-up è la quota per dipendente, niente quota fissa', () => {
  const p = calculatePacchetto({ rates: TARIFFE_STANDARD, n: 30 });
  assert.equal(p.price, 1750);
  assert.equal(p.assessment.sell, 450);
  assert.equal(p.training.sell, 1000);
  assert.equal(p.ergonomia.sell, 300);
  assert.ok(!p.items.some(i => i.label === 'Programma, misurazione e regia'));
});

test('Stima congelata prima della quota: il prezzo non cambia di un euro', () => {
  const { quota_programma_fissa, quota_programma_per_dipendente, quota_programma_costo_pct, ...vecchi } = DEFAULTS_V2;
  const congelati = parametriDaStimaCongelata(vecchi);
  assert.equal(calculatePricing({ rates: TARIFFE_STANDARD, n: 300, l1: 51, l2: 102, v2Params: congelati }).price_y1, calculatePricing({ rates: TARIFFE_STANDARD, n: 300, l1: 51, l2: 102, v2Params: PRIMA }).price_y1);
  const f = computeForchetta({ rates: TARIFFE_STANDARD, n: 300, sector: 'manufacturing', v2Params: congelati });
  assert.equal(f.max.price_y1, computeForchetta({ rates: TARIFFE_STANDARD, n: 300, sector: 'manufacturing', v2Params: PRIMA }).max.price_y1);
  // una Stima nuova porta la quota con sé
  assert.equal(parametriDaStimaCongelata(DEFAULTS_V2).quota_programma_fissa, 1500);
});

test('dicitura IVA: un solo punto nel codice, la vecchia non c\'è più', () => {
  const file = [];
  const giro = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? giro(p) : /\.(m?js|jsx)$/.test(f.name) && file.push(p); } };
  giro('lib'); giro('pages'); giro('components');
  // Il calcolatore v1 resta fermo (decisione di Enrico): è solo interno.
  const senzaCommenti = f => fs.readFileSync(f, 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const vecchia = file.filter(f => f !== path.join('pages', 'dashboard', 'calculator.js') && /esente IVA|art\. ?10, n\. ?18|633\/72/i.test(senzaCommenti(f)));
  assert.deepEqual(vecchia, []);
  const nuova = file.filter(f => /L\. 190\/2014/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(nuova, [path.join('lib', 'iva.mjs')]);
});

test('email con importi: dicitura breve accanto all\'importo, dallo stesso punto del codice', async () => {
  const { DICITURA_IVA, DICITURA_IVA_BREVE } = await import('../lib/iva.mjs');
  // stesso regime nelle due righe: al passaggio a società si cambiano insieme
  assert.match(DICITURA_IVA, /forfettario/); assert.match(DICITURA_IVA_BREVE, /forfettario/);
  const { testoMailStima } = await import('../lib/stima-mail.js');
  const { testoRiepilogo } = await import('../lib/riepilogo.js');
  const stima = testoMailStima({ azienda: 'Acme', referente: 'Anna', forchetta: { min: { price_y1: 41120 }, max: { price_y1: 68120 } } }).corpo;
  assert.ok(stima.includes(`all'anno (${DICITURA_IVA_BREVE}).`));
  const pacchetto = testoMailStima({ azienda: 'Acme', pacchetto: { price: 1750 } }).corpo;
  assert.ok(pacchetto.includes(`per 12 mesi (${DICITURA_IVA_BREVE}).`));
  const riep = testoRiepilogo({ referente: 'Anna', forchetta: { min: 41120, max: 68120 } }).corpo;
  assert.ok(riep.includes(`€68.120 all'anno (${DICITURA_IVA_BREVE}).`));
  for (const t of [stima, pacchetto, riep]) assert.equal(t.split(DICITURA_IVA_BREVE).length - 1, 1, 'una volta per email');
  // nessuna delle due scritte è ricopiata a mano fuori da lib/iva.mjs
  const file = [];
  const giro = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? giro(p) : /\.(m?js|jsx)$/.test(f.name) && file.push(p); } };
  giro('lib'); giro('pages'); giro('components');
  assert.deepEqual(file.filter(f => fs.readFileSync(f, 'utf8').includes('IVA non applicata')), [path.join('lib', 'iva.mjs')]);
  assert.match(fs.readFileSync('pages/dashboard/offer.js', 'utf8'), /Investimento Anno 1: \$\{prezzoY1\} \(\$\{DICITURA_IVA_BREVE\}\)/);
});
