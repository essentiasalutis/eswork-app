import crypto from 'crypto';
import { requireProAuth } from '../../../../../lib/pro-auth';
import {
  getPatientById,
  proCanAccessPatientClinical,
  setCareToken,
} from '../../../../../lib/store';

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { patientId } = req.query;
  const proId = req.proSession.proId;

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

  // Gestione area personale del paziente: SOLO l'osteopata assegnato.
  if (!(await proCanAccessPatientClinical(proId, patient))) return res.status(403).json({ error: 'Accesso negato' });

  try {
    const token = crypto.randomBytes(16).toString('hex');
    await setCareToken(patientId, token);
    return res.json({ care_token: token });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
