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
