import supabase from './db';

// ─── ID / code generators ─────────────────────────────────────────────────────

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function generateShareCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function getClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getClientById(id) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function insertClient(fields) {
  const { data, error } = await supabase
    .from('clients')
    .insert(fields)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClient(id, fields) {
  const { data, error } = await supabase
    .from('clients')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getClientByAssessmentShareCode(code) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('assessment_share_code', code)
    .single();
  if (error) return null;
  return data;
}

export async function ensureClientAssessmentShareCode(client_id) {
  const client = await getClientById(client_id);
  if (client?.assessment_share_code) return client.assessment_share_code;
  // Genera codice se mancante
  const code = Math.random().toString(36).substring(2, 8);
  await updateClient(client_id, { assessment_share_code: code });
  return code;
}

export async function deleteClientById(id) {
  // 1. Sessioni (ha client_id diretto)
  await supabase.from('sessions').delete().eq('client_id', id);

  // 2. Pazienti
  await supabase.from('patients').delete().eq('client_id', id);

  // 3. Assegnazioni professionisti
  await supabase.from('professional_assignments').delete().eq('client_id', id);

  // 4. Risposte: prima prendo gli id degli assessment, poi cancello le risposte
  const { data: assessmentRows } = await supabase
    .from('assessments').select('id').eq('client_id', id);
  if (assessmentRows && assessmentRows.length > 0) {
    const ids = assessmentRows.map(r => r.id);
    await supabase.from('responses').delete().in('assessment_id', ids);
  }

  // 5. Assessment, primo colloquio, cliente
  await supabase.from('assessments').delete().eq('client_id', id);
  await supabase.from('first_meetings').delete().eq('client_id', id);
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

// ─── Assessments ──────────────────────────────────────────────────────────────

export async function getAssessmentsByClient(client_id) {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAssessmentById(id) {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function getAssessmentByShareCode(share_code) {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('share_code', share_code)
    .single();
  if (error) return null;
  return data;
}

export async function shareCodeExists(share_code) {
  const { data } = await supabase
    .from('assessments')
    .select('id')
    .eq('share_code', share_code)
    .maybeSingle();
  return !!data;
}

export async function insertAssessment(fields) {
  const { data, error } = await supabase
    .from('assessments')
    .insert(fields)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAssessment(id, fields) {
  const { data, error } = await supabase
    .from('assessments')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAssessmentById(id) {
  await supabase.from('responses').delete().eq('assessment_id', id);
  const { error } = await supabase.from('assessments').delete().eq('id', id);
  if (error) throw error;
}

// ─── Responses ────────────────────────────────────────────────────────────────

export async function getResponsesByAssessment(assessment_id) {
  const { data, error } = await supabase
    .from('responses')
    .select('answers')
    .eq('assessment_id', assessment_id)
    .order('submitted_at', { ascending: true });
  if (error) throw error;
  return data.map(r => r.answers);
}

export async function insertResponse(fields) {
  const { data, error } = await supabase
    .from('responses')
    .insert(fields)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Dashboard helpers ────────────────────────────────────────────────────────

export async function getAssessmentCounts() {
  const { data, error } = await supabase
    .from('assessments')
    .select('client_id, status');
  if (error) throw error;
  const counts = {};
  for (const a of data) {
    if (!counts[a.client_id]) counts[a.client_id] = { total: 0, active: 0 };
    counts[a.client_id].total++;
    if (a.status === 'active') counts[a.client_id].active++;
  }
  return counts;
}

export async function getResponsesForClient(client_id) {
  const assessments = await getAssessmentsByClient(client_id);
  const responses = {};
  await Promise.all(
    assessments.map(async a => {
      responses[a.id] = await getResponsesByAssessment(a.id);
    })
  );
  return { assessments, responses };
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export async function updatePipelineStage(id, stage, notes) {
  const fields = {
    pipeline_stage: stage,
    last_contact_date: new Date().toISOString(),
  };
  if (notes !== undefined) fields.pipeline_notes = notes;
  return updateClient(id, fields);
}

// ─── First meetings ───────────────────────────────────────────────────────────

export async function getFirstMeeting(client_id) {
  const { data } = await supabase
    .from('first_meetings')
    .select('*')
    .eq('client_id', client_id)
    .maybeSingle();
  return data;
}

export async function upsertFirstMeeting(client_id, fields) {
  const existing = await getFirstMeeting(client_id);
  if (existing) {
    const { data, error } = await supabase
      .from('first_meetings')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('client_id', client_id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('first_meetings')
      .insert({ id: generateId('fm'), client_id, ...fields, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

// ─── Professionals ────────────────────────────────────────────────────────────

export async function getProfessionals() {
  const { data, error } = await supabase
    .from('professionals')
    .select('id, name, email, phone, active, must_reset_password, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getProfessionalById(id) {
  const { data, error } = await supabase
    .from('professionals')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function getProfessionalByEmail(email) {
  const { data } = await supabase
    .from('professionals')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();
  return data;
}

export async function insertProfessional(fields) {
  const { data, error } = await supabase
    .from('professionals')
    .insert(fields)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfessional(id, fields) {
  const { data, error } = await supabase
    .from('professionals')
    .update(fields)
    .eq('id', id)
    .select('id, name, email, phone, active, must_reset_password, created_at')
    .single();
  if (error) throw error;
  return data;
}

// ─── Professional assignments ─────────────────────────────────────────────────

export async function getAssignmentsByProfessional(professional_id) {
  const { data, error } = await supabase
    .from('professional_assignments')
    .select('*, clients(id, name, employees, sector)')
    .eq('professional_id', professional_id)
    .eq('active', true);
  if (error) throw error;
  return data;
}

export async function getAssignmentsByClient(client_id) {
  const { data, error } = await supabase
    .from('professional_assignments')
    .select('*, professionals(id, name, email, phone, active)')
    .eq('client_id', client_id);
  if (error) throw error;
  return data;
}

export async function upsertAssignment(professional_id, client_id, active) {
  const { data: existing } = await supabase
    .from('professional_assignments')
    .select('id')
    .eq('professional_id', professional_id)
    .eq('client_id', client_id)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('professional_assignments')
      .update({ active })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('professional_assignments')
      .insert({ id: generateId('pa'), professional_id, client_id, active })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

// ─── Patients ─────────────────────────────────────────────────────────────────

export async function getPatientsByClient(client_id) {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPatientById(id) {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function insertPatient(fields) {
  const { data, error } = await supabase
    .from('patients')
    .insert(fields)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createSelfDeclaredPatient({ client_id, first_name, last_name, email, phone, location, wants_to_be_contacted }) {
  // Genera care_token unico
  const care_token = generateId('ct').replace('ct_', '');
  const { data, error } = await supabase
    .from('patients')
    .insert({
      id: generateId('pat'),
      client_id,
      first_name: first_name || 'Anonimo',
      last_name: last_name || '',
      email: email || null,
      phone: phone || null,
      location: location || null,
      level: 'level3',
      level_status: 'active',
      care_token,
      self_declared: true,
      wants_to_be_contacted: wants_to_be_contacted ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAdhesionRateByClient(client_id) {
  const { count: invited } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client_id);
  const { count: completed } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client_id)
    .not('assessment_completed_at', 'is', null);
  return { invited: invited || 0, completed: completed || 0 };
}

export async function updatePatient(id, fields) {
  const { data, error } = await supabase
    .from('patients')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function getSessionsByPatient(patient_id) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, professionals(name)')
    .eq('patient_id', patient_id)
    .order('session_number', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getSessionsForClient(client_id) {
  // For admin: all sessions for a client, with patient name (no clinical notes)
  const { data, error } = await supabase
    .from('sessions')
    .select('id, patient_id, session_number, nrs_pre, nrs_post, date, closed_at, patients(first_name, last_name, level)')
    .eq('client_id', client_id)
    .order('date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertSession(fields) {
  const { data, error } = await supabase
    .from('sessions')
    .insert(fields)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSession(id, fields) {
  const { data, error } = await supabase
    .from('sessions')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Referral codes ───────────────────────────────────────────────────────────

/**
 * Genera il codice referral: ESCARE-{SLUG}-{SEQ}-P|F
 * Es: ESCARE-FIAT-001-P  /  ESCARE-FIAT-001-F
 */
export function buildReferralCode(clientName, seq, type = 'P') {
  const slug = clientName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8) || 'AZIENDA';
  return `ESCARE-${slug}-${String(seq).padStart(3, '0')}-${type}`;
}

/**
 * Conta le coppie P/F già generate per un cliente
 * (= numero di assessment già con codice → prossimo seq = count + 1)
 */
export async function countReferralPairsForClient(client_id) {
  const { data } = await supabase
    .from('referral_codes')
    .select('assessment_id')
    .eq('client_id', client_id)
    .eq('type', 'P');  // una P per coppia
  const unique = new Set((data || []).map(r => r.assessment_id));
  return unique.size;
}

export async function getReferralCodesByClient(client_id) {
  const { data, error } = await supabase
    .from('referral_codes')
    .select('*, referral_uses(id, patient_name, used_at)')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAllReferralCodes() {
  const { data, error } = await supabase
    .from('referral_codes')
    .select('*, clients(id, name), referral_uses(id, used_at, patient_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getReferralCodeByCode(code) {
  const { data } = await supabase
    .from('referral_codes')
    .select('*, clients(name), referral_uses(id)')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();
  return data;
}

export async function insertReferralCode(fields) {
  const { data, error } = await supabase
    .from('referral_codes')
    .insert({ id: generateId('rc'), ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateReferralCode(id, fields) {
  const { data, error } = await supabase
    .from('referral_codes')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteReferralCode(id) {
  // Le referral_uses vengono cancellate in cascade dal DB
  const { error } = await supabase.from('referral_codes').delete().eq('id', id);
  if (error) throw error;
}

export async function insertReferralUse(fields) {
  const { data, error } = await supabase
    .from('referral_uses')
    .insert({ id: generateId('ru'), ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Tutti i pazienti (per admin) ────────────────────────────────────────────

export async function getAllPatients() {
  const { data, error } = await supabase
    .from('patients')
    .select('id, first_name, last_name, client_id, level, clients(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Assessment consents ──────────────────────────────────────────────────────

export async function insertAssessmentConsent(fields) {
  const { data, error } = await supabase
    .from('assessment_consents')
    .insert({ id: generateId('ac'), ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getConsentsByAssessment(assessment_id) {
  const { data, error } = await supabase
    .from('assessment_consents')
    .select('*')
    .eq('assessment_id', assessment_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Patient documents ────────────────────────────────────────────────────────

export async function getPatientDocuments(patient_id) {
  const { data, error } = await supabase
    .from('patient_documents')
    .select('*')
    .eq('patient_id', patient_id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertPatientDocument(patient_id, client_id, type, fields) {
  // Un solo documento per tipo per paziente
  const { data: existing } = await supabase
    .from('patient_documents')
    .select('id')
    .eq('patient_id', patient_id)
    .eq('type', type)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('patient_documents')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('patient_documents')
      .insert({ id: generateId('pd'), patient_id, client_id, type, ...fields })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function updatePatientDocument(id, fields) {
  const { data, error } = await supabase
    .from('patient_documents')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Compliance: documenti per tutte le aziende (per admin) */
export async function getDocumentComplianceByClient() {
  const { data, error } = await supabase
    .from('patient_documents')
    .select('client_id, patient_id, type, status, clients(name)');
  if (error) throw error;
  return data || [];
}

// ─── Access logs ──────────────────────────────────────────────────────────────

export async function logAccess(professional_id, action, ip, details) {
  await supabase.from('access_logs').insert({
    id: generateId('log'),
    professional_id,
    action,
    ip: ip || null,
    details: details || null,
  });
}

// ─── Restratification alerts ──────────────────────────────────────────────────

export async function createRestratAlert(fields) {
  const { data, error } = await supabase
    .from('restratification_alerts')
    .insert({ id: generateId('rst'), ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getRestratAlertsByClient(client_id) {
  const { data, error } = await supabase
    .from('restratification_alerts')
    .select('*, patients(first_name, last_name)')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAllRestratAlerts() {
  const { data, error } = await supabase
    .from('restratification_alerts')
    .select('*, patients(first_name, last_name), clients(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateRestratAlertStatus(id, status, notes) {
  const fields = { status, updated_at: new Date().toISOString() };
  if (notes !== undefined) fields.notes = notes;
  const { data, error } = await supabase
    .from('restratification_alerts')
    .update(fields)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Care token ───────────────────────────────────────────────────────────────

export async function getPatientByCareToken(care_token) {
  const { data, error } = await supabase
    .from('patients')
    .select('*, clients(id, name)')
    .eq('care_token', care_token)
    .single();
  if (error) return null;
  return data;
}

export async function setCareToken(patient_id, token) {
  const { data, error } = await supabase
    .from('patients')
    .update({ care_token: token, updated_at: new Date().toISOString() })
    .eq('id', patient_id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Checkpoints ──────────────────────────────────────────────────────────────

export async function insertCheckpoint(fields) {
  const { data, error } = await supabase
    .from('checkpoints')
    .insert({ id: generateId('chk'), ...fields })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getCheckpointsByClient(client_id) {
  const { data, error } = await supabase
    .from('checkpoints')
    .select('*, patients(first_name, last_name)')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Treatment Cycles ────────────────────────────────────────────────────────

export async function getCyclesByPatient(patient_id) {
  const { data, error } = await supabase
    .from('treatment_cycles')
    .select('*')
    .eq('patient_id', patient_id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getActiveCycleByPatient(patient_id) {
  const { data, error } = await supabase
    .from('treatment_cycles')
    .select('*')
    .eq('patient_id', patient_id)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTreatmentCycle(fields) {
  const { data, error } = await supabase
    .from('treatment_cycles')
    .insert({ id: generateId('tc'), ...fields, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateTreatmentCycle(id, fields) {
  const { data, error } = await supabase
    .from('treatment_cycles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function getAllCyclesByClient(client_id) {
  const { data, error } = await supabase
    .from('treatment_cycles')
    .select('*, patients(first_name, last_name, level, level_status, current_cycle)')
    .eq('client_id', client_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Waitlist ────────────────────────────────────────────────────────────────

export async function addToWaitlist(fields) {
  // Controlla che non sia già in waitlist
  const { data: existing } = await supabase
    .from('waitlist').select('id').eq('patient_id', fields.patient_id).eq('status', 'pending').maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase
    .from('waitlist')
    .insert({ id: generateId('wl'), ...fields, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

export async function updateWaitlistStatus(id, status) {
  const { data, error } = await supabase
    .from('waitlist')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ─── Acute Events ────────────────────────────────────────────────────────────

export async function createAcuteEvent(fields) {
  const { data, error } = await supabase
    .from('acute_events')
    .insert({ id: generateId('ae'), ...fields, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getAcuteEventsByClient(client_id) {
  const { data, error } = await supabase
    .from('acute_events')
    .select('*, patients(first_name, last_name)')
    .eq('client_id', client_id)
    .order('reported_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAllAcuteEvents() {
  const { data, error } = await supabase
    .from('acute_events')
    .select('*, patients(first_name, last_name), clients(name)')
    .order('reported_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateAcuteEvent(id, fields) {
  const { data, error } = await supabase
    .from('acute_events')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function countAcuteEventsThisYear(patient_id) {
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
  const { count, error } = await supabase
    .from('acute_events')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', patient_id)
    .gte('reported_at', yearStart);
  if (error) throw error;
  return count || 0;
}

// ─── Pre-validazioni ─────────────────────────────────────────────────────────

export async function insertPreValidation(fields) {
  const { data, error } = await supabase
    .from('pre_validations')
    .insert({ id: generateId('pv'), ...fields, created_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getPreValidationByPatient(patient_id) {
  const { data, error } = await supabase
    .from('pre_validations')
    .select('*')
    .eq('patient_id', patient_id)
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Mini-check ───────────────────────────────────────────────────────────────

export async function insertMiniCheck(fields) {
  const { data, error } = await supabase
    .from('mini_checks')
    .insert({ id: generateId('mc'), ...fields, created_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getMiniChecksByPatient(patient_id) {
  const { data, error } = await supabase
    .from('mini_checks')
    .select('*')
    .eq('patient_id', patient_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Re-assessment T12 ───────────────────────────────────────────────────────

export async function insertReassessmentT12(fields) {
  const { data, error } = await supabase
    .from('reassessments_t12')
    .insert({ id: generateId('t12'), ...fields, created_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getReassessmentT12ByPatient(patient_id) {
  const { data, error } = await supabase
    .from('reassessments_t12')
    .select('*')
    .eq('patient_id', patient_id)
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Sessione by ID ───────────────────────────────────────────────────────────

export async function getSessionById(id) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, patients(id, first_name, last_name, level, client_id, clients(name))')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// ─── Pazienti per professional (via assignments → clients → patients) ─────────

export async function getPatientsByProfessional(professional_id) {
  const { data: assignments, error: ae } = await supabase
    .from('assignments')
    .select('client_id')
    .eq('professional_id', professional_id)
    .eq('active', true);
  if (ae) throw ae;
  const clientIds = (assignments || []).map(a => a.client_id);
  if (clientIds.length === 0) return [];
  const { data, error } = await supabase
    .from('patients')
    .select('*, clients(name)')
    .in('client_id', clientIds)
    .order('last_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getAcuteEventsByProfessional(professional_id) {
  const { data: assignments } = await supabase
    .from('assignments').select('client_id').eq('professional_id', professional_id).eq('active', true);
  const clientIds = (assignments || []).map(a => a.client_id);
  if (clientIds.length === 0) return [];
  const { data, error } = await supabase
    .from('acute_events')
    .select('*, patients(first_name, last_name), clients(name)')
    .in('client_id', clientIds)
    .eq('status', 'pending')
    .order('reported_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getWaitlistByProfessional(professional_id) {
  const { data: assignments } = await supabase
    .from('assignments').select('client_id').eq('professional_id', professional_id).eq('active', true);
  const clientIds = (assignments || []).map(a => a.client_id);
  if (clientIds.length === 0) return [];
  const { data, error } = await supabase
    .from('waitlist')
    .select('*, patients(first_name, last_name, level, clients(name))')
    .in('client_id', clientIds)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ─── Admin settings ──────────────────────────────────────────────────────────

export async function getAdminSettings() {
  const { data, error } = await supabase.from('admin_settings').select('*').order('key');
  if (error) throw error;
  return data || [];
}

export async function upsertAdminSetting(key, value) {
  const { data, error } = await supabase.from('admin_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select().single();
  if (error) throw error;
  return data;
}

// ─── Report generati ─────────────────────────────────────────────────────────

export async function insertGeneratedReport(fields) {
  const { data, error } = await supabase.from('generated_reports')
    .insert({ id: generateId('rep'), ...fields, created_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getGeneratedReportsByClient(client_id) {
  const { data, error } = await supabase.from('generated_reports')
    .select('*').eq('client_id', client_id).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Buffer dinamico ─────────────────────────────────────────────────────────

export async function getBufferStatusByClient(client_id) {
  const { CONFIG } = await import('./config.js');
  // Conta pazienti L1 attivi
  const { data: patients, error: pe } = await supabase
    .from('patients').select('id, level, current_cycle, level_status')
    .eq('client_id', client_id).eq('level', 'level1');
  if (pe) throw pe;
  const l1_count = (patients || []).filter(p => p.level_status !== 'opted_out').length;
  // Sessioni totali L1 base
  const base_sessions = l1_count * (CONFIG.sessions_intensive + CONFIG.sessions_maintenance) * CONFIG.completion_rate;
  const buffer_sessions = Math.round(base_sessions * 0.15);
  // Cicli attivi/chiusi per pazienti ri-stratificati confermati
  const { data: restratAlerts } = await supabase
    .from('restratification_alerts').select('id').eq('client_id', client_id).eq('status', 'confirmed_l1');
  const confirmed_restrat = (restratAlerts || []).length;
  const sessions_per_new_l1 = Math.round((CONFIG.sessions_intensive + CONFIG.sessions_maintenance) * CONFIG.completion_rate);
  const used_sessions = confirmed_restrat * sessions_per_new_l1;
  const residuo_sessions = buffer_sessions - used_sessions;
  return {
    l1_count,
    buffer_sessions,
    confirmed_restrat,
    used_sessions,
    residuo_sessions,
    sessions_per_new_l1,
    is_over_budget: residuo_sessions < 0,
  };
}

// ─── Email log ────────────────────────────────────────────────────────────────

export async function insertEmailLog(fields) {
  const { data, error } = await supabase.from('email_log')
    .insert({ id: generateId('eml'), ...fields, sent_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getEmailLogByClient(client_id) {
  const { data, error } = await supabase.from('email_log')
    .select('*').eq('client_id', client_id).order('sent_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function insertDocument(fields) {
  const { data, error } = await supabase.from('documents')
    .insert({ id: generateId('doc'), ...fields, created_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getDocumentsByClient(client_id) {
  const { data, error } = await supabase.from('documents')
    .select('*').eq('client_id', client_id).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Assessment progress ───────────────────────────────────────────────────────

export async function updateAssessmentProgress(assessment_id, progress_data) {
  const { error } = await supabase.from('assessments')
    .update({ progress_data }).eq('id', assessment_id);
  if (error) throw error;
}

// ─── Patients per campagna ─────────────────────────────────────────────────────

export async function getPatientsWithEmailByClient(client_id) {
  const { data, error } = await supabase.from('patients')
    .select('id, first_name, last_name, email, level, care_token, assessment_completed_at, assessment_invite_sent_at')
    .eq('client_id', client_id)
    .not('email', 'is', null)
    .order('last_name');
  if (error) throw error;
  return data || [];
}

export async function updatePatientAssessmentStatus(patient_id, fields) {
  const { error } = await supabase.from('patients')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', patient_id);
  if (error) throw error;
}

export async function getActiveAssessmentByClient(client_id) {
  const { data, error } = await supabase.from('assessments')
    .select('id, share_code').eq('client_id', client_id).eq('status', 'active')
    .order('created_at', { ascending: false }).limit(1).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function getPatientsNeedingReminder(days_since_invite) {
  const cutoffDate = new Date(Date.now() - days_since_invite * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoffDate.toISOString();
  const daysBefore = new Date(cutoffDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('patients')
    .select('id, first_name, last_name, email, client_id, care_token, clients(name)')
    .not('email', 'is', null)
    .is('assessment_completed_at', null)
    .gte('assessment_invite_sent_at', daysBefore)
    .lte('assessment_invite_sent_at', cutoffStr);
  if (error) throw error;
  return data || [];
}

export async function getPatientsForMinicheckInvite(checkpoint_type) {
  // v4: il mini-check NON va a tutta la popolazione, ma SOLO ai pazienti in
  // trattamento. T3/T6 sono ancorati all'inizio del primo ciclo di trattamento.
  //   T3: ~90 giorni dopo started_at del 1° ciclo
  //   T6: ~180 giorni dopo started_at del 1° ciclo
  const days = checkpoint_type === 't6' ? 180 : 90;
  const windowStart = new Date(Date.now() - (days + 7) * 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(Date.now() - (days - 2) * 24 * 60 * 60 * 1000).toISOString();

  // Pazienti che hanno avviato il primo ciclo di trattamento nella finestra T3/T6
  const { data: cycles, error } = await supabase.from('treatment_cycles')
    .select('started_at, patients(id, first_name, last_name, email, client_id, care_token, clients(name))')
    .eq('cycle_number', 1)
    .gte('started_at', windowStart)
    .lte('started_at', windowEnd);
  if (error) throw error;

  // Estrai i pazienti (con email) dai cicli
  const patients = [];
  const seen = new Set();
  for (const c of cycles || []) {
    const p = c.patients;
    if (p && p.email && !seen.has(p.id)) { seen.add(p.id); patients.push(p); }
  }
  if (patients.length === 0) return [];

  // Escludi chi ha già un minicheck per questo checkpoint
  const patientIds = patients.map(p => p.id);
  const { data: existingChecks } = await supabase.from('mini_checks')
    .select('patient_id').eq('check_type', checkpoint_type).in('patient_id', patientIds);
  const alreadyChecked = new Set((existingChecks || []).map(c => c.patient_id));
  return patients.filter(p => !alreadyChecked.has(p.id));
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export async function getWaitlistByClient(client_id) {
  const { data, error } = await supabase.from('waitlist')
    .select(`
      *,
      patients(id, first_name, last_name, email, location, level, care_token),
      professionals(id, name)
    `)
    .eq('client_id', client_id)
    .order('score', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateWaitlistEntry(id, fields) {
  const { data, error } = await supabase.from('waitlist')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw error;
  return data;
}
