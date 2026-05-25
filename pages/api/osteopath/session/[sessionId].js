import { requireProAuth } from '../../../../lib/pro-auth';
import {
  getSessionById,
  updateSession,
  getActiveCycleByPatient,
  updateTreatmentCycle,
  updatePatient,
} from '../../../../lib/store';

export default requireProAuth(async function handler(req, res) {
  const { sessionId } = req.query;

  if (req.method === 'GET') {
    const session = await getSessionById(sessionId).catch(() => null);
    if (!session) return res.status(404).json({ error: 'Sessione non trovata' });
    return res.json(session);
  }

  if (req.method === 'PATCH') {
    const { nrs_pre, nrs_post, notes, patient_present, cycle_outcome } = req.body;

    const session = await getSessionById(sessionId).catch(() => null);
    if (!session) return res.status(404).json({ error: 'Sessione non trovata' });

    const patientId = session.patient_id || session.patients?.id;

    // Aggiorna sessione
    await updateSession(sessionId, {
      nrs_pre: nrs_pre != null ? parseInt(nrs_pre, 10) : undefined,
      nrs_post: nrs_post != null ? parseInt(nrs_post, 10) : undefined,
      notes: notes || undefined,
      status: patient_present === false ? 'no_show' : 'completed',
      updated_at: new Date().toISOString(),
    });

    // Aggiorna ciclo attivo
    if (patient_present !== false && patientId) {
      const cycle = await getActiveCycleByPatient(patientId).catch(() => null);
      if (cycle) {
        const newCompleted = (cycle.sessions_completed || 0) + 1;
        const shouldClose = newCompleted >= 4;

        await updateTreatmentCycle(cycle.id, {
          sessions_completed: newCompleted,
          ...(shouldClose ? {
            status: 'closed',
            outcome: cycle_outcome || 'improved',
            closed_at: new Date().toISOString(),
          } : {}),
        });

        // opted_out se 2° ciclo + no_improvement
        if (shouldClose && cycle_outcome === 'no_improvement') {
          const patient = await import('../../../../lib/store').then(m => m.getPatientById(patientId)).catch(() => null);
          if (patient && (patient.current_cycle || 0) >= 2) {
            await updatePatient(patientId, { level_status: 'opted_out' }).catch(() => {});
          } else {
            await updatePatient(patientId, {
              current_cycle: (patient?.current_cycle || 0) + 1,
              last_cycle_end_date: new Date().toISOString(),
            }).catch(() => {});
          }
        } else if (shouldClose) {
          await updatePatient(patientId, {
            current_cycle: cycle.cycle_number,
            last_cycle_end_date: new Date().toISOString(),
          }).catch(() => {});
        }
      }
    }

    return res.json({ ok: true });
  }

  return res.status(405).end();
});
