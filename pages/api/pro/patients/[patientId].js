import { requireProAuth } from '../../../../lib/pro-auth';
import {
  getPatientById,
  updatePatient,
  proCanAccessPatientClinical,
  logAccess,
} from '../../../../lib/store';

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

  // DELETE — tolto all'osteopata (Enrico, 17/9). Cancellare un paziente cancella
  // sedute e documenti firmati: è documentazione clinica da conservare. Resta solo
  // la procedura dell'amministratore (/api/admin/patients/[patientId]).
  if (req.method === 'DELETE') {
    return res.status(403).json({ error: 'La cancellazione di un paziente non è consentita dalla cartella: la documentazione clinica va conservata.' });
  }

  res.status(405).end();
});
