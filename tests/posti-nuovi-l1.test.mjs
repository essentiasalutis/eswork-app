// Posti per i nuovi Livello 1 e report a tre mesi (Enrico, 30/9).
// • Posti: il 15% di TUTTI i dipendenti, per eccesso, ogni anno di programma. Il prezzo
//   comprende per ogni posto un percorso di trattamento + una pre-validazione. Prima era
//   una scorta del 20% sulla parte clinica: resta solo per le Stime registrate prima.
// • Il box della scheda mostra solo presi e disponibili; niente più «L1 a contratto».
// • Il report a tre mesi segue SOLO il Livello 1: percorsi avviati e conclusi.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PROTOCOLLO, postiNuoviL1 } from '../lib/protocollo.mjs';
import { calculatePricing } from '../lib/pricing/v2.js';
import { parametriDaStimaCongelata } from '../lib/pricing/v2-defaults.mjs';
import { sezioneMovimento } from '../lib/movimento.js';
import { CONFIG } from '../lib/config.js';

const src = f => fs.readFileSync(f, 'utf8');
const R = CONFIG.rates_new;

test('posti: 15% dei dipendenti, per eccesso', () => {
  assert.equal(PROTOCOLLO.nuovi_l1_pct, 0.15);
  assert.equal(postiNuoviL1(12), 2, 'Weisoft: 1,8 → 2');
  assert.equal(postiNuoviL1(100), 15);
  assert.equal(postiNuoviL1(300), 45);
  assert.equal(postiNuoviL1(20), 3);
  assert.equal(postiNuoviL1(7), 2, '1,05 → 2');
  assert.equal(postiNuoviL1(0), 0);
  assert.equal(postiNuoviL1(null), 0);
});

test('prezzo: ogni posto è un percorso di trattamento + una pre-validazione', () => {
  const c = calculatePricing({ rates: R, n: 100, l1: 12, l2: 24 });
  const oreCiclo = PROTOCOLLO.sedute_per_ciclo * PROTOCOLLO.durata_seduta_min / 60;
  const posto = oreCiclo * R.sportello_sell + R.prevalidation_sell;
  assert.equal(c.y1.posti_nuovi_l1, 15);
  assert.equal(c.y1.nuovi_l1_pct, 0.15);
  assert.equal(c.y1.buffer_pct, null);
  assert.equal(c.y1.buffer_sell, 15 * posto);
  assert.equal(c.y1.buffer_cost, 15 * (oreCiclo * R.sportello_cost + R.prevalidation_cost));
  // non dipende da quanti L1 ha il check-up
  assert.equal(calculatePricing({ rates: R, n: 100, l1: 3, l2: 6 }).y1.buffer_sell, c.y1.buffer_sell);
});

test('Stime registrate prima del 30/9: la scorta di allora, 20% della parte clinica', () => {
  const vecchio = parametriDaStimaCongelata({ quota_programma_fissa: 1500, quota_programma_per_dipendente: 15 });
  assert.equal(vecchio.scorta_su_clinica, true);
  const nuovo = parametriDaStimaCongelata({ quota_programma_fissa: 1500, quota_programma_per_dipendente: 15, nuovi_l1_pct: 0.15 });
  assert.equal(nuovo.scorta_su_clinica, undefined);
  const c = calculatePricing({ rates: R, n: 100, l1: 12, l2: 24, v2Params: vecchio });
  assert.equal(c.y1.buffer_pct, 0.2);
  assert.equal(c.y1.posti_nuovi_l1, null);
  // le Stime nuove prendono nuovi_l1_pct dal Listino (DEFAULTS_V2 + protocollo)
  assert.match(src('lib/pricing/settings.js'), /const params = \{ \.\.\.DEFAULTS_V2 \};/);
  assert.match(src('lib/pricing/settings.js'), /return \{ params: conProtocollo\(params\), texts \};/);
});

