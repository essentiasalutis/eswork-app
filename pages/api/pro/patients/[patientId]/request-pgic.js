// POST /api/pro/patients/[patientId]/request-pgic
// L'osteopata conclude il ciclo e fa partire la richiesta PGIC al PAZIENTE.
// Mette il ciclo in 'pending_pgic' (se attivo) e invia/reinvia il link PGIC.
// Il ciclo si chiuderà SOLO quando il paziente risponde (via /employee/cycle-pgic).

import { requireProAuth } from '../../../../../lib/pro-auth';
import {
  getPatientById,
  getActiveCycleByPatient,
  updateTreatmentCycle,
  proCanAccessPatientClinical,
} from '../../../../../lib/store';
import { sendCyclePgicLink } from '../../../../../lib/notify';

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { patientId } = req.query;
  const proId = req.proSession.proId;

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });
  if (!(await proCanAccessPatientClinical(proId, patient))) return res.status(403).json({ error: 'Accesso negato' });

  const cycle = await getActiveCycleByPatient(patientId).catch(() => null);
  if (!cycle) return res.status(404).json({ error: 'Nessun ciclo aperto' });

  // Se è ancora attivo, lo concludiamo mettendolo in attesa del PGIC del paziente
  if (cycle.status === 'active') {
    await updateTreatmentCycle(cycle.id, { status: 'pending_pgic' }).catch(() => {});
  }

  const sent = await sendCyclePgicLink(patient);
  return res.json({
    ok: true,
    status: 'pending_pgic',
    email_sent: !!sent?.ok,
    email_reason: sent?.ok ? null : (sent?.reason || sent?.error || 'invio non riuscito'),
  });
});
