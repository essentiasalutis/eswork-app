import test from 'node:test';
import assert from 'node:assert/strict';
import { validaModifica } from '../lib/modifica-paziente.mjs';

test('l\'anamnesi si modifica', () => {
  const r = validaModifica({ pain_location: ' lombare ', sedentary: true, notes: '' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.campi, { pain_location: 'lombare', sedentary: true, notes: null });
});

test('azienda, osteopata assegnato e chiave dell\'area personale: rifiutati, e si dice quali', () => {
  const r = validaModifica({ pain_location: 'x', client_id: 'altra', assigned_professional_id: 'pro_x', care_token: 'abc' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.campi_rifiutati, ['client_id', 'assigned_professional_id', 'care_token']);
});

test('livello: rifiutato rimandando a Riclassifica; prevenzione: rifiutata col suo perché', () => {
  for (const k of ['level', 'computed_level', 'level_status']) {
    const r = validaModifica({ [k]: 'level1' });
    assert.equal(r.ok, false, k);
    assert.match(r.errore, /Riclassifica/);
  }
  const p = validaModifica({ prevention_eligible: true });
  assert.equal(p.ok, false);
  assert.match(p.errore, /fissato a inizio anno/);
  assert.doesNotMatch(p.errore, /Riclassifica/);
});

test('tipi: sì/no vuole booleani, testo vuole stringhe', () => {
  assert.equal(validaModifica({ red_flags: 'true' }).ok, false);
  assert.equal(validaModifica({ notes: 5 }).ok, false);
  assert.equal(validaModifica({ notes: 'x'.repeat(4001) }).ok, false);
});

test('corpo vuoto o non oggetto: rifiutato', () => {
  assert.equal(validaModifica({}).ok, false);
  assert.equal(validaModifica(null).ok, false);
  assert.equal(validaModifica(['a']).ok, false);
});
