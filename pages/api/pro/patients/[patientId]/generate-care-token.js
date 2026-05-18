import crypto from 'crypto';
import { requireProAuth } from '../../../../../lib/pro-auth';
import {
  getPatientById,
  getAssignmentsByProfessional,
  setCareToken,
} from '../../../../../lib/store';

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { patientId } = req.query;
  const proId = req.proSession.proId;

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

  const assignments = await getAssignmentsByProfessional(proId);
  const allowed = assignments.some(a => a.client_id === patient.client_id);
  if (!allowed) return res.status(403).json({ error: 'Accesso negato' });

  try {
    const token = crypto.randomBytes(16).toString('hex');
    await setCareToken(patientId, token);
    return res.json({ care_token: token });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
