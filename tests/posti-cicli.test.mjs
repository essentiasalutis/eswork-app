// Posti per i nuovi ingressi, fase 1 (Enrico, 4/10 — contratto Art. 5-ter):
// ogni ciclo dal secondo consuma un posto da qualunque strada arrivi; il posto si consuma
// all'avvio del ciclo; chi è «nel prezzo» lo dice il segno fissato al Report (v84).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classificaCicli, nuovoCicloConsuma } from '../lib/posti.mjs';
import { postiAggiuntivi, postiNuoviL1, PROTOCOLLO } from '../lib/protocollo.mjs';

const src = f => fs.readFileSync(f, 'utf8');
const ciclo = (id, pid, quando, tipo = 'treatment') => ({ id, patient_id: pid, cycle_type: tipo, started_at: quando });

test('primo ciclo di chi è nel prezzo: compreso; secondo ciclo dal mini-check: posto', () => {
  // A era L1 al check-up: primo ciclo a ottobre, secondo a febbraio dopo il mini-check
  // (nessuna autosegnalazione). Prima il contatore non lo vedeva.
  const k = classificaCicli({
    cicli: [ciclo('c2', 'A', '2026-02-10'), ciclo('c1', 'A', '2025-10-27')],
    nelPrezzo: { A: 'level1' },
  });
  assert.deepEqual(k.cicli.map(c => [c.id, c.voce]), [['c1', 'incluso'], ['c2', 'secondo']]);
  assert.equal(k.inclusiL1, 1);
  assert.equal(k.secondiCicli, 1);
  assert.equal(k.consumati, 1);
});

test('il livello di oggi non conta: decide il segno fissato al Report', () => {
  // B era L1 al check-up ed è passato a L2 col check-up annuale: il suo primo ciclo resta
  // compreso (era nel prezzo). C è entrato in L1 durante l'anno: posto.
  const k = classificaCicli({
    cicli: [ciclo('b1', 'B', '2025-11-01'), ciclo('x1', 'C', '2026-01-15')],
    nelPrezzo: { B: 'level1', C: 'level2' },
  });
  assert.deepEqual(k.cicli.map(c => c.voce), ['incluso', 'nuovo_l1']);
  assert.equal(k.nuoviL1, 1);
});

test('neoassunti: il loro ciclo consuma sempre un posto, anche in L2', () => {
  const k = classificaCicli({
    cicli: [ciclo('n1', 'N', '2026-03-01', 'prevention'), ciclo('m1', 'M', '2026-03-02'), ciclo('p1', 'P', '2026-03-03', 'prevention')],
    nelPrezzo: { N: 'level2', P: 'level2' },
    neoassunti: new Set(['N', 'M']),
  });
  assert.deepEqual(k.cicli.map(c => [c.id, c.voce]), [['n1', 'prevenzione_fuori'], ['m1', 'nuovo_l1'], ['p1', 'incluso']]);
  assert.equal(k.prevenzioniNeoassunti, 1);
  assert.equal(k.inclusiL2, 1);
  assert.equal(k.consumati, 2);
});

test('il ciclo che sta per partire: stessa regola', () => {
  assert.equal(nuovoCicloConsuma({ cicliPersona: [], nelPrezzo: 'level1' }), false, 'primo ciclo di chi è nel prezzo');
  assert.equal(nuovoCicloConsuma({ cicliPersona: [ciclo('c1', 'A', '2025-10-01')], nelPrezzo: 'level1' }), true, 'secondo ciclo');
  assert.equal(nuovoCicloConsuma({ cicliPersona: [], nelPrezzo: 'level2' }), true, 'promosso a L1 durante l\'anno');
  assert.equal(nuovoCicloConsuma({ cicliPersona: [], nelPrezzo: 'level1', neoassunto: true }), true);
  assert.equal(nuovoCicloConsuma({ tipo: 'prevention', cicliPersona: [ciclo('t1', 'A', '2025-10-01')], nelPrezzo: 'level2' }), false, 'un ciclo di trattamento non conta per la prevenzione');
  const api = src('pages/api/pro/patients/[patientId]/start-cycle.js');
  assert.match(api, /if \(consuma\) \{\n\s*const capacity = await getTreatmentCapacity/);
  assert.match(api, /if \(capacity\?\.postiFiniti\)/);
});

test('posti e aggiuntivi fissati nel Report; il segno «nel prezzo» non si riscrive dopo la firma', () => {
  assert.equal(PROTOCOLLO.posti_aggiuntivi_pct, 0.05);
  assert.equal(postiNuoviL1(100), 15);
  assert.equal(postiAggiuntivi(100), 5);
  assert.equal(postiAggiuntivi(379), 19);
  const rep = src('pages/api/clients/[id]/generate-activation-report.js');
  assert.match(rep, /if \(!firmato\) await segnaNelPrezzo\(id\)/);
  const store = src('lib/store.js');
  assert.match(store, /\.eq\('client_id', client_id\)\.eq\('computed_level', livello\)\.eq\('neoassunto', false\);/);
  assert.match(src('supabase-schema-v84-nel-prezzo.sql'), /ADD COLUMN IF NOT EXISTS nel_prezzo text CHECK \(nel_prezzo IN \('level1', 'level2'\)\)/);
});

test('area del lavoratore: a fine ciclo si segnala, il secondo ciclo lo valuta l\'osteopata', () => {
  const s = src('pages/employee/[token].js');
  assert.match(s, /label="Segnala che il disturbo continua" descrizione="L'osteopata ti ricontatta per valutare se serve un nuovo ciclo\."/);
  assert.doesNotMatch(s, /Richiedi un nuovo ciclo/);
});

test('origine del segno (v85): «report» dal Report, ricostruito dallo script, sempre riconoscibile', () => {
  const store = src('lib/store.js');
  assert.match(store, /nel_prezzo: livello, nel_prezzo_origine: 'report', nel_prezzo_il: il/);
  const script = src('scripts/una-tantum/segna-nel-prezzo.mjs');
  assert.match(script, /const origine = modo === 'tracce' \? 'ricostruito_tracce' : 'ricostruito_livello';/);
  assert.match(script, /if \(scrivi && v85\.error\)/, 'senza v85 lo script non scrive');
  assert.match(src('supabase-schema-v85-origine-nel-prezzo.sql'), /CHECK \(nel_prezzo_origine IN \('report', 'ricostruito_livello', 'ricostruito_tracce'\)\)/);
});
