import { requireProAuth } from '../../../../lib/pro-auth';
import {
  getPatientById,
  updatePatient,
  proCanAccessPatientClinical,
  logAccess,
} from '../../../../lib/store';
import supabase from '../../../../lib/db';

export default requireProAuth(async function handler(req, res) {
  const { patientId } = req.query;
  const proId = req.proSession.proId;

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

  // Livello B — cartella clinica: solo l'osteopata assegnato al paziente
  const allowed = await proCanAccessPatientClinical(proId, patient);
  if (!allowed) return res.status(403).json({ error: 'Accesso negato' });

  if (req.method === 'GET') {
    // Livello B — accesso alla cartella clinica di dettaglio: tracciato
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
    await logAccess({ professional_id: proId, action: 'view_patient', patient_id: patientId, ip, user_agent: req.headers['user-agent'], details: 'Apertura cartella clinica' }).catch(() => {});
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
