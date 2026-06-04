import { requireProAuth } from '../../../../lib/pro-auth';
import {
  getPatientById,
  updatePatient,
  getAssignmentsByProfessional,
  logAccess,
} from '../../../../lib/store';
import supabase from '../../../../lib/db';

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
    // Livello B — accesso alla cartella clinica di dettaglio: tracciato
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
    await logAccess(proId, 'view_patient', ip, `Cartella paziente ${patientId}`).catch(() => {});
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

  if (req.method === 'DELETE') {
    try {
      await supabase.from('sessions').delete().eq('patient_id', patientId);
      const { error } = await supabase.from('patients').delete().eq('id', patientId);
      if (error) throw error;
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
