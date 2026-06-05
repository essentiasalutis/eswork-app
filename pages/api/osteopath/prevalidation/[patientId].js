import { requireProAuth } from '../../../../lib/pro-auth';
import {
  getPatientById,
  insertPreValidation,
  updatePatient,
  addToWaitlist,
  generateId,
  proCanAccessClient,
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

    // Livello A — la pre-validazione è accessibile agli osteopati assegnati all'AZIENDA
    if (!(await proCanAccessClient(proId, patient.client_id))) {
      return res.status(403).json({ error: 'Accesso negato' });
    }

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

    // Assegnazione automatica: chi fa la pre-validazione prende in carico il paziente
    // → diventa l'assigned_professional_id (sblocca l'accesso al Livello B per lui solo).
    const patientUpdate = { assigned_professional_id: proId };
    if (outcome === 'l1_confirmed') {
      patientUpdate.level = 'level1';
      patientUpdate.computed_level = 'level1';
      patientUpdate.level_status = 'active';
    }
    await updatePatient(patientId, patientUpdate).catch(() => {});

    return res.status(201).json(preVal);
  }

  return res.status(405).end();
});
