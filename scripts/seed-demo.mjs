import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = fs.readFileSync('.env.local', 'utf8');
const get = k => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim();
const sb = createClient(get('SUPABASE_URL'), get('SUPABASE_SERVICE_KEY'));

const now = () => new Date().toISOString();
const daysAgo = d => new Date(Date.now() - d * 864e5).toISOString();
const log = (t, e) => console.log(`${e ? '⚠️ ' : '✓ '}${t}${e ? ' — ' + (e.message || e) : ''}`);

const CLIENT_ID = 'c_demo_acme';
const ASSESS_ID = 'a_demo_acme';
const PRO_ID = 'pro_1777478722429_z57rq'; // Enrico Maiolo (esistente)

// ─── 0. Cleanup ───────────────────────────────────────────────────────────────
// 0a. rimuovi i 4 pazienti seed sporchi (senza NMQ)
for (const id of ['pat_1778857148914_cj', 'pat_1778858497377_rz', 'pat_1778919946644_ap', 'pat_1779134827546_zh']) {
  const { error } = await sb.from('patients').delete().eq('id', id);
  log(`cleanup paziente sporco ${id}`, error);
}
// 0b. rimuovi TUTTI i figli del cliente demo in ordine FK-safe (alcune FK non hanno cascade)
await sb.from('responses').delete().eq('assessment_id', ASSESS_ID);
for (const t of ['sessions', 'treatment_cycles', 'mini_checks', 'pre_validations', 'self_triggers', 'waitlist', 'generated_reports', 'restratification_alerts', 'acute_events']) {
  await sb.from(t).delete().eq('client_id', CLIENT_ID);
}
await sb.from('patients').delete().eq('client_id', CLIENT_ID);
await sb.from('assessments').delete().eq('client_id', CLIENT_ID);
await sb.from('professional_assignments').delete().eq('client_id', CLIENT_ID);
await sb.from('clients').delete().eq('id', CLIENT_ID);
log('cleanup demo precedente (figli + cliente)');

// ─── 1. Client demo (Plus → prevenzione L2 attiva) ─────────────────────────────
await sb.from('clients').insert({
  id: CLIENT_ID, name: 'Acme Manifattura S.p.A. (DEMO)', sector: 1, employees: 220,
  tier: 'plus', assessment_share_code: 'demo01', pipeline_stage: 'active',
  contact_name: 'Giulia Bianchi', contact_email: 'hr@acme-demo.it', created_at: daysAgo(40),
}).then(r => log('client Acme Manifattura (Plus, 220 dip)', r.error));

// ─── 2. Assessment iniziale ────────────────────────────────────────────────────
await sb.from('assessments').insert({
  id: ASSESS_ID, client_id: CLIENT_ID, type: 'initial', status: 'active',
  share_code: 'demoNMQ', computed_level: 'level1', created_at: daysAgo(35),
}).then(r => log('assessment iniziale', r.error));

// ─── 3. Assegnazione osteopata → azienda ───────────────────────────────────────
await sb.from('professional_assignments').delete().eq('professional_id', PRO_ID).eq('client_id', CLIENT_ID);
await sb.from('professional_assignments').insert({
  id: 'pa_demo_acme', professional_id: PRO_ID, client_id: CLIENT_ID, active: true, created_at: daysAgo(34),
}).then(r => log('assegnazione osteopata→azienda', r.error));