test('capacità: posti del 15%, presi = autosegnalazioni prese in carico + promozioni a L1', () => {
  const store = src('lib/store.js');
  const cap = store.slice(store.indexOf('export async function getTreatmentCapacity'), store.indexOf('// Mini-check di un\'azienda'));
  assert.match(cap, /const posti = postiNuoviL1\(dipendenti\);/);
  assert.match(cap, /\.eq\('source', 'self_trigger'\)/);
  assert.match(cap, /\.eq\('status', 'confirmed_l1'\)/);
  assert.match(cap, /intakeSaturated: dipendenti > 0 && presi >= posti/);
  assert.doesNotMatch(store, /contracted_l1/, 'il numero scritto a mano non esiste più');
  assert.doesNotMatch(store, /getBufferStatusByClient|getSelfTriggersByClient/);
  assert.equal(fs.existsSync('pages/api/clients/[id]/buffer-status.js'), false);
});

test('scheda: box «Posti per i nuovi ingressi» con presi e disponibili, niente «L1 a contratto»', () => {
  const s = src('pages/dashboard/[clientId].js');
  assert.match(s, /🎯 Posti per i nuovi ingressi/);
  assert.match(s, /\{capacity\.presi\} presi su \{capacity\.posti\}/);
  assert.match(s, /capacity\.disponibili === 1 \? 'disponibile' : 'disponibili'/);
  assert.doesNotMatch(s, /contracted|L1 a contratto|saveContractedL1/);
  const r = src('pages/dashboard/restratifications.js');
  assert.match(r, /getTreatmentCapacity\(client_id\)/);
  assert.doesNotMatch(r, /SESSIONS_PER_NEW_L1|BufferBar|buffer-status/);
});

