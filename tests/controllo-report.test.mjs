import test from 'node:test';
import assert from 'node:assert/strict';
import { controllaTesto, numeriDi } from '../lib/controllo-report.mjs';
import { programmaPrevisto } from '../lib/regole-report.mjs';
import { PROTOCOLLO } from '../lib/protocollo.mjs';

const dati = '- Sessioni completate/pianificate: 352/352\n- Ore di seduta: 176\n- PGIC medio 4.0/5, 68% migliorato\n- Prevalenza L1: dal 17% al 8%';

test('i difetti visti nella demo del 18/9 vengono riconosciuti', () => {
  const casi = [
    'la prevalenza del livello L1 (rischio basso) è diminuita',
    'interventi fisioterapici nei casi sintomatici',
    'riduzione di 1,2 punti, superiore alla media di settore (0.9-1.0)',
    'modello OT23 2024 ai sensi del D.M. 2019',
    'per un totale di circa 293 ore (media 50 min/sessione)',
    'sulla stessa coorte (n=228)',
    'in linea con gli standard attesi',
    'strutturare interventi osteopatici di gruppo',
    'anticipare il secondo check-up a 6 mesi',
  ];
  for (const c of casi) assert.ok(controllaTesto(c, { dati }).length > 0, c);
});

test('un testo che usa solo i dati passa', () => {
  const t = '## Sintesi\n1. 352 sedute su 352 pianificate, 176 ore.\n2. Il Livello 1 scende dal 17% all\'8%: un miglioramento. PGIC medio 4,0/5; 68% riferisce un miglioramento (PGIC 4-5). Mini-check T3 e T6, modello OT23.';
  assert.deepEqual(controllaTesto(t, { dati }), []);
});

test('numeri: virgola e punto sono lo stesso numero, le sigle non contano', () => {
  assert.deepEqual(numeriDi('0,9 e 0.9; T12 L1 OT23'), [0.9, 0.9]);
});

test('il programma descritto viene dal protocollo', () => {
  const t = programmaPrevisto();
  assert.ok(t.includes(`${PROTOCOLLO.sedute_per_ciclo} sedute da ${PROTOCOLLO.durata_seduta_min} minuti`));
  assert.ok(t.includes(`${PROTOCOLLO.formazione_moduli_primo_anno} moduli nel primo anno`));
});

test('sedute divise per tipo di ciclo; senza ciclo noto niente divisione', async () => {
  const { divisioneSedute } = await import('../lib/regole-report.mjs');
  const cicli = [{ id: 'c1', cycle_type: 'treatment' }, { id: 'c2', cycle_type: 'prevention' }];
  const chiusa = '2026-01-01';
  const d = divisioneSedute([{ cycle_id: 'c1', closed_at: chiusa }, { cycle_id: 'c2', closed_at: chiusa }, { cycle_id: 'c2', closed_at: chiusa }, { cycle_id: 'c2', closed_at: null }], cicli);
  assert.equal(d.trattamento, 1);
  assert.equal(d.prevenzione, 2);
  assert.equal(d.divisibile, true);
  assert.equal(d.ore(4), 2);
  // Il difetto del 18/9: sedute senza cycle_id non diventano «trattamento».
  const senza = divisioneSedute([{ closed_at: chiusa }, { closed_at: chiusa }], cicli);
  assert.equal(senza.trattamento, 0);
  assert.equal(senza.divisibile, false);
});

test('formazione già erogata: il prompt lo dice', async () => {
  const { rigaFormazione } = await import('../lib/regole-report.mjs');
  const r = rigaFormazione([{ tipo: 'base', stato: 'erogata' }, { tipo: 'ergonomia', stato: 'erogata' }, { tipo: 'base', stato: 'pianificata' }]);
  assert.ok(r.includes('1 sessioni di formazione già erogate, 1 interventi di ergonomia'));
  assert.ok(r.includes('GIÀ attiva'));
  assert.ok(rigaFormazione([]).includes('nessuna sessione ancora erogata'));
});
