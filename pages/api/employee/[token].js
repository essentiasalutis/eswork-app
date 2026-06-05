import {
  getPatientByCareToken,
  getCyclesByPatient,
  getSessionsByPatient,
  getMiniChecksByPatient,
  getPreValidationByPatient,
  getSelfTriggerBudget,
} from '../../../lib/store';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token mancante' });

  const patient = await getPatientByCareToken(token).catch(() => null);
  if (!patient) return res.status(404).json({ error: 'Link non valido o scaduto' });

  const [cycles, sessions, miniChecks, preValidation, selfTriggerBudget] = await Promise.all([
    getCyclesByPatient(patient.id).catch(() => []),
    getSessionsByPatient(patient.id).catch(() => []),
    getMiniChecksByPatient(patient.id).catch(() => []),
    getPreValidationByPatient(patient.id).catch(() => null),
    getSelfTriggerBudget(patient.id).catch(() => ({ used: 0, max: 2, remaining: 2 })),
  ]);

  return res.json({ patient, cycles, sessions, miniChecks, preValidation, selfTriggerBudget });
}
