import { getPatientByCareToken, insertReassessmentT12, updatePatient } from '../../../lib/store';
import { computeLevel } from '../../../lib/scoring';
import { limiteAreaPersonale } from '../../../lib/employee-guard';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token, nmq_data, pgic } = req.body;
  // 't6' = ri-fotografia dei sei mesi; 't12' = rivalutazione annuale (default storico).
  const checkpoint = req.body.checkpoint === 't6' ? 't6' : 't12';
  if (!token) return res.status(400).json({ error: 'Token mancante' });
  if (!limiteAreaPersonale(req, res, token)) return;

  const patient = await getPatientByCareToken(token).catch(() => null);
  if (!patient) return res.status(404).json({ error: 'Link non valido' });

  const computed_level = computeLevel(nmq_data);

  const result = await insertReassessmentT12({
    patient_id: patient.id,
    client_id: patient.client_id,
    nmq_data: nmq_data || {},
    pgic: pgic ? parseInt(pgic, 10) : null,
    computed_level,
    checkpoint,
    completed_at: new Date().toISOString(),
  }).catch(() => null);

  // SOLO l'annuale ricolloca il paziente per l'anno successivo (regola opzione A):
  // il livello di fine anno diventa quello di inizio anno e fissa il diritto alla
  // prevenzione attiva (ogni Livello 2 ce l'ha, 12/9).
  // La ri-fotografia dei sei mesi NON ricolloca nessuno: serve a fotografare la
  // popolazione per il report, e il livello clinico resta in mano all'osteopata.
  if (checkpoint === 't12') {
    await updatePatient(patient.id, {
      level: computed_level,
      computed_level,
      prevention_eligible: computed_level === 'level2',
    }).catch(() => {});
  }

  return res.json({ ok: true, computed_level, checkpoint });
}
