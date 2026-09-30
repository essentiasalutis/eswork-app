// Prevenzione (Enrico, 30/9):
// • chi è in Livello 3 non fa trattamenti di prevenzione, anche se l'anno prima era L2;
// • chi entra nel programma dopo il Report di Attivazione (neoassunto, o check-up
//   compilato quando l'analisi è congelata) fa la prevenzione dall'anno di programma
//   successivo; intanto ha formazione e autosegnalazione.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prevenzioneDal, testoPrevenzioneDal } from '../lib/anno-programma.mjs';
import { statoPercorso } from '../lib/sportello.mjs';

const src = f => fs.readFileSync(f, 'utf8');
const REPORT = '2025-09-16T09:00:00Z';
const AVVIO = '2025-09-22';

test('chi era nel Report di Attivazione: la prevenzione spetta subito', () => {
  assert.equal(prevenzioneDal({ entrataIl: '2025-08-20T10:00:00Z', congelataIl: REPORT, dataAvvio: AVVIO, adesso: new Date('2025-10-01T10:00:00Z') }), null);
  // senza Report non c'è un «dopo»: vale la regola di prima
  assert.equal(prevenzioneDal({ entrataIl: '2025-10-01T10:00:00Z', congelataIl: null, dataAvvio: AVVIO }), null);
});

test('entrato dopo il Report: dall\'anno di programma successivo', () => {
  // neoassunto a febbraio 2026 (1° anno): aspetta il 22/9/2026
  const a = prevenzioneDal({ entrataIl: '2026-02-10T10:00:00Z', congelataIl: REPORT, dataAvvio: AVVIO, adesso: new Date('2026-03-01T10:00:00Z') });
  assert.deepEqual(a, { dal: '2026-09-22' });
  assert.equal(testoPrevenzioneDal(a), 'È entrato nel programma dopo il Report di Attivazione: la prevenzione parte con il prossimo anno di programma, dal 22/09/2026.');
  // dal 22/9/2026 spetta
  assert.equal(prevenzioneDal({ entrataIl: '2026-02-10T10:00:00Z', congelataIl: REPORT, dataAvvio: AVVIO, adesso: new Date('2026-09-22T08:00:00Z') }), null);
  // entrato fra il Report e l'avvio in sede: comunque fuori dal prezzo dell'Anno 1
  assert.deepEqual(prevenzioneDal({ entrataIl: '2025-09-18T10:00:00Z', congelataIl: REPORT, dataAvvio: AVVIO, adesso: new Date('2025-10-01T10:00:00Z') }), { dal: '2026-09-22' });
  // entrato nel 2° anno: dal 3°
  assert.deepEqual(prevenzioneDal({ entrataIl: '2026-11-05T10:00:00Z', congelataIl: REPORT, dataAvvio: AVVIO, adesso: new Date('2026-12-01T10:00:00Z') }), { dal: '2027-09-22' });
  // azienda senza data di avvio: si sa solo che parte con l'anno dopo
  assert.deepEqual(prevenzioneDal({ entrataIl: '2026-02-10T10:00:00Z', congelataIl: REPORT, dataAvvio: null }), { dal: null });
});

test('sportello: niente prevenzione per chi è in Livello 3, anche con i cicli dell\'anno prima', () => {
  const cicli = [{ id: 'c1', cycle_type: 'prevention', status: 'closed', started_at: '2025-10-01T10:00:00Z' }];
  const adesso = new Date('2026-10-10T10:00:00Z');
  const l3 = statoPercorso({ cicli, livello: 'level3', dataAvvio: AVVIO, adesso });
  assert.ok(!l3.some(r => /revenzione/.test(r)), l3.join(' | '));
  const l2 = statoPercorso({ cicli, livello: 'level2', dataAvvio: AVVIO, adesso });
  assert.ok(l2.some(r => /seduta da fare entro/.test(r)), l2.join(' | '));
});

test('sportello: il Livello 2 entrato dopo il Report non ha «seduta da fare»', () => {
  const r = statoPercorso({ livello: 'level2', dataAvvio: AVVIO, adesso: new Date('2026-03-01T10:00:00Z'), prevenzioneDopo: { dal: '2026-09-22' } });
  assert.deepEqual(r, ['Entrato dopo il Report di Attivazione: prevenzione dal prossimo anno di programma (22/09/2026)']);
  const s = src('lib/sportello-server.js');
  assert.match(s, /if \(liv === 'level2' && !prevenzioneDopo && !prevenzioneNonSpetta\) \{/, 'niente allarme del trimestre');
});

test('il gate è sul server, e i testi al dipendente lo dicono', () => {
  const api = src('pages/api/pro/patients/[patientId]/start-cycle.js');
  assert.match(api, /const dopo = prevenzioneDal\(\{ entrataIl: patient\.created_at, congelataIl, dataAvvio/);
  assert.match(api, /if \(dopo\) return res\.status\(400\)/);
  assert.match(src('pages/pro/patients/[patientId].js'), /if \(prevenzioneDopo\) return <div/);
  assert.match(src('pages/employee/[token].js'), /partono con il prossimo anno di programma della tua azienda/);
  assert.match(src('pages/q/c/[client_code].js'), /parte con il prossimo anno di programma della tua azienda/);
  assert.match(src('pages/api/self-declare/[client_code].js'), /prevenzione_dopo: prevenzioneDopo/);
  // il momento del congelamento: il primo Report dopo l'avvio o la riapertura del check-up
  const cs = src('lib/checkup-server.js');
  assert.match(cs, /export async function analisiCongelataIl\(client_id\)/);
  assert.match(cs, /\.gte\('created_at', inizioAnalisi\(a\)\)\s*\n\s*\.order\('created_at', \{ ascending: true \}\)/);
});
