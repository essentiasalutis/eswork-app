import { requireProAuth } from '../../../../../lib/pro-auth';
import {
  getPatientById,
  getActiveCycleByPatient,
  updateTreatmentCycle,
  updatePatient,
  proCanAccessPatientClinical,
  getSessionsByPatient,
} from '../../../../../lib/store';

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { patientId } = req.query;
  const { outcome, pgic } = req.body; // outcome: 'improved' | 'no_improvement' · pgic: 1-5 (fine ciclo)
  const proId = req.proSession.proId;

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

  // Livello B — cartella clinica: solo osteopata assegnato al paziente
  if (!(await proCanAccessPatientClinical(proId, patient))) return res.status(403).json({ error: 'Accesso negato' });

  const activeCycle = await getActiveCycleByPatient(patientId);
  if (!activeCycle) return res.status(404).json({ error: 'Nessun ciclo attivo' });

  // Conta sessioni chiuse nel ciclo
  const allSessions = await getSessionsByPatient(patientId);
  const cycleSessions = allSessions.filter(s => s.cycle_id === activeCycle.id && s.closed_at);
  const sessions_completed = cycleSessions.length;

  const pgicVal = pgic != null ? parseInt(pgic, 10) : null;
  const now = new Date().toISOString();
  try {
    const updatedCycle = await updateTreatmentCycle(activeCycle.id, {
      status: 'closed',
      outcome: outcome || null,
      pgic: pgicVal,
      sessions_completed,
      closed_at: now,
    });

    // Aggiorna last_cycle_end_date sul paziente
    const patientUpdate = { last_cycle_end_date: now };

    // Se 2° ciclo senza miglioramento → opted_out
    if (outcome === 'no_improvement' && activeCycle.cycle_number >= 2) {
      patientUpdate.level_status = 'opted_out';
    }

    await updatePatient(patientId, patientUpdate);

    return res.json({ cycle: updatedCycle, opted_out: patientUpdate.level_status === 'opted_out' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