// ─── 4. Pazienti stratificati ──────────────────────────────────────────────────
const mk = (i, first, last, level, opts = {}) => ({
  id: `pat_demo_${i}`, client_id: CLIENT_ID,
  first_name: first, last_name: last,
  email: `${first.toLowerCase()}.${last.toLowerCase()}@acme-demo.it`,
  phone: '333' + (1000000 + i),
  location: i % 2 ? 'Stabilimento Nord' : 'Sede Centrale',
  level, computed_level: level, level_status: 'active',
  care_token: `demotok${i}`, self_declared: true, wants_to_be_contacted: true,
  prevention_eligible: level === 'level2', // Plus → L2 idoneo
  assessment_completed_at: daysAgo(33),
  created_at: daysAgo(34),
  ...opts,
});
const patients = [
  // L1 (4)
  mk(1, 'Marco', 'Rossi', 'level1', { assigned_professional_id: PRO_ID }),                  // confermato + in trattamento
  mk(2, 'Luca', 'Ferrari', 'level1', { assigned_professional_id: PRO_ID }),                 // confermato (pre-validato), nessun ciclo
  mk(3, 'Sara', 'Conti', 'level1', { level_status: 'pending' }),   // CANDIDATO in coda pre-validazione
  mk(4, 'Elena', 'Greco', 'level1', { level_status: 'pending' }),  // CANDIDATO in coda pre-validazione
  // L2 (5)
  mk(5, 'Paolo', 'Riva', 'level2'),
  mk(6, 'Anna', 'Moretti', 'level2'),
  mk(7, 'Davide', 'Galli', 'level2'),
  mk(8, 'Chiara', 'Lombardi', 'level2'),
  mk(9, 'Giorgio', 'Costa', 'level2'),
  // L3 (6)
  mk(10, 'Marta', 'Rinaldi', 'level3'),
  mk(11, 'Stefano', 'Villa', 'level3'),
  mk(12, 'Laura', 'Fontana', 'level3'),
  mk(13, 'Andrea', 'Barbieri', 'level3'),
  mk(14, 'Silvia', 'Mariani', 'level3'),
  mk(15, 'Roberto', 'Caruso', 'level3'),
];
{ const { error } = await sb.from('patients').insert(patients); log(`15 pazienti (4 L1 · 5 L2 · 6 L3)`, error); }

// ─── 5. Risposte NMQ (per popolare i report aggregati) ─────────────────────────
function nmqAnswers(level) {
  const a = { role: 'production' };
  for (let z = 0; z < 9; z++) { a[`nmq_${z}_0`] = 0; a[`nmq_${z}_1`] = 0; a[`nmq_${z}_2`] = 0; }
  if (level === 'level1') { a['nmq_3_0'] = 1; a['nmq_3_1'] = 1; a['nmq_3_2'] = 1; } // lombare con impatto + 7gg
  else if (level === 'level2') { a['nmq_0_0'] = 1; a['nmq_0_2'] = 1; } // collo dolore 7gg senza impatto
  return a;
}
{
  const rows = patients.map((p, i) => ({
    id: `r_demo_${i}`, assessment_id: ASSESS_ID, answers: nmqAnswers(p.level), submitted_at: daysAgo(33),
  }));
  const { error } = await sb.from('responses').insert(rows); log('15 risposte NMQ', error);
}

// ─── 6. Waitlist: 2 L1 in attesa + 1 self-trigger ──────────────────────────────
{
  const { error } = await sb.from('waitlist').insert([
    { id: 'wl_demo_1', patient_id: 'pat_demo_3', client_id: CLIENT_ID, score: 100, source: 'assessment', status: 'pending', created_at: daysAgo(20), updated_at: daysAgo(20) },
    { id: 'wl_demo_2', patient_id: 'pat_demo_4', client_id: CLIENT_ID, score: 85, source: 'assessment', status: 'pending', created_at: daysAgo(18), updated_at: daysAgo(18) },
    { id: 'wl_demo_3', patient_id: 'pat_demo_5', client_id: CLIENT_ID, score: 70, source: 'self_trigger', status: 'pending', notes: 'Self-trigger: dolore lombare · da 1-4 settimane', created_at: daysAgo(3), updated_at: daysAgo(3) },
  ]);
  log('waitlist (2 L1 + 1 self-trigger)', error);
}

