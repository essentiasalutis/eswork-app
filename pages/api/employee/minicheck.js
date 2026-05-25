import {
  getPatientByCareToken,
  insertMiniCheck,
  createRestratAlert,
  generateId,
} from '../../../lib/store';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token, nrs_current, has_limitations, wants_contact, free_text, check_type } = req.body;
  if (!token) return res.status(400).json({ error: 'Token mancante' });

  const patient = await getPatientByCareToken(token).catch(() => null);
  if (!patient) return res.status(404).json({ error: 'Link non valido' });

  // Triage: NRS ≥ 6 o limitazioni presenti → richiede contatto
  const triage_outcome = (nrs_current >= 6 || has_limitations === true) ? 'needs_contact' : 'ok';

  await insertMiniCheck({
    patient_id: patient.id,
    client_id: patient.client_id,
    check_type: check_type || 't3',
    nrs_current: nrs_current != null ? parseInt(nrs_current, 10) : null,
    has_limitations: !!has_limitations,
    wants_contact: !!wants_contact,
    free_text: free_text || null,
    triage_outcome,
  }).catch(() => {});

  // Se triage positivo → crea alert ri-stratificazione
  if (triage_outcome === 'needs_contact') {
    await createRestratAlert({
      id: generateId('rst'),
      patient_id: patient.id,
      client_id: patient.client_id,
      source: 'checkpoint',
      status: 'pending',
      form_data: { nrs_current, has_limitations, wants_contact, free_text, check_type },
      notes: `Mini-check ${(check_type || 't3').toUpperCase()}: NRS ${nrs_current}, limitazioni: ${has_limitations ? 'sì' : 'no'}`,
    }).catch(() => {});
  }

  return res.json({ triage_outcome });
}
