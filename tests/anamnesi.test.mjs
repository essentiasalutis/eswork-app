import test from 'node:test';
import assert from 'node:assert/strict';
import { anamnesiGiaCompilata } from '../lib/anamnesi.mjs';

test('anamnesi già compilata: da non sovrascrivere', () => {
  assert.equal(anamnesiGiaCompilata([{ type: 'anamnesi', status: 'completed' }]), true);
  assert.equal(anamnesiGiaCompilata([{ type: 'anamnesi', status: 'signed' }]), true);
});

test('prima compilazione ancora possibile', () => {
  assert.equal(anamnesiGiaCompilata([]), false);
  assert.equal(anamnesiGiaCompilata([{ type: 'consent_treatment', status: 'signed' }]), false);
  assert.equal(anamnesiGiaCompilata([{ type: 'anamnesi', status: 'draft' }]), false);
});

import { versioneCorrente, validaIntegrazione, valoreLeggibile, originaleDaDocumento, CAMPI_ANAMNESI, svuotato } from '../lib/anamnesi.mjs';

const originale = originaleDaDocumento({ form_data: { job_activity: 'Magazziniere', red_flags: false, nrs: 6, durata: '1-3m' }, pro_notes: 'Prima visita' });

test('versione corrente: originale + integrazioni in ordine; l\'originale resta', () => {
  const integrazioni = [
    { campo: 'job_activity', valore_prima: 'Carrellista', valore_dopo: 'Capoturno', creato_il: '2026-10-02T10:00:00Z' },
    { campo: 'job_activity', valore_prima: 'Magazziniere', valore_dopo: 'Carrellista', creato_il: '2026-10-01T10:00:00Z' },
  ];
  const v = versioneCorrente(originale, integrazioni);
  assert.equal(v.valori.job_activity, 'Capoturno');
  assert.equal(v.storia.job_activity.length, 2);
  assert.equal(v.storia.job_activity[0].valore_dopo, 'Carrellista');
  assert.equal(originale.job_activity, 'Magazziniere');
  assert.equal(v.valori.pro_notes, 'Prima visita');
});

test('motivo obbligatorio, riga breve', () => {
  assert.equal(validaIntegrazione(originale, { job_activity: 'Capoturno' }, '').ok, false);
  assert.equal(validaIntegrazione(originale, { job_activity: 'Capoturno' }, 'ok').ok, false);
  assert.equal(validaIntegrazione(originale, { job_activity: 'Capoturno' }, 'x'.repeat(201)).ok, false);
  assert.equal(validaIntegrazione(originale, { job_activity: 'Capoturno' }, 'Riferito alla seconda seduta').ok, true);
});

test('solo i campi cambiati diventano integrazioni; nessun cambio = errore', () => {
  const r = validaIntegrazione(originale, { job_activity: 'Magazziniere ', nrs: 4, red_flags: false }, 'Rivalutato in seduta');
  assert.deepEqual(r.righe.map(x => x.campo), ['nrs']);
  assert.equal(r.righe[0].valore_prima, 6);
  assert.equal(validaIntegrazione(originale, { job_activity: 'Magazziniere' }, 'nessun cambio').ok, false);
});

test('svuotare un campo si può, e si vede', () => {
  const r = validaIntegrazione(originale, { job_activity: '' }, 'Dichiarato per errore');
  assert.equal(r.ok, true);
  assert.equal(svuotato(r.righe[0]), true);
  assert.equal(r.righe[0].valore_prima, 'Magazziniere');
});

test('campi estranei e tipi sbagliati rifiutati', () => {
  assert.match(validaIntegrazione(originale, { level: 'level3' }, 'prova motivo').errore, /level/);
  assert.equal(validaIntegrazione(originale, { red_flags: 'sì' }, 'prova motivo').ok, false);
  assert.equal(validaIntegrazione(originale, { nrs: 11 }, 'prova motivo').ok, false);
});

test('valori leggibili', () => {
  assert.equal(valoreLeggibile('red_flags', true), 'Sì');
  assert.equal(valoreLeggibile('durata', '1-3m'), '1–3 mesi');
  assert.equal(valoreLeggibile('nrs', 6), '6/10');
  assert.equal(valoreLeggibile('notes', ''), '—');
  assert.ok(CAMPI_ANAMNESI.pro_notes);
});

test('il modulo intero, con l\'età come numero, integra solo ciò che cambia', () => {
  const corrente = { age: 48, pain_location: 'Collo', nrs: 4, red_flags: false };
  const r = validaIntegrazione(corrente, { age: 48, pain_location: 'Collo e spalla destra', nrs: '4', red_flags: false }, 'Riferito in seduta');
  assert.equal(r.ok, true);
  assert.deepEqual(r.righe.map(x => x.campo), ['pain_location']);
});

test('copia per il dipendente: dichiarato da lui, integrato dall\'osteopata con nome, data e motivo', async () => {
  const { anamnesiPerInteressato } = await import('../lib/anamnesi.mjs');
  const doc = { type: 'anamnesi', status: 'completed', signed_at: '2025-10-06T08:30:00Z', modalita: 'piattaforma', form_data: { pain_location: 'Collo', job_activity: 'Magazziniere' }, pro_notes: 'Test di Spurling negativo' };
  const integrazioni = [
    { id: 'a', campo: 'pain_location', valore_prima: 'Collo', valore_dopo: 'Collo e spalla destra', motivo: 'Riferito in seduta', creato_il: '2026-09-18T13:36:00Z', osteopata: 'Mario Rossi', gruppo: 'g1' },
    { id: 'b', campo: 'job_activity', valore_prima: 'Magazziniere', valore_dopo: '', motivo: 'Dichiarato per errore', creato_il: '2026-09-18T13:40:00Z', osteopata: 'Mario Rossi', gruppo: 'g2' },
  ];
  const a = anamnesiPerInteressato(doc, integrazioni);
  assert.equal(a.firmata_il, '06/10/2025');
  const orig = Object.fromEntries(a.originale_firmato.map(v => [v.voce, v]));
  assert.equal(orig['Zona / sede del dolore'].valore, 'Collo');
  assert.match(orig['Zona / sede del dolore'].fonte, /dichiarato da te/);
  assert.match(orig['Note cliniche del professionista'].fonte, /scritto dall'osteopata/, 'le note del professionista incluse, e non attribuite al paziente');
  const corr = Object.fromEntries(a.versione_corrente.map(v => [v.voce, v]));
  assert.equal(corr['Zona / sede del dolore'].valore, 'Collo e spalla destra');
  assert.match(corr['Zona / sede del dolore'].fonte, /integrato dall'osteopata Mario Rossi il 18\/09\/2026.*Riferito in seduta.*nell'originale: Collo/);
  assert.equal(corr['Mansione / attività svolta'].valore, 'campo svuotato');
  assert.match(corr['Mansione / attività svolta'].fonte, /rimosso.*nell'originale: Magazziniere/);
  assert.equal(a.integrazioni_successive_alla_firma.length, 2);
  assert.equal(a.integrazioni_successive_alla_firma[1].dopo, 'campo svuotato');
});

test('senza anamnesi firmata la copia non la inventa', async () => {
  const { anamnesiPerInteressato } = await import('../lib/anamnesi.mjs');
  assert.equal(anamnesiPerInteressato(null, []), null);
  assert.equal(anamnesiPerInteressato({ type: 'anamnesi', status: 'draft' }, []), null);
});
