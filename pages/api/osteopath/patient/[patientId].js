import { requireProAuth } from '../../../../lib/pro-auth';
import {
  getPatientById,
  getSessionsByPatient,
  getCyclesByPatient,
  getPreValidationByPatient,
  getReassessmentT12ByPatient,
  getMiniChecksByPatient,
  proCanAccessPatientClinical,
  logAccess,
} from '../../../../lib/store';

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { patientId } = req.query;
  const proId = req.proSession.proId;

  const patient = await getPatientById(patientId).catch(() => null);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

  // Livello B — cartella clinica completa: solo l'osteopata assegnato al paziente
  if (!(await proCanAccessPatientClinical(proId, patient))) {
    return res.status(403).json({ error: 'Accesso negato' });
  }
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
  await logAccess(proId, 'view_patient', ip, `Cartella paziente ${patientId}`).catch(() => {});

  const [sessions, cycles, preValidation, reassessmentT12, miniChecks] = await Promise.all([
    getSessionsByPatient(patientId).catch(() => []),
    getCyclesByPatient(patientId).catch(() => []),
    getPreValidationByPatient(patientId).catch(() => null),
    getReassessmentT12ByPatient(patientId).catch(() => null),
    getMiniChecksByPatient(patientId).catch(() => []),
  ]);

  // Calcola serie NRS nel tempo (solo sessioni con nrs_post valorizzato)
  const nrsSeries = sessions
    .filter(s => s.nrs_post != null)
    .sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at))
    .map((s, i) => ({
      session: i + 1,
      date: s.date || s.created_at,
      nrs_pre: s.nrs_pre,
      nrs_post: s.nrs_post,
    }));

  return res.json({
    patient,
    sessions,
    cycles,
    preValidation,
    reassessmentT12,
    miniChecks,
    nrsSeries,
  });
});
