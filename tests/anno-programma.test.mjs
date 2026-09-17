import test from 'node:test';
import assert from 'node:assert/strict';
import { finestraAnno, nellAnno, dirittoCicli } from '../lib/anno-programma.mjs';
import { inizioGiornoIt } from '../lib/date-it.mjs';

test('mezzanotte italiana: estate, inverno e giorno del cambio d\'ora', () => {
  assert.equal(inizioGiornoIt('2026-10-01').toISOString(), '2026-09-30T22:00:00.000Z');
  assert.equal(inizioGiornoIt('2027-01-15').toISOString(), '2027-01-14T23:00:00.000Z');
  assert.equal(inizioGiornoIt('2026-03-29').toISOString(), '2026-03-28T23:00:00.000Z');
  assert.equal(inizioGiornoIt('2026-10-25').toISOString(), '2026-10-24T22:00:00.000Z');
});

test('azienda partita a ottobre: il suo anno finisce a ottobre', () => {
  const f = finestraAnno('2026-10-01', new Date('2027-03-10T10:00:00Z'));
  assert.equal(f.numero, 1);
  assert.equal(f.rinnovoIl, '2027-10-01');
  const f2 = finestraAnno('2026-10-01', new Date('2027-10-05T10:00:00Z'));
  assert.equal(f2.numero, 2);
  assert.equal(f2.inizio, '2027-09-30T22:00:00.000Z');
  assert.equal(f2.rinnovoIl, '2028-10-01');
});

test('il rinnovo scatta alla mezzanotte italiana, non UTC', () => {
  // 00:30 italiane del 1/10/2027 = 22:30 UTC del 30/9: è già l'anno 2
  assert.equal(finestraAnno('2026-10-01', new Date('2027-09-30T22:30:00Z')).numero, 2);
  assert.equal(finestraAnno('2026-10-01', new Date('2027-09-30T21:30:00Z')).numero, 1);
});

test('un ciclo avviato alle 00:30 italiane del primo giorno del nuovo anno conta nel nuovo anno', () => {
  const f2 = finestraAnno('2026-10-01', new Date('2027-10-05T10:00:00Z'));
  assert.equal(nellAnno('2027-09-30T22:30:00Z', f2), true);
  assert.equal(nellAnno('2027-09-30T21:30:00Z', f2), false);
});

test('dal secondo anno il diritto si rinnova: 2 cicli nell\'anno 1 non esauriscono l\'anno 2', () => {
  const cicli = [
    { cycle_type: 'treatment', status: 'closed', started_at: '2026-11-01T09:00:00Z' },
    { cycle_type: 'treatment', status: 'closed', started_at: '2027-03-01T09:00:00Z' },
  ];
  const anno1 = dirittoCicli({ cicli, tipo: 'treatment', finestra: finestraAnno('2026-10-01', new Date('2027-06-01T10:00:00Z')) });
  assert.equal(anno1.esaurito, true);
  assert.match(anno1.messaggio, /Si rinnova il 01\/10\/2027/);
  const anno2 = dirittoCicli({ cicli, tipo: 'treatment', finestra: finestraAnno('2026-10-01', new Date('2027-10-02T10:00:00Z')) });
  assert.equal(anno2.esaurito, false);
  assert.equal(anno2.usati, 0);
});

test('prevenzione: 1 per anno di programma', () => {
  const cicli = [{ cycle_type: 'prevention', status: 'closed', started_at: '2026-12-01T09:00:00Z' }];
  const f1 = finestraAnno('2026-10-01', new Date('2027-01-10T10:00:00Z'));
  assert.equal(dirittoCicli({ cicli, tipo: 'prevention', finestra: f1 }).esaurito, true);
  const f2 = finestraAnno('2026-10-01', new Date('2027-11-10T10:00:00Z'));
  assert.equal(dirittoCicli({ cicli, tipo: 'prevention', finestra: f2 }).esaurito, false);
});

test('il primo anno include quanto avvenuto prima della data di avvio', () => {
  const f = finestraAnno('2026-10-01', new Date('2026-10-10T10:00:00Z'));
  assert.equal(nellAnno('2026-09-20T10:00:00Z', f), true);
});

test('senza data di avvio conta tutto e il messaggio dice perché non si rinnova', () => {
  const cicli = [{ cycle_type: 'treatment', status: 'closed', started_at: '2025-01-01T09:00:00Z' }, { cycle_type: 'treatment', status: 'closed', started_at: '2026-01-01T09:00:00Z' }];
  const d = dirittoCicli({ cicli, tipo: 'treatment', finestra: finestraAnno(null) });
  assert.equal(d.esaurito, true);
  assert.match(d.messaggio, /data di avvio del programma/);
});

test('un ciclo in corso non consuma il diritto due volte (lo blocca l\'altro controllo)', () => {
  const cicli = [{ cycle_type: 'treatment', status: 'active', started_at: '2026-11-01T09:00:00Z' }];
  assert.equal(dirittoCicli({ cicli, tipo: 'treatment', finestra: finestraAnno('2026-10-01', new Date('2026-12-01T10:00:00Z')) }).usati, 0);
});