// ─── 7. Pre-validazione completata (Marco Rossi → L1 confermato) ───────────────
await sb.from('pre_validations').insert([
  {
    id: 'pv_demo_1', patient_id: 'pat_demo_1', professional_id: PRO_ID, client_id: CLIENT_ID,
    duration_minutes: 15, nrs_during_call: 7, pain_zone: 'Schiena bassa/lombare',
    symptom_duration_months: 3, clinical_notes: 'Lombalgia con impatto funzionale. Confermato L1.',
    outcome: 'l1_confirmed', created_at: daysAgo(15),
  },
  {
    id: 'pv_demo_2', patient_id: 'pat_demo_2', professional_id: PRO_ID, client_id: CLIENT_ID,
    duration_minutes: 15, nrs_during_call: 6, pain_zone: 'Collo',
    symptom_duration_months: 2, clinical_notes: 'Cervicalgia con impatto. Confermato L1.',
    outcome: 'l1_confirmed', created_at: daysAgo(8),
  },
]).then(r => log('2 pre-validazioni (Marco, Luca → L1 confermati)', r.error));

// ─── 8. Ciclo di trattamento attivo + 2 sessioni con NRS ───────────────────────
await sb.from('treatment_cycles').insert({
  id: 'tc_demo_1', patient_id: 'pat_demo_1', client_id: CLIENT_ID, professional_id: PRO_ID,
  cycle_number: 1, cycle_type: 'treatment', sessions_planned: 4, sessions_completed: 2,
  status: 'active', started_at: daysAgo(12), created_at: daysAgo(12), updated_at: daysAgo(2),
}).then(r => log('ciclo di trattamento attivo (2/4)', r.error));
{
  const { error } = await sb.from('sessions').insert([
    { id: 's_demo_1', patient_id: 'pat_demo_1', professional_id: PRO_ID, client_id: CLIENT_ID, date: daysAgo(12), session_number: 1, nrs_pre: 7, nrs_post: 5, treatment_notes: 'Tecniche strutturali lombari.', closed_at: daysAgo(12), created_at: daysAgo(12) },
    { id: 's_demo_2', patient_id: 'pat_demo_1', professional_id: PRO_ID, client_id: CLIENT_ID, date: daysAgo(2), session_number: 2, nrs_pre: 5, nrs_post: 3, treatment_notes: 'Miglioramento mobilità.', closed_at: daysAgo(2), created_at: daysAgo(2) },
  ]);
  log('2 sessioni con NRS pre/post (7→5, 5→3)', error);
}
await sb.from('patients').update({ current_cycle: 1 }).eq('id', 'pat_demo_1');

// ─── 9. Mini-check con PGIC (paziente in trattamento, T3) ──────────────────────
await sb.from('mini_checks').insert({
  id: 'mc_demo_1', patient_id: 'pat_demo_1', client_id: CLIENT_ID, check_type: 't3',
  pgic: 4, has_limitations: false, wants_contact: false, triage_outcome: 'ok', created_at: daysAgo(1),
}).then(r => log('mini-check T3 con PGIC=4', r.error));

// ─── 10. Self-trigger (Paolo Riva, L2) ─────────────────────────────────────────
await sb.from('self_triggers').insert({
  id: 'st_demo_1', patient_id: 'pat_demo_5', client_id: CLIENT_ID,
  disturbance: 'Dolore lombare ricomparso', functional_impact: true, duration: '1-4 settimane',
  urgent: false, note: 'Dopo trasloco.', status: 'pending', created_at: daysAgo(3),
}).then(r => log('self-trigger (L2 → coda pre-validazione)', r.error));

// ─── 11. Report di attivazione generato ────────────────────────────────────────
await sb.from('generated_reports').insert({
  id: 'gr_demo_1', client_id: CLIENT_ID, report_type: 'activation',
  content_text: 'Report di Attivazione — Acme Manifattura. Popolazione 220 dip. Stratificazione: L1 ~16%, L2 ~24%, L3 ~60%. Zona prioritaria: schiena bassa (lombare). Piano: sportello L1 + prevenzione L2 + formazione.',
  created_by: 'demo', created_at: daysAgo(30),
}).then(r => log('report di attivazione generato', r.error));

console.log('\n✅ Seed demo completato. Cliente: Acme Manifattura S.p.A. (DEMO) · /q/c/demo01');