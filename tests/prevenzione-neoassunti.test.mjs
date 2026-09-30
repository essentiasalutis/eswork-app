// Prevenzione, neoassunti e anagrafica (Enrico, 30/9):
// • chi è in Livello 3 non fa trattamenti di prevenzione, anche se l'anno prima era L2;
// • il neoassunto (entrato dall'invito, patients.neoassunto, v83) in Livello 2 fa la
//   prevenzione dall'anno di programma successivo; intanto formazione e autosegnalazione.
//   Chi si dimentica il check-up NON è un neoassunto: si riapre e si ricalcola;
// • il neoassunto in Livello 1 prende un posto per i nuovi L1;
// • i nomi di chi compila il check-up entrano da soli in anagrafica; la pagina Formazione
//   mostra formazione ed ergonomia per persona; l'HR vede solo numeri.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prevenzioneDal, testoPrevenzioneDal } from '../lib/anno-programma.mjs';
import { statoPercorso } from '../lib/sportello.mjs';
import { nomiDaImportare, monitoraggioPersone } from '../lib/org-regole.mjs';

const src = f => fs.readFileSync(f, 'utf8');
const AVVIO = '2025-09-22';

test('prevenzione: solo il neoassunto aspetta l\'anno dopo', () => {
  // chi compila il check-up in ritardo non è un neoassunto
  assert.equal(prevenzioneDal({ neoassunto: false, entrataIl: '2026-02-10T10:00:00Z', dataAvvio: AVVIO, adesso: new Date('2026-03-01T10:00:00Z') }), null);
  // neoassunto a febbraio 2026 (1° anno): aspetta il 22/9/2026
  const a = prevenzioneDal({ neoassunto: true, entrataIl: '2026-02-10T10:00:00Z', dataAvvio: AVVIO, adesso: new Date('2026-03-01T10:00:00Z') });
  assert.deepEqual(a, { dal: '2026-09-22' });
  assert.equal(testoPrevenzioneDal(a), 'Neoassunto: la prevenzione parte con il prossimo anno di programma, dal 22/09/2026.');
  assert.equal(prevenzioneDal({ neoassunto: true, entrataIl: '2026-02-10T10:00:00Z', dataAvvio: AVVIO, adesso: new Date('2026-09-22T08:00:00Z') }), null, 'dal rinnovo spetta');
  // entrato fra la firma e l'avvio in sede: anno 1 → dal 2°
  assert.deepEqual(prevenzioneDal({ neoassunto: true, entrataIl: '2025-09-18T10:00:00Z', dataAvvio: AVVIO, adesso: new Date('2025-10-01T10:00:00Z') }), { dal: '2026-09-22' });
  // entrato nel 2° anno: dal 3°
  assert.deepEqual(prevenzioneDal({ neoassunto: true, entrataIl: '2026-11-05T10:00:00Z', dataAvvio: AVVIO, adesso: new Date('2026-12-01T10:00:00Z') }), { dal: '2027-09-22' });
  assert.deepEqual(prevenzioneDal({ neoassunto: true, entrataIl: '2026-02-10T10:00:00Z', dataAvvio: null }), { dal: null });
});

