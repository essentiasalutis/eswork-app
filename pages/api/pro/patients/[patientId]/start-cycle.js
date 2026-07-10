import { requireProAuth } from '../../../../../lib/pro-auth';
import {
  getPatientById,
  getCyclesByPatient,
  createTreatmentCycle,
  updatePatient,
  proCanAccessPatientClinical,
  getClientById,
  getPreValidationByPatient,
  getTreatmentCapacity,
} from '../../../../../lib/store';
import { tierFromEmployees } from '../../../../../lib/pricing/tier';

function tierOf(client) {
  return tierFromEmployees(client?.employees, client?.tier);
}

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { patientId } = req.query;
  const proId = req.proSession.proId;
  const cycleType = req.body?.type === 'prevention' ? 'prevention' : 'treatment';

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

  // Livello B — avvio ciclo (cartella clinica): solo l'osteopata assegnato al paziente
  if (!(await proCanAccessPatientClinical(proId, patient))) return res.status(403).json({ error: 'Accesso negato' });

  const cycles = await getCyclesByPatient(patientId);
  const activeCycle = cycles.find(c => c.status === 'active' || c.status === 'pending_pgic');
  if (activeCycle) return res.status(409).json({ error: 'Ciclo già aperto per questo paziente' });

  if (cycleType === 'prevention') {
    // Ciclo di PREVENZIONE — riservato ai L2 idonei (livello fissato a inizio anno)
    // dei tier Plus/Enterprise. Distinto dal ciclo di trattamento.
    if (patient.level !== 'level2') return res.status(400).json({ error: 'La prevenzione attiva è riservata ai pazienti Livello 2' });
    if (!patient.prevention_eligible) return res.status(400).json({ error: 'Prevenzione attiva non spettante quest\'anno (diritto fissato a inizio anno — regola opzione A)' });
    const client = await getClientById(patient.client_id).catch(() => null);
    if (!['plus', 'enterprise'].includes(tierOf(client))) {
      return res.status(400).json({ error: 'La prevenzione attiva L2 è prevista solo nei livelli di servizio Plus/Enterprise' });
    }
    const prevCount = cycles.filter(c => c.cycle_type === 'prevention').length;
    if (prevCount >= 1) return res.status(400).json({ error: 'Ciclo di prevenzione annuale già erogato' });

    try {
      const cycle = await createTreatmentCycle({
        patient_id: patientId,
        client_id: patient.client_id,
        professional_id: proId,
        cycle_number: 1,
        cycle_type: 'prevention',
        sessions_planned: 4,   // 4 sessioni di prevenzione attiva/anno
        sessions_completed: 0,
        status: 'active',
        started_at: new Date().toISOString(),
      });
      return res.status(201).json(cycle);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Ciclo di TRATTAMENTO — solo L1
  if (patient.level !== 'level1') return res.status(400).json({ error: 'Solo pazienti L1 possono avere cicli di trattamento' });

  // CAPACITÀ CONTRATTUALE: i cicli di trattamento non possono superare i percorsi
  // pagati (L1 contratto + buffer 20%). Tutela automatica contro l'over-delivery.
  const capacity = await getTreatmentCapacity(patient.client_id).catch(() => null);
  if (capacity?.deliverySaturated) {
    return res.status(409).json({
      error: `Capacità contrattuale esaurita: ${capacity.used}/${capacity.budget} percorsi di trattamento già avviati (L1 a contratto ${capacity.contracted} + buffer ${Math.round(capacity.buffer_pct * 100)}%). Per proseguire serve un'estensione del contratto — contatta l'amministrazione ES Work.`,
      capacity_reached: true,
    });
  }

  const closedTreatment = cycles.filter(c => c.status === 'closed' && (c.cycle_type || 'treatment') === 'treatment');
  if (closedTreatment.length >= 2) return res.status(400).json({ error: 'Massimo 2 cicli per anno raggiunti' });

  // GATE CLINICO INVARIABILE (v4): nessun ciclo di trattamento senza pre-validazione
  // confermata l1_confirmed. La pre-validazione deve essere RIFERITA al ciclo che si
  // apre: per il 2°+ ciclo serve una NUOVA pre-validazione successiva alla chiusura
  // del ciclo precedente (la situazione va rivalutata; non si riusa quella iniziale).
  const preval = await getPreValidationByPatient(patientId).catch(() => null);
  if (!preval || preval.outcome !== 'l1_confirmed') {
    return res.status(400).json({
      error: 'Pre-validazione richiesta: il paziente deve essere confermato L1 in videocall (esito l1_confirmed) prima di aprire un ciclo di trattamento.',
      needs_prevalidation: true,
    });
  }
  const lastClosed = closedTreatment
    .filter(c => c.closed_at)
    .sort((a, b) => new Date(b.closed_at) - new Date(a.closed_at))[0];
  if (lastClosed && new Date(preval.created_at) <= new Date(lastClosed.closed_at)) {
    return res.status(400).json({
      error: 'Serve una NUOVA pre-validazione per il prossimo ciclo: deve essere successiva alla chiusura del ciclo precedente. Il paziente la richiede col self-trigger di fine ciclo, poi l\'osteopata rivaluta in videocall.',
      needs_prevalidation: true,
    });
  }

  // Controlla 60 giorni da ultimo ciclo
  if (patient.last_cycle_end_date) {
    const daysSince = Math.floor((Date.now() - new Date(patient.last_cycle_end_date)) / (1000 * 60 * 60 * 24));
    if (daysSince < 60) {
      return res.status(400).json({ error: `Distanza minima 60 giorni tra cicli. Mancano ${60 - daysSince} giorni.` });
    }
  }

  const cycle_number = closedTreatment.length + 1;
  try {
    const cycle = await createTreatmentCycle({
      patient_id: patientId,
      client_id: patient.client_id,
      professional_id: proId,
      cycle_number,
      cycle_type: 'treatment',
      sessions_planned: 4,
      sessions_completed: 0,
      status: 'active',
      started_at: new Date().toISOString(),
    });

    await updatePatient(patientId, { current_cycle: cycle_number });

    return res.status(201).json(cycle);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
