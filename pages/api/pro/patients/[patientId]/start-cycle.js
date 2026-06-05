import { requireProAuth } from '../../../../../lib/pro-auth';
import {
  getPatientById,
  getCyclesByPatient,
  createTreatmentCycle,
  updatePatient,
  proCanAccessPatientClinical,
} from '../../../../../lib/store';

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { patientId } = req.query;
  const proId = req.proSession.proId;

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });
  if (patient.level !== 'level1') return res.status(400).json({ error: 'Solo pazienti L1 possono avere cicli di trattamento' });

  // Livello B — avvio ciclo (cartella clinica): solo l'osteopata assegnato al paziente
  if (!(await proCanAccessPatientClinical(proId, patient))) return res.status(403).json({ error: 'Accesso negato' });

  const cycles = await getCyclesByPatient(patientId);
  const closedCycles = cycles.filter(c => c.status === 'closed');
  const activeCycle = cycles.find(c => c.status === 'active');

  if (activeCycle) return res.status(409).json({ error: 'Ciclo già attivo per questo paziente' });
  if (closedCycles.length >= 2) return res.status(400).json({ error: 'Massimo 2 cicli per anno raggiunti' });

  // Controlla 60 giorni da ultimo ciclo
  if (patient.last_cycle_end_date) {
    const daysSince = Math.floor((Date.now() - new Date(patient.last_cycle_end_date)) / (1000 * 60 * 60 * 24));
    if (daysSince < 60) {
      return res.status(400).json({ error: `Distanza minima 60 giorni tra cicli. Mancano ${60 - daysSince} giorni.` });
    }
  }

  const cycle_number = closedCycles.length + 1;
  try {
    const cycle = await createTreatmentCycle({
      patient_id: patientId,
      client_id: patient.client_id,
      professional_id: proId,
      cycle_number,
      sessions_planned: 4,
      sessions_completed: 0,
      status: 'active',
      started_at: new Date().toISOString(),
    });

    // Aggiorna current_cycle sul paziente
    await updatePatient(patientId, { current_cycle: cycle_number });

    return res.status(201).json(cycle);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
