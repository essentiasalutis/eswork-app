// Prezzo Anno 1 più basso del calcolato (Enrico, 21/9): margine sul costo TOTALE
// (professionisti + 30% della quota), soglia del Listino con conferma, zero fisso nel
// codice, un anno solo, il cliente vede solo il totale. Numeri reali del motore:
// 100 dipendenti al 12% → €16.800, costo €7.600, rinnovo €14.800.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculatePricing } from '../lib/pricing/v2.js';
import { DEFAULTS_V2 } from '../lib/pricing/v2-defaults.mjs';
import { valutaSconto, statoScontoCliente, applicaScontoAlCalcolo, avvisoRevisioneForbice, rigaRinnovo, margine, MARGINE_MINIMO_PCT, conArticolo } from '../lib/sconto.mjs';
import { prezzoConTetto, applicaTettoAlCalcolo, posizioneNellaForbice, POSIZIONE } from '../lib/forbice.mjs';

const calc = calculatePricing({ n: 100, l1: 12, l2: 24 });
const base = { prezzoBase: calc.price_y1, costo: calc.y1.total_cost, sogliaPct: DEFAULTS_V2.sconto_margine_avviso_pct, motivo: 'Prima azienda del distretto, concordato col titolare' };

test('il caso di riferimento: 100 dipendenti al 12%', () => {
  assert.equal(calc.price_y1, 16800);
  assert.equal(calc.y1.total_cost, 7600, 'costo = professionisti + 30% della quota');
  assert.equal(calc.price_y2, 14800);
  assert.deepEqual(margine(16800, 7600), { margineEur: 9200, marginePct: 54.8 });
});

test('€14.000: margine sopra il 40%, valido senza conferma', () => {
  const v = valutaSconto({ ...base, prezzoScontato: 14000 });
  assert.equal(v.ok, true);
  assert.equal(v.stato, 'valido');
  assert.equal(v.marginePct, 45.7);
  assert.equal(v.scontoEur, 2800);
  assert.equal(v.scontoPct, 16.7);
  assert.equal(v.sottoSoglia, false);
});

test('€12.000: sotto il 40%, serve la conferma con il margine scritto', () => {
  const v = valutaSconto({ ...base, prezzoScontato: 12000 });
  assert.equal(v.ok, false);
  assert.equal(v.stato, 'serve_conferma');
  assert.equal(v.marginePct, 36.7);
  assert.match(v.messaggio, /36,7%/);
  assert.match(v.messaggio, /4\.400/, 'il margine in euro è nel messaggio');
  const c = valutaSconto({ ...base, prezzoScontato: 12000, conferma: true });
  assert.equal(c.ok, true);
  assert.equal(c.sottoSoglia, true);
});

test('sotto il costo: rifiutato, anche con la conferma', () => {
  for (const conferma of [false, true]) {
    const v = valutaSconto({ ...base, prezzoScontato: 7000, conferma });
    assert.equal(v.ok, false);
    assert.equal(v.stato, 'sotto_costo');
  }
  assert.equal(MARGINE_MINIMO_PCT, 0, 'lo zero è nel codice');
  // esattamente al costo: margine zero, ammesso solo con la conferma
  assert.equal(valutaSconto({ ...base, prezzoScontato: 7600 }).stato, 'serve_conferma');
  assert.equal(valutaSconto({ ...base, prezzoScontato: 7600, conferma: true }).ok, true);
});

test('la soglia del Listino non sposta lo zero', () => {
  const v = valutaSconto({ ...base, sogliaPct: 0.01, prezzoScontato: 7000, conferma: true });
  assert.equal(v.stato, 'sotto_costo');
  assert.equal(valutaSconto({ ...base, sogliaPct: 0.3, prezzoScontato: 12000 }).stato, 'valido');
});

test('prezzo non più basso del calcolato, non intero, motivazione mancante: rifiutati', () => {
  assert.equal(valutaSconto({ ...base, prezzoScontato: 16800 }).stato, 'non_inferiore');
  assert.equal(valutaSconto({ ...base, prezzoScontato: 18000 }).stato, 'non_inferiore');
  assert.equal(valutaSconto({ ...base, prezzoScontato: 14000.5 }).stato, 'non_valido');
  assert.equal(valutaSconto({ ...base, prezzoScontato: 0 }).stato, 'non_valido');
  assert.equal(valutaSconto({ ...base, prezzoScontato: 14000, motivo: '' }).stato, 'motivo');
  assert.equal(valutaSconto({ ...base, prezzoScontato: 14000, motivo: '   corto   ' }).stato, 'motivo');
  // la valutazione dal vivo nella pagina non chiede ancora la motivazione
  assert.equal(valutaSconto({ ...base, prezzoScontato: 14000, motivo: '', controllaMotivo: false }).ok, true);
});

const riga = { sconto_prezzo_applicato: 14000, sconto_calcolato: 16800, sconto_costo: 7600, sconto_margine_pct: '45.70', sconto_rinnovo_pieno: 14800, sconto_motivo: base.motivo, sconto_at: '2026-09-21T10:00:00Z', sconto_conferma_margine: false };

