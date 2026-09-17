import test from 'node:test';
import assert from 'node:assert/strict';
import { testoCanonico, versioneAccettabile, consensiMancanti } from '../lib/testi-legali.mjs';

const base = { titolo: 'Informativa', sezioni: [{ titolo: 'Uno', testo: 'Testo uno' }], consensi: { salute: 'S', privacy: 'P' } };

test('la forma canonica è deterministica e ordina i consensi', () => {
  const a = testoCanonico(base);
  const b = testoCanonico({ ...base, consensi: { privacy: 'P', salute: 'S' } });
  assert.equal(a, b);
  assert.match(a, /\[privacy\] P\n\[salute\] S/);
});

test('una virgola in più cambia la forma canonica', () => {
  const b = testoCanonico({ ...base, sezioni: [{ titolo: 'Uno', testo: 'Testo uno,' }] });
  assert.notEqual(testoCanonico(base), b);
});

test('a capo Windows e forme Unicode equivalenti non cambiano il testo', () => {
  const a = testoCanonico({ titolo: 'Perché', sezioni: [{ titolo: 'x', testo: 'a\nb' }] });
  const b = testoCanonico({ titolo: 'Perché', sezioni: [{ titolo: 'x', testo: 'a\r\nb' }] });
  assert.equal(a, b);
});

test('versione in vigore accettata, ritirata solo entro la tolleranza', () => {
  const ora = new Date('2026-09-17T10:00:00Z');
  assert.equal(versioneAccettabile({ stato: 'in_vigore' }, ora), true);
  assert.equal(versioneAccettabile({ stato: 'ritirata', ritirato_il: '2026-09-17T09:30:00Z' }, ora), true);
  assert.equal(versioneAccettabile({ stato: 'ritirata', ritirato_il: '2026-09-17T08:30:00Z' }, ora), false);
  assert.equal(versioneAccettabile({ stato: 'bozza' }, ora), false);
  assert.equal(versioneAccettabile(null, ora), false);
});

test('i consensi obbligatori devono essere true espliciti', () => {
  assert.deepEqual(consensiMancanti('informativa_checkup', { privacy: true, salute: true }), []);
  assert.deepEqual(consensiMancanti('informativa_checkup', { privacy: true }), ['salute']);
  assert.deepEqual(consensiMancanti('informativa_checkup', { privacy: 'true', salute: 1 }), ['privacy', 'salute']);
  assert.deepEqual(consensiMancanti('documento_inventato', {}), ['documento_sconosciuto']);
});
