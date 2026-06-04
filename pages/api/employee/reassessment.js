import { getPatientByCareToken, insertReassessmentT12 } from '../../../lib/store';
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

  return res.json({ ok: true, computed_level });
}