test('report a tre mesi: solo i percorsi del Livello 1, avviati e conclusi', () => {
  const t = sezioneMovimento({ movimenti: { trattamentiAvviati: 7, trattamentiChiusi: 0 } });
  assert.match(t, /^## I percorsi di trattamento nei primi 3 mesi/);
  assert.match(t, /Livello 1, dall'avvio del programma: 7 percorsi di trattamento avviati; nessun percorso concluso\./);
  assert.doesNotMatch(t, /prevenzione|Livello 2|Livello 3|nuovi ingressi|segnalazion/i);
  const piccoli = sezioneMovimento({ movimenti: { trattamentiAvviati: 2, trattamentiChiusi: 1 } });
  assert.match(piccoli, /I percorsi avviati e i percorsi conclusi: ciascuno meno di 3, quindi non pubblicati per riservatezza\./);
  assert.doesNotMatch(piccoli, /\b[12] percors/);

  const g = src('pages/api/clients/[id]/generate-checkpoint-report.js');
  assert.match(g, /\$\{checkpoint === 't3' \? datiT3 : `DATI CLINICI/);
  assert.match(g, /PERIMETRO \(tassativo, Enrico 30\/9\)/);
  assert.match(g, /VIETATO parlare di Livello 2, Livello 3, prevenzione, formazione, ergonomia, nuovi ingressi o distribuzione per livello/);
  const datiT3 = g.slice(g.indexOf('const datiT3 = `'), g.indexOf('const isAnnual'));
  assert.doesNotMatch(datiT3, /prevenzione|righeLivelli|formazioneTxt/i);
  // la versione di riserva (senza AI) a tre mesi non parla di L2 né della distribuzione
  const riserva = g.slice(g.indexOf("if (checkpoint === 't3') {\n    return `## Highlights"), g.indexOf("  return `## Highlights Principali a ${checkLabel}\n\nIl programma ES Work"));
  assert.ok(riserva.length > 100);
  assert.doesNotMatch(riserva, /L2|prevenzione|righeTabella|rigaPazienti/);
  assert.doesNotMatch(g, /getSelfTriggersByClient/);
});

test('tabella Pazienti: le date dei percorsi si compilano dalle registrazioni dell\'osteopata', async () => {
  const { percorsiDelPaziente, nomePercorso, statoPercorso } = await import('../lib/percorsi-paziente.mjs');
  const cicli = [
    { id: 'c2', patient_id: 'p1', cycle_type: 'treatment', status: 'active', started_at: '2026-03-01' },
    { id: 'c1', patient_id: 'p1', cycle_type: 'treatment', status: 'closed', started_at: '2025-10-01' },
    { id: 'c3', patient_id: 'p1', cycle_type: 'prevention', status: 'active', started_at: '2026-01-10', sessions_planned: null },
    { id: 'cx', patient_id: 'p2', cycle_type: 'treatment', status: 'active', started_at: '2025-10-01' },
  ];
  const sedute = [
    { patient_id: 'p1', cycle_id: 'c1', date: '2025-10-08', closed_at: '2025-10-08' },
    { patient_id: 'p1', cycle_id: 'c1', date: '2025-10-01', closed_at: '2025-10-01' },
    { patient_id: 'p1', cycle_id: 'c2', date: '2026-03-05', closed_at: null },
    { patient_id: 'p1', cycle_id: null, date: '2025-09-20', closed_at: '2025-09-20' },
    { patient_id: 'p2', cycle_id: 'cx', date: '2025-10-02', closed_at: '2025-10-02' },
  ];
  const r = percorsiDelPaziente('p1', cicli, sedute);
  assert.deepEqual(r.percorsi.map(c => [nomePercorso(c), c.fatte, c.previste, statoPercorso(c)]), [
    ['Trattamento 1', 2, PROTOCOLLO.sedute_per_ciclo, 'concluso'],
    ['Prevenzione', 0, PROTOCOLLO.sessioni_prevenzione_l2, null],
    ['Trattamento 2', 0, PROTOCOLLO.sedute_per_ciclo, null],
  ]);
  assert.deepEqual(r.percorsi[0].date.map(d => d.il), ['2025-10-01', '2025-10-08'], 'in ordine di data');
  assert.deepEqual(r.percorsi[2].date, [{ il: '2026-03-05', chiusa: false }]);
  assert.deepEqual(r.fuori, [{ il: '2025-09-20', chiusa: true }]);
  assert.deepEqual(percorsiDelPaziente('p3', cicli, sedute), { percorsi: [], fuori: [] });
  const s = src('pages/dashboard/[clientId].js');
  assert.match(s, /\.\.\.percorsiDelPaziente\(p\.id, cicli, sessionsRaw\)/);
  assert.doesNotMatch(s, /visitato/i, 'nessun pulsante «visitato»: sarebbe un doppione');
  assert.doesNotMatch(src('lib/percorsi-paziente.mjs'), /org_|formazione_/, 'la formazione resta fuori');
});

test('report a tre mesi: conta i primi tre mesi dell\'anno, non tutto lo storico', async () => {
  const { finestraTreMesi, nellaFinestra } = await import('../lib/movimento.js');
  assert.equal(finestraTreMesi(null), null, 'senza data di avvio si conta tutto');
  // Officine: avvio 22/9/2025. Il 30/9/2026 i tre mesi del 2° anno non sono ancora passati:
  // il report racconta i primi tre mesi del 1° anno.
  const f = finestraTreMesi('2025-09-22', new Date('2026-09-30T10:00:00Z'));
  assert.deepEqual(f, { anno: 1, dal: null, al: '2025-12-21T23:00:00.000Z' });
  assert.equal(nellaFinestra('2025-10-27T09:30:00Z', f), true);
  assert.equal(nellaFinestra('2025-09-01T09:30:00Z', f), true, 'il primo anno è aperto all\'indietro');
  assert.equal(nellaFinestra('2026-02-06T09:30:00Z', f), false);
  // passati i tre mesi del 2° anno: la finestra è quella del 2° anno
  const f2 = finestraTreMesi('2025-09-22', new Date('2027-01-10T10:00:00Z'));
  assert.equal(f2.anno, 2);
  assert.equal(f2.dal, '2026-09-21T22:00:00.000Z');
  assert.equal(f2.al, '2026-12-21T23:00:00.000Z');
  // mesi più corti: 30/11 + 3 mesi → 28/2
  assert.equal(finestraTreMesi('2025-11-30', new Date('2025-12-15T10:00:00Z')).al, '2026-02-27T23:00:00.000Z');
  const { sezioneMovimento } = await import('../lib/movimento.js');
  assert.match(sezioneMovimento({ movimenti: { trattamentiAvviati: 4, trattamentiChiusi: 3 }, anno: 2 }), /Livello 1, dall'inizio del 2° anno di programma: 4 percorsi di trattamento avviati; 3 percorsi conclusi\./);
  const g = src('pages/api/clients/[id]/generate-checkpoint-report.js');
  assert.match(g, /const fT3 = finestraTreMesi\(client\.data_avvio_programma \|\| null\);/);
  assert.match(g, /movimenti: \{ trattamentiAvviati: cicliL1\.length, trattamentiChiusi: conclusiL1 \}/);
});
