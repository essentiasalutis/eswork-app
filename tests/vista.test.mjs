// Proiezioni verso il browser (ricerca del 21/9): dalle righe intere escono solo i
// campi che le pagine disegnano. Qui i campi che NON devono mai uscire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { vistaDocumentoCartella, vistaLeadBuono, vistaSchedaSintetica, vistaSedutaDaModificare, vistaCodaPrevalidazione, vistaAziendaPerPro } from '../lib/vista.js';

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

test('scheda sintetica: niente anamnesi, credenziali, note, questionario, testo libero', () => {
  const v = vistaSchedaSintetica({
    patient: { id: 'p1', first_name: 'A', last_name: 'B', level: 'level1', care_token: 'tok', email: 'a@x', phone: '3', red_flags: true, red_flags_details: 'x', medications_details: 'y', notes: 'n' },
    sessions: [{ id: 's1', date: '2026-01-01', nrs_pre: 6, nrs_post: 3, treatment_notes: 'nota', next_session_notes: 'poi' }],
    cycles: [{ id: 'c1', cycle_number: 1, status: 'active', pgic: 5 }],
    preValidation: { outcome: 'l1_confirmed', clinical_notes: 'mostrata' },
    reassessmentT12: { completed_at: 'x', computed_level: 'level2', pgic: 4, nmq_data: { a: 1 } },
    miniChecks: [{ id: 'm1', check_type: 't3', nrs_current: 4, free_text: 'scritto dal dipendente' }],
  });
  assert.equal(v.patient.first_name, 'A');
  assert.equal(v.sessions[0].nrs_post, 3);
  assert.equal(v.preValidation.clinical_notes, 'mostrata', 'la pagina la disegna');
  nessuno(v, ['care_token', 'email', 'phone', 'red_flags', 'red_flags_details', 'medications_details', 'notes', 'treatment_notes', 'next_session_notes', 'nmq_data', 'free_text'], 'scheda');
});

test('seduta da modificare, coda di pre-validazione, azienda per il professionista', () => {
  nessuno(vistaSedutaDaModificare({ id: 's1', date: 'x', patient_id: 'p1', treatment_notes: 'n', nrs_pre: 5, patients: { id: 'p1', first_name: 'A', last_name: 'B', level: 'level1', clients: { name: 'Acme' } } }), ['treatment_notes', 'nrs_pre', 'level'], 'seduta');
  nessuno(vistaCodaPrevalidazione({ id: 'w1', patient_id: 'p1', client_id: 'c1', source: 'self_declaration', notes: 'n', score: 100, cohort: 'x', assigned_professional_id: 'pro', patients: { first_name: 'A', last_name: 'B', level: 'level1', clients: { name: 'Acme' } } }), ['score', 'cohort', 'assigned_professional_id', 'level'], 'coda');
  assert.deepEqual(Object.keys(vistaAziendaPerPro({ id: 'c1', name: 'Acme', sconto_motivo: 'x', sforamento_forbice_motivo: 'y', contact_email: 'z' })), ['id', 'name']);
});
