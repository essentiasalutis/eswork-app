// Riaprire il check-up dopo il Report di Attivazione (Enrico, 28/9, v82): «se su 12
// hanno risposto 9, gli ultimi 3 devono poterlo fare; se riapro poi rifaccio il Report
// e si aggiornano presentazione e proposta». Riaprire fa decadere il Report.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inizioAnalisi, statoCheckup } from '../lib/checkup.js';

const src = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('inizio dell\'analisi: dall\'avvio, oppure dalla riapertura dopo il Report', () => {
  const avvio = '2026-09-14T08:00:00+00:00';
  assert.equal(inizioAnalisi({ created_at: avvio }), avvio);
  assert.equal(inizioAnalisi({ created_at: avvio, riaperto_dopo_report_at: null }), avvio);
  assert.equal(inizioAnalisi({ created_at: avvio, riaperto_dopo_report_at: '2026-09-29T10:00:00.000Z' }), '2026-09-29T10:00:00.000Z');
  // una data di riapertura più vecchia dell'avvio non conta
  assert.equal(inizioAnalisi({ created_at: avvio, riaperto_dopo_report_at: '2026-09-01T10:00:00Z' }), avvio);
  assert.equal(inizioAnalisi(null), null);
});

test('riaperto: il link torna ad accettare risposte; con il Report nuovo si richiude', () => {
  const now = new Date('2026-09-30T10:00:00Z');
  const a = { status: 'active', created_at: '2026-09-14T08:00:00Z', chiude_il: '2026-10-05', riaperto_dopo_report_at: '2026-09-29T10:00:00Z' };
  // il Report del 28/9 è decaduto: nessun Report valido dopo la riapertura
  assert.equal(statoCheckup({ assessment: a, reportDopo: false, now }).accetta, true);
  // appena si rigenera il Report l'analisi si congela di nuovo
  assert.equal(statoCheckup({ assessment: a, reportDopo: true, now }).accetta, false);
});

test('ogni «c\'è un Report?» parte dall\'inizio dell\'analisi, non più dall\'avvio', () => {
  const srv = src('lib/checkup-server.js');
  assert.match(srv, /const reportDopo = assessment \? await reportAttivazioneDopo\(client\.id, inizioAnalisi\(assessment\)\) : false;/);
  assert.equal((srv.match(/reportAttivazioneDopo\(a\.client_id, inizioAnalisi\(a\)\)/g) || []).length, 2, 'solleciti e agenda');
  assert.ok(!/reportAttivazioneDopo\([^)]*\.created_at\)/.test(srv));
  assert.match(src('lib/presentazione-server.js'), /ultimoReportAttivazione\(clientId, inizioAnalisi\(a\)\)/);
  assert.match(src('pages/dashboard/offer.js'), /ultimoReportAttivazione\(client\.id, inizioAnalisi\(assessment\)\)/);
  assert.match(src('pages/dashboard/[clientId].js'), /Date\.parse\(r\.created_at\) >= Date\.parse\(inizioAnalisi\(a\)\)/);
});

test('API: dopo il Report si riapre solo in modo esplicito, mai dopo la firma; senza v82 non si riapre', () => {
  const api = src('pages/api/assessments/[id].js');
  assert.match(api, /const puoRiaprire = status === 'active' && req\.body && req\.body\.dopoReport === true\n\s+&& assessment\.type === 'initial' && !isFirmato\(cliente\);/);
  assert.match(api, /fields\.riaperto_dopo_report_at = now;/);
  assert.match(api, /Serve la migration v82 \(riapertura dopo il Report\)/);
  assert.match(api, /Il contratto è firmato: il Report di Attivazione è l\\'Allegato A e il check-up non si riapre\./);
  assert.match(src('supabase-schema-v82-riapertura-dopo-report.sql'), /ALTER TABLE public\.assessments ADD COLUMN IF NOT EXISTS riaperto_dopo_report_at timestamptz;/);
});

test('prezzo: fissato solo finché il Report vale; la Stima resta congelata', () => {
  const sconto = src('lib/sconto-server.js');
  assert.equal((sconto.match(/if \(await reportAttivazioneValido\(clientId\)\) return/g) || []).length, 2);
  assert.ok(!/isChainClosed/.test(sconto));
  assert.match(src('pages/dashboard/offer.js'), /prezzoFissato: !!rep,/);
  // la Stima (la promessa del colloquio) usa ancora la regola di prima: nessun Report la riapre
  assert.match(src('lib/pricing/snapshot.js'), /if \(\(existing && existing\.frozen_at\) \|\| await isChainClosed\(client_id\)\)/);
});

test('scheda: «Riapri» dopo il Report con la conferma, e la nota finché il Report non si rigenera', () => {
  const s = src('pages/dashboard/[clientId].js');
  assert.match(s, /onClick=\{\(\) => prorogaCheckup\(a, true, true, /);
  assert.match(s, /Il Report di Attivazione attuale non varrà più: presentazione e proposta di intervento tornano in bozza finché non lo rigeneri\./);
  assert.match(s, /&& !isFirmato\(client\.pipeline_stage\) && !\(idAperto && idAperto !== a\.id\);/);
  assert.match(s, /🔓 Riaperto il \{dataIt\(a\.riaperto_dopo_report_at\)\} dopo il Report di Attivazione/);
  assert.match(src('pages/dashboard/presentazione/[clientId].js'), /Il check-up è stato riaperto il \$\{dataIt\(d\.riapertoIl/);
  assert.match(src('pages/dashboard/offer.js'), /Il check-up è stato riaperto il \{dataIt\(assessment\.riaperto_dopo_report_at\)\}/);
});

test('«Riapri» con la data già proposta (oggi + 7 giorni) e il pulsante subito attivo (28/9)', () => {
  const s = src('pages/dashboard/[clientId].js');
  assert.match(s, /value=\{dataProroga\[a\.id\] \|\| aggiungiGiorni\(oggiRoma\(\), 7\)\}/);
  assert.match(s, /onClick=\{\(\) => prorogaCheckup\(a, true, true, dataProroga\[a\.id\] \|\| aggiungiGiorni\(oggiRoma\(\), 7\)\)\}\n/);
});

test('elenco aziende: niente «N assessment · N attivo» (28/9)', () => {
  const d = src('pages/dashboard/index.js');
  assert.ok(!/\} assessment<\/span>|\} attivo\n/.test(d));
  assert.ok(!/getAssessmentCounts/.test(d + src('lib/store.js')));
});

test('scheda: «in valutazione» e «programma attivato» si spiegano al passaggio del mouse (28/9)', () => {
  const s = src('pages/dashboard/[clientId].js');
  assert.match(s, /aria-label="Informazioni sul testo per i dipendenti"/);
  assert.match(s, /title=\{'Quale messaggio per i dipendenti prepara «Invia link al referente HR»/);
  assert.match(s, /\['valutazione', 'in valutazione', 'Prima della firma\./);
  assert.match(s, /\['avvio', 'programma attivato', 'Dopo la firma\./);
  assert.match(s, /<button key=\{v\} title=\{spiega\}/);
});
