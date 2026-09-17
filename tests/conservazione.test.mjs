import test from 'node:test';
import assert from 'node:assert/strict';
import { esitoConservazione, messaggioConservazione } from '../lib/conservazione.mjs';

const ADESSO = new Date('2026-09-17T10:00:00Z');

test('solo check-up, nessuna documentazione clinica: cancellabile', () => {
  const e = esitoConservazione({}, 10, ADESSO);
  assert.equal(e.bloccato, false);
  assert.equal(e.elementi.length, 0);
});

test('una seduta recente blocca, e il termine è 10 anni dall\'ultima', () => {
  const e = esitoConservazione({ sessions: [{ date: '2026-09-01T09:00:00Z', closed_at: '2026-09-01T10:00:00Z' }] }, 10, ADESSO);
  assert.equal(e.bloccato, true);
  assert.equal(e.finoAl, '2036-09-01T10:00:00.000Z');
});

test('conta il record PIÙ RECENTE fra tutte le tabelle', () => {
  const e = esitoConservazione({
    sessions: [{ closed_at: '2015-01-10T10:00:00Z' }],
    acute_events: [{ reported_at: '2017-03-01T10:00:00Z' }],
  }, 10, ADESSO);
  assert.equal(e.finoAl, '2027-03-01T10:00:00.000Z');
  assert.equal(e.bloccato, true);
});

test('oltre il termine: cancellabile', () => {
  const e = esitoConservazione({ patient_documents: [{ signed_at: '2016-01-01T10:00:00Z', updated_at: '2016-02-01T10:00:00Z' }] }, 10, ADESSO);
  assert.equal(e.bloccato, false);
});

test('riga senza date: nel dubbio si conserva', () => {
  assert.equal(esitoConservazione({ mini_checks: [{}] }, 10, ADESSO).bloccato, true);
});

test('il messaggio dice cosa e fino a quando', () => {
  const e = esitoConservazione({ sessions: [{ closed_at: '2026-09-01T10:00:00Z' }, { closed_at: '2026-08-01T10:00:00Z' }], copie_cartacee: [{ caricato_il: '2026-09-02T10:00:00Z' }] }, 10, ADESSO);
  const m = messaggioConservazione(e, 10, 'Mario Rossi');
  assert.match(m, /sedute \(2\)/);
  assert.match(m, /copie firmate su carta \(1\)/);
  assert.match(m, /fino al 02\/09\/2036/);
});
