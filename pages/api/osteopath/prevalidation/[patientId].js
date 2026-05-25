import { requireProAuth } from '../../../../lib/pro-auth';
import {
  getPatientById,
  insertPreValidation,
  updatePatient,
  addToWaitlist,
  generateId,
} from '../../../../lib/store';

export default requireProAuth(async function handler(req, res) {
  const { patientId } = req.query;
  const proId = req.proSession.proId;

  if (req.method === 'POST') {
    const {
      duration_minutes,
      nrs_during_call,
      pain_zone,
      symptom_duration_months,
      clinical_notes,
      outcome,
    } = req.body;

    if (!outcome) return res.status(400).json({ error: 'Outcome obbligatorio' });

    const patient = await getPatientById(patientId).catch(() => null);
    if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

    const preVal = await insertPreValidation({
      patient_id: patientId,
      professional_id: proId,
      client_id: patient.client_id,
      duration_minutes: duration_minutes ? parseInt(duration_minutes, 10) : null,
      nrs_during_call: nrs_during_call != null ? parseInt(nrs_during_call, 10) : null,
      pain_zone: pain_zone || null,
      symptom_duration_months: symptom_duration_months ? parseInt(symptom_duration_months, 10) : null,
      clinical_notes: clinical_notes || null,
      outcome,
    });

    // Se confermato L1 → aggiorna livello paziente e mettilo in lista trattamento
    if (outcome === 'l1_confirmed') {
      await updatePatient(patientId, {
        level: 'level1',
        computed_level: 'level1',
        level_status: 'active',
      }).catch(() => {});
    }

    return res.status(201).json(preVal);
  }

  return res.status(405).end();
});
