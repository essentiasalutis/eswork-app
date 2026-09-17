import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIt, dataOraIt, giornoIt } from '../lib/date-it.mjs';

// Il caso vero: check-up creato alle 00:30 italiane del 14/9 = 22:30 UTC del 13/9.
const DOPO_MEZZANOTTE = '2026-09-13T22:30:00Z';
// Inverno (ora solare, UTC+1): 00:30 del 15/1 = 23:30 UTC del 14/1.
const DOPO_MEZZANOTTE_INVERNO = '2027-01-14T23:30:00Z';

test('dopo la mezzanotte italiana è già il giorno dopo, anche se in UTC no', () => {
  assert.equal(dataIt(DOPO_MEZZANOTTE), '14/09/2026');
  assert.equal(giornoIt(DOPO_MEZZANOTTE), '2026-09-14');
  assert.equal(dataIt(DOPO_MEZZANOTTE_INVERNO), '15/01/2027');
  assert.equal(giornoIt(DOPO_MEZZANOTTE_INVERNO), '2027-01-15');
});

test('ora in ora italiana', () => {
  assert.equal(dataOraIt(DOPO_MEZZANOTTE), '14/09/2026, 00:30:00');
  assert.equal(dataOraIt(DOPO_MEZZANOTTE_INVERNO, { hour: '2-digit', minute: '2-digit' }), '00:30');
});

test('un giorno di calendario resta quel giorno', () => {
  assert.equal(dataIt('2026-09-14'), '14/09/2026');
  assert.equal(giornoIt('2026-09-14'), '2026-09-14');
  assert.equal(dataIt('2026-09-01', { month: 'long', year: 'numeric' }), 'settembre 2026');
});

test('le opzioni di chi chiama restano, il fuso no', () => {
  assert.equal(dataIt(DOPO_MEZZANOTTE, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }), '14 settembre 2026');
});

test('valori vuoti o non validi: stringa vuota, mai «Invalid Date»', () => {
  assert.equal(dataIt(null), '');
  assert.equal(dataIt(''), '');
  assert.equal(dataIt('non una data'), '');
  assert.equal(giornoIt(null), null);
});
