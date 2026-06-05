import { getPatientByCareToken, insertReassessmentT12, updatePatient, getClientById } from '../../../lib/store';
import { computeLevel } from '../../../lib/scoring';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token, nmq_data, pgic } = req.body;
  if (!token) return res.status(400).json({ error: 'Token mancante' });

  const patient = await getPatientByCareToken(token).catch(() => null);
  if (!patient) return res.status(404).json({ error: 'Link non valido' });

  const computed_level = computeLevel(nmq_data);

  const result = await insertReassessmentT12({
    patient_id: patient.id,
    client_id: patient.client_id,
    nmq_data: nmq_data || {},
    pgic: pgic ? parseInt(pgic, 10) : null,
    computed_level,
    completed_at: new Date().toISOString(),
  }).catch(() => null);

  // Il re-assessment ricolloca il paziente per l'ANNO SUCCESSIVO (regola opzione A):
  // il livello di fine anno diventa il livello di inizio anno successivo e fissa
  // il diritto alla prevenzione attiva (L2 nei tier Plus/Enterprise → eligible).
  const rc = await getClientById(patient.client_id).catch(() => null);
  const rn = parseInt(rc?.employees) || 0;
  const rtier = rc?.tier || (rn <= 150 ? 'core' : rn <= 500 ? 'plus' : 'enterprise');
  await updatePatient(patient.id, {
    level: computed_level,
    computed_level,
    prevention_eligible: computed_level === 'level2' && (rtier === 'plus' || rtier === 'enterprise'),
  }).catch(() => {});

  return res.json({ ok: true, computed_level });
}
