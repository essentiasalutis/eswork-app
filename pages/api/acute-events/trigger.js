import { requireProAuth } from '../../../lib/pro-auth';
import {
  getPatientById,
  createAcuteEvent,
  countAcuteEventsThisYear,
  getAssignmentsByProfessional,
} from '../../../lib/store';

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { patientId, pain_zone, nrs, description } = req.body;
  const proId = req.proSession.proId;

  if (!patientId) return res.status(400).json({ error: 'patientId richiesto' });

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

  // Verifica accesso
  const assignments = await getAssignmentsByProfessional(proId);
  if (!assignments.some(a => a.client_id === patient.client_id)) return res.status(403).json({ error: 'Accesso negato' });

  // Max 2 eventi acuti per anno solare
  const count = await countAcuteEventsThisYear(patientId);
  if (count >= 2) return res.status(400).json({ error: 'Limite di 2 eventi acuti per anno solare raggiunto' });

  const escalation_deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  try {
    const event = await createAcuteEvent({
      patient_id: patientId,
      client_id: patient.client_id,
      professional_id: proId,
      pain_zone: pain_zone || null,
      nrs: nrs !== undefined ? parseInt(nrs) : null,
      description: description || null,
      status: 'pending',
      reported_at: new Date().toISOString(),
      escalation_deadline,
    });

    return res.status(201).json(event);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
