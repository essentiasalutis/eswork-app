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
  await supabase.from('responses').delete().in(
    'assessment_id',
    supabase.from('assessments').select('id').eq('client_id', id)
  );
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
