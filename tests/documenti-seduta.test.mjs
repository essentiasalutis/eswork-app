import test from 'node:test';
import assert from 'node:assert/strict';
import { documentiMancanti, documentoValido, prevedeSedute } from '../lib/documenti-seduta.mjs';

const consenso = { type: 'consent_treatment', status: 'signed', testo_legale_id: 'tl_x' };
const informativa = { type: 'privacy_extended', status: 'signed', testo_legale_id: 'tl_y' };
const anamnesi = { type: 'anamnesi', status: 'completed' };

test('nessun documento: mancano tutti e tre', () => {
  assert.deepEqual(documentiMancanti([]), ['consent_treatment', 'privacy_extended', 'anamnesi']);
  assert.deepEqual(documentiMancanti(null), ['consent_treatment', 'privacy_extended', 'anamnesi']);
});

test('tutti validi: nulla manca', () => {
  assert.deepEqual(documentiMancanti([consenso, informativa, anamnesi]), []);
});

test('consenso «signed» senza testo d\'archivio NON vale', () => {
  assert.equal(documentoValido({ type: 'consent_treatment', status: 'signed' }), false);
  assert.deepEqual(documentiMancanti([{ ...consenso, testo_legale_id: null }, informativa, anamnesi]), ['consent_treatment']);
});

test('stato intermedio (pending) non vale', () => {
  assert.deepEqual(documentiMancanti([{ ...consenso, status: 'pending' }, informativa, anamnesi]), ['consent_treatment']);
});

test('anamnesi non compilata non vale', () => {
  assert.deepEqual(documentiMancanti([consenso, informativa, { type: 'anamnesi', status: 'pending' }]), ['anamnesi']);
});

test('prevedono sedute: L1 e L2 con diritto; non L2 senza diritto né L3', () => {
  assert.equal(prevedeSedute({ level: 'level1' }), true);
  assert.equal(prevedeSedute({ level: 'level2', prevention_eligible: true }), true);
  assert.equal(prevedeSedute({ level: 'level2', prevention_eligible: false }), false);
  assert.equal(prevedeSedute({ level: 'level3' }), false);
});
