// Proiezioni verso il browser (ricerca del 21/9): dalle righe intere escono solo i
// campi che le pagine disegnano. Qui i campi che NON devono mai uscire.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { vistaDocumentoCartella, vistaLeadBuono, vistaCodaPrevalidazione, vistaAziendaPerPro, vistaPrevalidazioniCartella, vistaMiniCheckCartella, vistaRivalutazioneCartella } from '../lib/vista.js';
import { AVVISO_COPIA_NOTE } from '../lib/copia-dati.mjs';

const nessuno = (o, campi, dove) => { const t = JSON.stringify(o); for (const c of campi) assert.ok(!t.includes(`"${c}"`), `${dove}: «${c}» non deve uscire`); };

test('documenti del paziente nella cartella: niente dispositivo, file o firma', () => {
  const d = { id: 'd1', patient_id: 'p1', type: 'anamnesi', status: 'signed', content_hash: 'abc', signature_image: 'data:…', ip_hash: 'h', user_agent: 'Safari', file_path: 'x/y.pdf', pro_notes: 'nota', form_data: { nrs: 6, red_flags: 'sì', farmaci: 'x' }, testo_legale_id: 't1' };
  const v = vistaDocumentoCartella(d);
  assert.deepEqual(v.form_data, { nrs: 6 }, 'dell\'anamnesi esce solo l\'NRS che legge il modulo della seduta');
  assert.equal(v.testo_legale_id, 't1');
  nessuno(v, ['signature_image', 'ip_hash', 'user_agent', 'file_path', 'pro_notes', 'red_flags', 'farmaci'], 'documento');
  assert.equal(vistaDocumentoCartella({ ...d, type: 'consenso' }).form_data, null);
});

test('richiesta di buono: niente IP, importi, riscatti', () => {
  const v = vistaLeadBuono({ id: 'l1', patient_name: 'Anna', patient_phone: '333', patient_email: 'a@x', preferred_when: 'mattina', voucher_code: 'V1', ip: '1.2.3.4', amount: 40, redeemed_by: 'pro', location: 'Torino', confirm_response: 'si', referral_codes: { type: 'P', client_id: 'c1', clients: { name: 'Acme' } } });
  assert.equal(v.referral_codes.clients.name, 'Acme');
  nessuno(v, ['ip', 'amount', 'redeemed_by', 'location', 'confirm_response', 'client_id'], 'buono');
});

test('coda di pre-validazione, azienda per il professionista', () => {
  nessuno(vistaCodaPrevalidazione({ id: 'w1', patient_id: 'p1', client_id: 'c1', source: 'self_declaration', notes: 'n', score: 100, cohort: 'x', assigned_professional_id: 'pro', patients: { first_name: 'A', last_name: 'B', level: 'level1', clients: { name: 'Acme' } } }), ['score', 'cohort', 'assigned_professional_id', 'level'], 'coda');
  assert.deepEqual(Object.keys(vistaAziendaPerPro({ id: 'c1', name: 'Acme', sconto_motivo: 'x', sforamento_forbice_motivo: 'y', contact_email: 'z' })), ['id', 'name']);
});

test('cartella del curante: pre-validazione, mini-check, rivalutazione annuale', () => {
  const [v] = vistaPrevalidazioniCartella([{ id: 'v1', created_at: 'x', outcome: 'l1_confirmed', nrs_during_call: 7, pain_zone: 'Collo', symptom_duration_months: 9, duration_minutes: 25, clinical_notes: 'nota', professional_id: 'pro', client_id: 'c1', patient_id: 'p1' }]);
  assert.equal(v.clinical_notes, 'nota', 'le note si vedono: le scrive il curante');
  nessuno(v, ['professional_id', 'client_id', 'patient_id'], 'pre-validazione');
  const [m] = vistaMiniCheckCartella([{ id: 'm1', check_type: 't3', pgic: 4, has_limitations: true, wants_contact: false, triage_outcome: 'needs_contact', free_text: 'scritto dal lavoratore', client_id: 'c1', patient_id: 'p1' }]);
  assert.equal(m.pgic, 4);
  nessuno(m, ['free_text', 'client_id', 'patient_id'], 'mini-check');
  nessuno(vistaRivalutazioneCartella({ completed_at: 'x', computed_level: 'level2', pgic: 4, nmq_data: { a: 1 }, client_id: 'c1' }), ['nmq_data', 'client_id'], 'rivalutazione');
  assert.equal(vistaRivalutazioneCartella(null), null);
});

test('ogni campo di note dell\'osteopata dice, prima di scrivere, che il paziente può riceverle', () => {
  for (const f of ['components/PatientDocuments.jsx', 'pages/osteopath/prevalidation/[patientId].js', 'pages/pro/patients/[patientId].js']) {
    assert.match(fs.readFileSync(f, 'utf8'), /AVVISO_COPIA_NOTE/, f);
  }
  const cartella = fs.readFileSync('pages/pro/patients/[patientId].js', 'utf8');
  assert.equal((cartella.match(/\{AVVISO_COPIA_NOTE\}/g) || []).length, 4, 'note e indicazioni, nella seduta nuova e in quella da modificare');
  assert.match(AVVISO_COPIA_NOTE, /copia dei suoi dati/);
});

test('la pre-validazione entra nelle due copie dei dati', () => {
  assert.match(fs.readFileSync('pages/api/employee/[token]/export.js', 'utf8'), /pre_validazioni: preValidazioni/);
  assert.match(fs.readFileSync('pages/dashboard/patients/[patientId]/export.js', 'utf8'), /Pre-validazione clinica/);
});
