import { requireProAuth } from '../../../../lib/pro-auth';
import {
  getPatientById,
  updatePatient,
  getAssignmentsByProfessional,
} from '../../../../lib/store';

async function checkAccess(proId, patient) {
  if (!patient) return false;
  const assignments = await getAssignmentsByProfessional(proId);
  return assignments.some(a => a.client_id === patient.client_id);
}

export default requireProAuth(async function handler(req, res) {
  const { patientId } = req.query;
  const proId = req.proSession.proId;

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

  const allowed = await checkAccess(proId, patient);
  if (!allowed) return res.status(403).json({ error: 'Accesso negato' });

  if (req.method === 'GET') {
    return res.json(patient);
  }

  if (req.method === 'PATCH') {
    try {
      const updated = await updatePatient(patientId, req.body);
      return res.json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
