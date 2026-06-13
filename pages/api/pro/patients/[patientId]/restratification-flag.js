import { requireProAuth } from '../../../../../lib/pro-auth';
import {
  getPatientById,
  proCanAccessPatientClinical,
  createRestratAlert,
} from '../../../../../lib/store';

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { patientId } = req.query;
  const proId = req.proSession.proId;

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

  // Azione clinica sulla cartella: SOLO l'osteopata assegnato.
  if (!(await proCanAccessPatientClinical(proId, patient))) return res.status(403).json({ error: 'Accesso negato' });

  const { session_id, notes } = req.body;

  try {
    const alert = await createRestratAlert({
      patient_id: patientId,
      client_id: patient.client_id,
      source: 'osteopath',
      session_id: session_id || null,
      notes: notes || null,
    });
    return res.status(201).json(alert);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
