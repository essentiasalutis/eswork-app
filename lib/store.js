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