test('sportello: niente prevenzione per chi è in Livello 3, anche con i cicli dell\'anno prima', () => {
  const cicli = [{ id: 'c1', cycle_type: 'prevention', status: 'closed', started_at: '2025-10-01T10:00:00Z' }];
  const adesso = new Date('2026-10-10T10:00:00Z');
  const l3 = statoPercorso({ cicli, livello: 'level3', dataAvvio: AVVIO, adesso });
  assert.ok(!l3.some(r => /revenzione/.test(r)), l3.join(' | '));
  const l2 = statoPercorso({ cicli, livello: 'level2', dataAvvio: AVVIO, adesso });
  assert.ok(l2.some(r => /trattamento da fare entro/.test(r)), l2.join(' | '));
  const neo = statoPercorso({ livello: 'level2', dataAvvio: AVVIO, adesso: new Date('2026-03-01T10:00:00Z'), prevenzioneDopo: { dal: '2026-09-22' } });
  assert.deepEqual(neo, ['Neoassunto: prevenzione dal prossimo anno di programma (22/09/2026)']);
  assert.match(src('lib/sportello-server.js'), /if \(liv === 'level2' && !prevenzioneDopo && !prevenzioneNonSpetta\) \{/, 'niente allarme del trimestre');
});

test('neoassunto: marcato all\'invito, gate sul server, posto per i nuovi L1', () => {
  const inv = src('pages/api/invito/submit.js');
  assert.match(inv, /update\(\{ neoassunto: true \}\)\.eq\('care_token', care_token\)/);
  const api = src('pages/api/pro/patients/[patientId]/start-cycle.js');
  assert.match(api, /prevenzioneDal\(\{ neoassunto: patient\.neoassunto === true, entrataIl: patient\.created_at/);
  assert.match(api, /if \(dopo\) return res\.status\(400\)/);
  assert.match(src('pages/pro/patients/[patientId].js'), /if \(prevenzioneDopo\) return <div/);
  assert.match(src('pages/employee/[token].js'), /partono con il prossimo anno di programma della tua azienda/);
  // chi compila il check-up (anche in ritardo) non passa da qui
  assert.doesNotMatch(src('pages/api/self-declare/[client_code].js'), /prevenzioneDal/);
  const cap = src('lib/store.js');
  assert.match(cap, /\.eq\('neoassunto', true\)/);
  assert.match(cap, /\(p\.level === 'level1' \|\| cicliAnno\.some\(c => c\.patient_id === p\.id\)\)/);
  const v83 = src('supabase-schema-v83-neoassunti-anagrafica.sql');
  assert.match(v83, /ADD COLUMN IF NOT EXISTS neoassunto boolean NOT NULL DEFAULT false/);
  assert.match(v83, /CHECK \(inserito_da IN \('admin', 'hr', 'checkup'\)\)/);
});

test('anagrafica: i nomi del check-up entrano da soli, senza segnaposto né neoassunti', () => {
  const pazienti = [
    { first_name: 'Mario', last_name: 'Rossi' },
    { first_name: 'Nome non indicato', last_name: '' },
    { first_name: 'Anonimo', last_name: '' },
    { first_name: 'Giulia', last_name: 'Verdi', neoassunto: true },
    { first_name: 'Luca', last_name: 'Neri', consent_withdrawn_at: '2026-01-01' },
    { first_name: 'Anna', last_name: 'Bianchi' },
    { first_name: 'anna ', last_name: ' bianchi' },
    { first_name: 'Paolo', last_name: 'Gialli' },
  ];
  const esistenti = [{ nome: 'Rossi Mario' }, { nome: 'Paolo Gialli', attivo: false }];
  assert.deepEqual(nomiDaImportare(pazienti, esistenti), ['Anna Bianchi']);
  const org = src('lib/org.js');
  assert.match(org, /if \(!c \|\| !programmaAttivo\(c\)\) return \{ importati: 0 \};/, 'solo a programma attivo');
  assert.match(org, /await sincronizzaNomiDalCheckup\(client_id, client\)/, 'Dipendenti e Formazione');
  assert.match(src('pages/api/self-declare/[client_code].js'), /await sincronizzaNomiDalCheckup\(client\.id\)/);
  assert.doesNotMatch(org, /seedDipendentiDaAssessment/);
  assert.equal(fs.existsSync('pages/api/org/[clientId]/seed.js'), false);
  assert.doesNotMatch(src('pages/dashboard/dipendenti/[clientId].js'), /Importa nomi dal check-up/);
});

test('registro CSV: solo chi ha partecipato, così non dice chi ha compilato il check-up', async () => {
  const { buildRegistroCsv } = await import('../lib/org.js').catch(() => ({}));
  if (buildRegistroCsv) {
    const csv = buildRegistroCsv(
      [{ id: 'a', nome: 'Anna Bianchi', attivo: true, inserito_da: 'checkup' }, { id: 'b', nome: 'Mario Rossi', attivo: true, inserito_da: 'checkup' }],
      [{ dipendente_id: 'a', tipo: 'base', stato: 'svolta', data_svolgimento: '2026-01-10' }, { dipendente_id: 'b', tipo: 'base', stato: 'pianificata' }], 1);
    assert.match(csv, /Anna Bianchi/);
    assert.doesNotMatch(csv, /Mario Rossi/);
  } else {
    assert.match(src('lib/org.js'), /filter\(d => svolte\.has\(d\.id\)\)/);
  }
});

test('Formazione: formazione ed ergonomia per persona, con i totali', () => {
  const dip = [
    { id: 'a', nome: 'Anna Bianchi', attivo: true },
    { id: 'b', nome: 'Mario Rossi', attivo: true, area: 'reparto' },
    { id: 'c', nome: 'Carlo Cessato', attivo: false, data_cessazione: '2026-01-01' },
  ];
  const sessioni = [{ id: 's1', anno_programma: 1 }, { id: 's2', anno_programma: 2 }];
  const parts = [
    { dipendente_id: 'a', tipo: 'base', stato: 'svolta', data_svolgimento: '2025-10-01', sessione_formativa_id: 's1' },
    { dipendente_id: 'a', tipo: 'aggiornamento', stato: 'svolta', data_svolgimento: '2026-10-05', sessione_formativa_id: 's2' },
    { dipendente_id: 'b', tipo: 'base', stato: 'pianificata', sessione_formativa_id: 's1' },
    { dipendente_id: 'b', tipo: 'ergonomia', stato: 'svolta', data_svolgimento: '2025-11-02' },
  ];
  const m1 = monitoraggioPersone(dip, parts, sessioni, 1);
  assert.equal(m1.totale, 2, 'i cessati non si contano');
  assert.equal(m1.base, 1);
  assert.equal(m1.ergonomia, 1);
  assert.equal(m1.aggiornamento, null, 'nel primo anno non c\'è aggiornamento');
  assert.deepEqual(m1.righe.map(r => [r.nome, r.base.stato, r.ergonomia.stato]), [['Anna Bianchi', 'svolta', 'da_fare'], ['Mario Rossi', 'pianificata', 'svolta']]);
  const m2 = monitoraggioPersone(dip, parts, sessioni, 2);
  assert.equal(m2.aggiornamento, 1);
  assert.deepEqual(m2.righe[0].aggiornamento, { stato: 'svolta', data: '2026-10-05' });
  assert.match(src('pages/dashboard/formazione/[clientId].js'), /monitoraggioPersone\(dipendenti, partecipazioni, sessioni, params\.anno_programma \|\| 1\)/);
});

test('HR: dal link solo numeri, mai nomi', () => {
  const hr = src('pages/hr/[token].js');
  assert.match(hr, /SOLA LETTURA aggregata \(solo numeri k-anon\)/);
  assert.match(src('pages/api/hr/aggregati.js'), /MAI nomi/);
  assert.match(src('pages/api/org/[clientId]/export.js'), /ADMIN-ONLY \(requireAuth/);
});

test('sportello: solo dopo la firma, e i contatori si chiamano «Trattamenti L1 / L2»', () => {
  assert.match(src('pages/dashboard/[clientId].js'), /\{isFirmato\(client\.pipeline_stage\) && <SportelloAzienda /);
  assert.match(src('lib/sportello-server.js'), /aziende\.filter\(c => programmaAttivo\(c\) && \(clientId \|\| !c\.is_demo\)\)/);
  const s = src('components/sportello/Sportello.jsx');
  assert.match(s, /<strong>Trattamenti L1<\/strong>/);
  assert.match(s, /<strong>Trattamenti L2<\/strong>/);
  assert.doesNotMatch(s, /sedute su \{c\./);
});