test('applicato solo sull\'Anno 1: il rinnovo resta pieno', () => {
  const s = statoScontoCliente(riga, 16800);
  assert.equal(s.stato, 'attivo');
  const out = applicaScontoAlCalcolo(calc, s);
  assert.equal(out.price_y1, 14000);
  assert.equal(out.y1.total_sell, 14000);
  assert.equal(out.price_monthly_y1, Math.round(14000 / 12));
  assert.equal(out.price_per_employee_y1, 140);
  assert.equal(out.y1.total_with_vat, 14000, 'regime forfettario: niente IVA aggiunta');
  assert.equal(out.y1.total_cost, 7600, 'il costo non cambia');
  assert.equal(out.price_y2, 14800, 'l\'Anno 2 resta a prezzo pieno');
  assert.equal(calc.price_y1, 16800, 'il calcolo di partenza non viene toccato');
});

test('se il prezzo di partenza cambia, lo sconto è sospeso e non si applica', () => {
  const s = statoScontoCliente(riga, 17400);
  assert.equal(s.stato, 'sospeso');
  assert.equal(s.baseAttuale, 17400);
  assert.equal(applicaScontoAlCalcolo(calc, s), calc);
  assert.equal(statoScontoCliente({ sconto_prezzo_applicato: null }, 16800).stato, 'nessuno');
});

test('riga del rinnovo per la vista amministratore', () => {
  const t = rigaRinnovo(statoScontoCliente(riga, 16800));
  assert.match(t, /Anno 1 applicato €14\.000/);
  assert.match(t, /sconto €2\.800, margine 45,7%/);
  assert.match(t, /Rinnovo a prezzo pieno €14\.800: \+€800/);
});

test('dopo il tetto: lo sconto parte dal prezzo capato, l\'IVA segue il calcolo', () => {
  const r = prezzoConTetto({ calcolato: 16800, min: 9000, max: 15000 });
  const capato = applicaTettoAlCalcolo(calc, r);
  assert.equal(capato.price_y1, 15000);
  assert.equal(capato.y1.total_with_vat, 15000, 'forfettario: nessun 22% aggiunto dal tetto');
  const s = statoScontoCliente({ ...riga, sconto_calcolato: 15000, sconto_prezzo_applicato: 13000 }, capato.price_y1);
  assert.equal(s.stato, 'attivo');
  assert.equal(applicaScontoAlCalcolo(capato, s).price_y1, 13000);
});

test('quarto stato: sotto la forbice per sconto, distinto da «sotto»', () => {
  assert.equal(posizioneNellaForbice({ prezzo: 8000, min: 9000, max: 15000, conSconto: true }), POSIZIONE.SOTTO_PER_SCONTO);
  assert.equal(posizioneNellaForbice({ prezzo: 8000, min: 9000, max: 15000 }), POSIZIONE.SOTTO);
  assert.equal(posizioneNellaForbice({ prezzo: 12000, min: 9000, max: 15000, conSconto: true }), POSIZIONE.DENTRO);
  assert.equal(posizioneNellaForbice({ prezzo: 16000, min: 9000, max: 15000 }), POSIZIONE.SOPRA);
  assert.equal(posizioneNellaForbice({ prezzo: 16000, min: null, max: null }), POSIZIONE.NESSUNA_FORBICE);
});

test('avviso di revisione della forbice: il tetto porta il margine sotto la soglia', () => {
  // massimo €12.000 su un calcolato di €16.800: margine 36,7% < 40%
  const a = avvisoRevisioneForbice(prezzoConTetto({ calcolato: 16800, min: 9000, max: 12000 }), 7600, 0.4);
  assert.deepEqual(a, { marginePct: 36.7, margineEur: 4400, sogliaPct: 40, calcolato: 16800, massimo: 12000, costo: 7600 });
  // tetto con margine sopra la soglia: nessun avviso
  assert.equal(avvisoRevisioneForbice(prezzoConTetto({ calcolato: 16800, min: 9000, max: 15000 }), 7600, 0.4), null);
  // nessun tetto applicato: nessun avviso, anche se il margine è basso
  assert.equal(avvisoRevisioneForbice(prezzoConTetto({ calcolato: 9000, min: 8000, max: 15000 }), 7600, 0.4), null);
});

test('nei documenti del cliente non entra la parola «sconto» né la motivazione', () => {
  // I documenti leggono calc (price_y1 già applicato); la traccia interna sta in calc.sconto
  // e nelle colonne sconto_*, che nessun generatore di documenti per il cliente legge.
  for (const f of ['lib/sintesi.js', 'lib/pdf.js', 'pages/dashboard/presentazione/[clientId].js']) {
    const src = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /sconto_motivo|registrato\.motivo|calc\.sconto/, `${f} non deve leggere la traccia dello sconto`);
  }
});

test('percentuali con la preposizione giusta', () => {
  assert.equal(conArticolo(40), 'del 40%');
  assert.equal(conArticolo(0), 'dello 0%');
  assert.equal(conArticolo(8.5), "dell'8,5%");
  assert.equal(conArticolo(11), "dell'11%");
  assert.equal(conArticolo(85), "dell'85%");
  assert.equal(conArticolo(18), 'del 18%');
  assert.equal(conArticolo(1), "dell'1%");
  assert.equal(conArticolo(0, 'a'), 'allo 0%');
  assert.equal(conArticolo(36.7, 'a'), 'al 36,7%');
  assert.match(valutaSconto({ ...base, prezzoScontato: 7600, conferma: true }).messaggio, /^Margine dello 0%, sotto la soglia del 40%/);
});
