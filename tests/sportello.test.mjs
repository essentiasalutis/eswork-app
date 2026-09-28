// Calendario dello sportello, fase 1 (Enrico, 28/9): le otto risposte, una per prova.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SPORTELLO, postiDaOrario, controllaGiornata, postiOccupati, conflitti, aggiungiMesi,
  trimestriAnno, prevenzioneTrimestre, statoPercorso, seduteAContratto,
} from '../lib/sportello.mjs';

const src = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const alle = (giorno, ora = '10:00') => new Date(`${giorno}T${ora}:00+02:00`);

test('posti: durata ÷ 30 minuti, minimo 3 ore (6 posti), mai più di quanti ne stanno (risposta 7)', () => {
  assert.equal(postiDaOrario('09:00', '16:00'), 14);
  assert.equal(postiDaOrario('09:00', '12:00'), 6);
  const base = { client_id: 'c', data: '2026-10-06', ora_inizio: '09:00', ora_fine: '16:00', posti: 14 };
  assert.deepEqual(controllaGiornata(base), []);
  assert.match(controllaGiornata({ ...base, ora_fine: '11:30', posti: 5 }).join(' '), /almeno 3 ore/);
  assert.match(controllaGiornata({ ...base, posti: 5 }).join(' '), /almeno 6/);
  assert.match(controllaGiornata({ ...base, posti: 15 }).join(' '), /al massimo 14/);
  assert.equal(SPORTELLO.posti_minimi, 6);
});

test('posti occupati: numeri dell\'osteopata; sei persone di ergonomia fanno un posto (risposte 1 e 7)', () => {
  assert.equal(postiOccupati({ sedute_prenotate: null, ergonomia_persone: null }), null);
  assert.equal(postiOccupati({ sedute_prenotate: 4, ergonomia_persone: 6 }), 5);
  assert.equal(postiOccupati({ sedute_prenotate: 4, ergonomia_persone: 7 }), 6);
  assert.equal(postiOccupati({ sedute_prenotate: 0, ergonomia_persone: null }), 0);
});

test('conflitti: stesso osteopata, stesso giorno, orari sovrapposti, anche in aziende diverse', () => {
  const g = (id, prof, data, a, b, extra = {}) => ({ id, professional_id: prof, data, ora_inizio: a, ora_fine: b, stato: 'pianificata', ...extra });
  assert.deepEqual(conflitti([g('1', 'p', '2026-10-06', '09:00', '13:00'), g('2', 'p', '2026-10-06', '12:00', '16:00')]), [['1', '2']]);
  assert.deepEqual(conflitti([g('1', 'p', '2026-10-06', '09:00', '12:00'), g('2', 'p', '2026-10-06', '12:00', '16:00')]), []);
  assert.deepEqual(conflitti([g('1', 'p', '2026-10-06', '09:00', '13:00'), g('2', 'q', '2026-10-06', '09:00', '13:00')]), []);
  assert.deepEqual(conflitti([g('1', 'p', '2026-10-06', '09:00', '13:00'), g('2', 'p', '2026-10-06', '10:00', '14:00', { stato: 'annullata' })]), []);
});

test('trimestri dell\'anno di programma: dalla data di avvio, il 31 diventa fine mese', () => {
  assert.equal(aggiungiMesi('2026-01-31', 1), '2026-02-28');
  const t = trimestriAnno('2026-10-08', alle('2026-11-20'));
  assert.deepEqual(t.map(x => [x.inizio, x.fine]), [['2026-10-08', '2027-01-08'], ['2027-01-08', '2027-04-08'], ['2027-04-08', '2027-07-08'], ['2027-07-08', '2027-10-08']]);
  assert.equal(trimestriAnno(null), null);
});

test('Livello 2: allarme due settimane prima della fine del trimestre, non dopo (risposta 3)', () => {
  const avvio = '2026-10-08';
  assert.equal(prevenzioneTrimestre({ dataAvvio: avvio, date: [], adesso: alle('2026-12-20') }).allarme, false, '19 giorni prima: ancora niente');
  const t = prevenzioneTrimestre({ dataAvvio: avvio, date: [], adesso: alle('2026-12-25') });
  assert.equal(t.allarme, true);
  assert.equal(t.restano, 14);
  assert.equal(t.ultimoGiorno, '2027-01-07');
  assert.equal(prevenzioneTrimestre({ dataAvvio: avvio, date: ['2026-11-03'], adesso: alle('2026-12-30') }).allarme, false, 'seduta fatta nel trimestre');
  const dopo = prevenzioneTrimestre({ dataAvvio: avvio, date: [], adesso: alle('2027-01-10') });
  assert.equal(dopo.trimestri[0].stato, 'persa');
  assert.equal(dopo.allarme, false, 'nel trimestre nuovo non si è ancora a due settimane dalla fine');
});

