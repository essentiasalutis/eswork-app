import { requireProAuth } from '../../../../lib/pro-auth';
import {
  getSessionById,
  updateSession,
  getActiveCycleByPatient,
  updateTreatmentCycle,
  updatePatient,
  getPatientById,
  proCanAccessPatientClinical,
} from '../../../../lib/store';

// Livello B — la sessione fa parte della cartella clinica: solo l'osteopata
// assegnato al paziente può leggerla/modificarla.
async function guardSession(proId, session, res) {
  const patientId = session.patient_id || session.patients?.id;
  const patient = patientId ? await getPatientById(patientId).catch(() => null) : null;
  if (!(await proCanAccessPatientClinical(proId, patient))) {
    res.status(403).json({ error: 'Accesso negato' });
    return false;
  }
  return true;
}

export default requireProAuth(async function handler(req, res) {
  const { sessionId } = req.query;
  const proId = req.proSession.proId;

  if (req.method === 'GET') {
    const session = await getSessionById(sessionId).catch(() => null);
    if (!session) return res.status(404).json({ error: 'Sessione non trovata' });
    if (!(await guardSession(proId, session, res))) return;
    return res.json(session);
  }

  if (req.method === 'PATCH') {
    const { nrs_pre, nrs_post, notes, patient_present, cycle_outcome, pgic } = req.body;

    const session = await getSessionById(sessionId).catch(() => null);
    if (!session) return res.status(404).json({ error: 'Sessione non trovata' });
    if (!(await guardSession(proId, session, res))) return;

    const patientId = session.patient_id || session.patients?.id;
    const pgicVal = pgic != null ? parseInt(pgic, 10) : null;

    // Aggiorna sessione
    await updateSession(sessionId, {
      nrs_pre: nrs_pre != null ? parseInt(nrs_pre, 10) : undefined,
      nrs_post: nrs_post != null ? parseInt(nrs_post, 10) : undefined,
      notes: notes || undefined,
      status: patient_present === false ? 'no_show' : 'completed',
      updated_at: new Date().toISOString(),
    });

    let pendingPgic = false;

    // Aggiorna ciclo aperto
    if (patient_present !== false && patientId) {
      const cycle = await getActiveCycleByPatient(patientId).catch(() => null);
      if (cycle) {
        const newCompleted = (cycle.sessions_completed || 0) + 1;
        // Il ciclo va chiuso se raggiunge le 4 sessioni o se l'osteopata segnala un esito
        const shouldClose = newCompleted >= 4 || !!cycle_outcome;

        if (shouldClose && pgicVal == null) {
          // REGOLA v4: nessun ciclo si chiude senza PGIC → resta APERTO in attesa di PGIC
          await updateTreatmentCycle(cycle.id, {
            sessions_completed: newCompleted,
            status: 'pending_pgic',
            outcome: cycle_outcome || null,
          });
          pendingPgic = true;
        } else if (shouldClose && pgicVal != null) {
          // Chiusura definitiva CON PGIC
          await updateTreatmentCycle(cycle.id, {
            sessions_completed: newCompleted,
            status: 'closed',
            outcome: cycle_outcome || 'improved',
            pgic: pgicVal,
            closed_at: new Date().toISOString(),
          });
          const patient = await getPatientById(patientId).catch(() => null);
          if (cycle_outcome === 'no_improvement' && (patient?.current_cycle || 0) >= 2) {
            await updatePatient(patientId, { level_status: 'opted_out', last_cycle_end_date: new Date().toISOString() }).catch(() => {});
          } else {
            await updatePatient(patientId, {
              current_cycle: cycle.cycle_number,
              last_cycle_end_date: new Date().toISOString(),
            }).catch(() => {});
          }
        } else {
          // Sessione intermedia: ciclo resta attivo
          await updateTreatmentCycle(cycle.id, { sessions_completed: newCompleted });
        }
      }
    }

    return res.json({ ok: true, pending_pgic: pendingPgic });
  }

  return res.status(405).end();
});
