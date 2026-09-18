import test from 'node:test';
import assert from 'node:assert/strict';
import { numeriNelCiclo } from '../lib/numero-seduta.mjs';

const chiusa = '2026-01-01T10:00:00Z';

test('al secondo ciclo la numerazione riparte da 1', () => {
  const s = [
    ...[1, 2, 3, 4].map(n => ({ id: `a${n}`, cycle_id: 'c1', session_number: n, closed_at: chiusa })),
    ...[5, 6, 7, 8].map(n => ({ id: `b${n}`, cycle_id: 'c2', session_number: n, closed_at: chiusa })),
  ];
  const n = numeriNelCiclo(s);
  assert.equal(n.a4, 4);
  assert.equal(n.b5, 1);
  assert.equal(n.b8, 4);
});

test('le sedute aperte e quelle senza ciclo non hanno numero nel ciclo', () => {
  const n = numeriNelCiclo([
    { id: 'x', cycle_id: 'c1', session_number: 1, closed_at: null },
    { id: 'y', cycle_id: null, session_number: 2, closed_at: chiusa },
    { id: 'z', cycle_id: 'c1', session_number: 3, closed_at: chiusa },
  ]);
  assert.equal(n.x, undefined);
  assert.equal(n.y, undefined);
  assert.equal(n.z, 1);
});
