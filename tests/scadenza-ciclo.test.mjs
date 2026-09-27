// Ciclo di trattamento entro 60 giorni, avviso all'osteopata dal 45° (Enrico, 27/9).
import test from 'node:test';
import assert from 'node:assert/strict';
import { avvisoDurataCiclo } from '../lib/scadenza-ciclo.mjs';

const apertoIl = (giorniFa) => new Date(Date.parse('2026-10-01T10:00:00Z') - giorniFa * 86400000).toISOString();
const adesso = new Date('2026-10-01T10:00:00Z');
const ciclo = (giorniFa, fatti, extra = {}) => ({ cycle_type: 'treatment', status: 'active', started_at: apertoIl(giorniFa), sessions_planned: 4, sessions_completed: fatti, ...extra });

test('prima del 45° giorno nessun avviso', () => {
  assert.equal(avvisoDurataCiclo(ciclo(44, 1), { adesso }), null);
});

test('dal 45° giorno, se mancano trattamenti, avviso con i giorni che restano', () => {
  const a = avvisoDurataCiclo(ciclo(45, 2), { adesso });
  assert.equal(a.restano, 15);
  assert.match(a.testo, /Ciclo aperto 45 giorni fa: 2 trattamenti su 4\. Va completato entro 60 giorni dalla presa in carico: restano 15 giorni\./);
});

test('oltre il 60° giorno l\'avviso dice di quanto è superato; non blocca niente', () => {
  const a = avvisoDurataCiclo(ciclo(63, 3), { adesso });
  assert.equal(a.superato, true);
  assert.match(a.testo, /superato di 3 giorni/);
});

test('niente avviso per cicli completi, chiusi o di prevenzione', () => {
  assert.equal(avvisoDurataCiclo(ciclo(50, 4), { adesso }), null);
  assert.equal(avvisoDurataCiclo(ciclo(50, 2, { status: 'pending_pgic' }), { adesso }), null);
  assert.equal(avvisoDurataCiclo(ciclo(50, 2, { cycle_type: 'prevention' }), { adesso }), null);
});