test('stato del percorso: solo conteggi e date, mai dolore o note', () => {
  const righe = statoPercorso({
    cicli: [{ id: 'c1', cycle_type: 'treatment', status: 'active', cycle_number: 1, sessions_planned: 4, sessions_completed: 2, started_at: '2026-10-01T09:00:00Z', nrs_pre: 7, treatment_notes: 'segreto' }],
    autosegnalazioni: [{ status: 'pending', created_at: '2026-10-20T09:00:00Z', note: 'segreto' }],
    livello: 'level1', adesso: alle('2026-10-31'),
  });
  assert.deepEqual(righe, ['Ciclo 1: 2 sedute su 4, aperto da 30 giorni', 'Autosegnalazione in attesa da 11 giorni']);
  assert.ok(!/segreto|NRS|dolore/.test(righe.join(' ')));
});

test('sedute a contratto: persone di Livello 1 e 2 del Report × 4 (risposta 4)', () => {
  assert.deepEqual(seduteAContratto({ l1: 3, l2: 8 }), { l1: 12, l2: 32, personeL1: 3, personeL2: 8 });
  assert.equal(seduteAContratto(null), null);
  assert.match(src('pages/api/clients/[id]/generate-activation-report.js'), /persone_l1: real\.l1, persone_l2: real\.l2,/);
});

test('ogni vista riceve solo ciò che mostra: l\'azienda mai i prenotati né i nomi, nessuna nota clinica (risposta 2)', () => {
  const srv = src('lib/sportello-server.js');
  const azienda = srv.slice(srv.indexOf('export async function giornateAzienda'));
  assert.match(azienda, /map\(x => \(\{ data: x\.data, ora_inizio: x\.ora_inizio, ora_fine: x\.ora_fine, sede: x\.sede, stanza: x\.stanza, posti: x\.posti \}\)\)/);
  assert.ok(!/sedute_prenotate|ergonomia_persone|professional/.test(azienda.split('\n').slice(0, 6).join('\n')));
  // dalla banca dati: mai NRS né note
  assert.ok(!/nrs_|treatment_notes|clinical_notes|next_session_notes|anamnes/.test(srv), 'nessun campo clinico letto');
  // l'osteopata scrive solo numeri, solo sulle sue giornate
  assert.match(srv, /if \(!g \|\| g\.professional_id !== proId\) return \{ errore: 'Questa giornata non è tua\.' \}/);
  // la tabella non tocca le persone (fase 1)
  const v80 = src('supabase-schema-v80-sportello-giornate.sql');
  assert.ok(!/patient/i.test(v80.replace(/^--.*$/gm, '')), 'nessun paziente nel calendario');
  assert.match(v80, /REVOKE ALL ON public\.sportello_giornate FROM anon, authenticated;/);
  const hr = src('pages/api/hr/sportello.js');
  assert.match(hr, /if \(!client_id\) return res\.status\(200\)\.json\(\{ ok: false \}\);/);
});

test('due viste, una funzione: la sezione «Sportello» e la scheda azienda chiamano la stessa API', () => {
  assert.match(src('pages/dashboard/sportello.js'), /fetch\(`\/api\/sportello\?da=\$\{lunedi\}&a=\$\{domenica\}`\)/);
  assert.match(src('components/sportello/SportelloAzienda.jsx'), /fetch\(`\/api\/sportello\?da=\$\{da\}&a=\$\{a\}&clientId=/);
  assert.match(src('pages/api/sportello/index.js'), /datiSportello\(\{ da, a, clientId: clientId \|\| null \}\)/);
  assert.match(src('components/NavMenu.js'), /href: '\/dashboard\/sportello', label: 'Sportello'/);
});

test('prevenzione: si contano solo le sedute dell\'anno di programma in corso (prova su Officine, 28/9)', () => {
  const cicli = [{ id: 'p1', cycle_type: 'prevention', status: 'closed', sessions_planned: 4, sessions_completed: 4, started_at: '2025-10-01T09:00:00Z' }];
  const seduteDate = { p1: ['2025-10-05', '2026-01-10', '2026-04-10', '2026-07-10'] };
  const righe = statoPercorso({ cicli, seduteDate, livello: 'level2', dataAvvio: '2025-09-22', adesso: alle('2026-10-15') });
  assert.equal(righe[0], 'Prevenzione di quest\'anno non ancora avviata');
  assert.match(righe[1], /^Prevenzione: 0 sedute su 4 nell'anno; trimestre 1: seduta da fare entro il 21\/12\/2026$/);
  const ok = statoPercorso({ cicli, seduteDate: { p1: [...seduteDate.p1, '2026-10-02'] }, livello: 'level2', dataAvvio: '2025-09-22', adesso: alle('2026-10-15') });
  assert.equal(ok[0], 'Prevenzione: 1 seduta su 4 nell\'anno; trimestre 1: seduta fatta');
  assert.deepEqual(controllaGiornata({ client_id: 'c', data: '2026-10-06', ora_inizio: '09:00', ora_fine: '11:00', posti: 6 }), ['Una giornata dura almeno 3 ore.']);
});
