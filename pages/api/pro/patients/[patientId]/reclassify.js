// POST /api/pro/patients/[patientId]/reclassify
// Riclassificazione clinica del livello da parte dell'osteopata assegnato (Livello B).
// Caso tipico: un candidato L1, dopo la prima visita, risulta in realtà L2 o L3.
// Se si scende da L1 con un ciclo aperto, il ciclo viene ANNULLATO (non è una
// chiusura terapeutica → niente PGIC, non entra nei KPI).

import { requireProAuth } from '../../../../../lib/pro-auth';
import {
  getPatientById,
  updatePatient,
  proCanAccessPatientClinical,
  getActiveCycleByPatient,
  updateTreatmentCycle,
  addToWaitlist,
  logAccess,
} from '../../../../../lib/store';

const VALID = ['level1', 'level2', 'level3'];

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { patientId } = req.query;
  const proId = req.proSession.proId;
  const { level, reason } = req.body || {};

  if (!VALID.includes(level)) return res.status(400).json({ error: 'Livello non valido' });

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

  // Livello B — solo l'osteopata assegnato al paziente
  if (!(await proCanAccessPatientClinical(proId, patient))) return res.status(403).json({ error: 'Accesso negato' });

  if (level === patient.level) return res.status(400).json({ error: 'Il paziente è già a questo livello' });

  let cancelledCycle = false;
  // Se si scende di livello (non più L1) e c'è un ciclo aperto → annulla il ciclo
  if (level !== 'level1') {
    const open = await getActiveCycleByPatient(patientId).catch(() => null);
    if (open) {
      await updateTreatmentCycle(open.id, {
        status: 'closed',
        closed_at: new Date().toISOString(),
        // niente PGIC: è un annullamento per riclassificazione, non una chiusura terapeutica
      }).catch(() => {});
      cancelledCycle = true;
    }
  }

  // Riclassifica a L1 = il paziente diventa CANDIDATO, NON entra in trattamento:
  // come il percorso assessment, va in coda pre-validazione (pending + waitlist).
  // Il ciclo si apre solo dopo l'esito l1_confirmed. Verso L2/L3 resta libera (active).
  const toL1 = level === 'level1';
  const updated = await updatePatient(patientId, {
    level,
    computed_level: level,
    level_status: toL1 ? 'pending' : 'active',
    ...(level === 'level2' ? { prevention_eligible: false } : {}),
  }).catch(e => ({ error: e.message }));
  if (updated?.error) return res.status(500).json({ error: updated.error });

  let queuedForPrevalidation = false;
  if (toL1) {
    await addToWaitlist({
      patient_id: patientId,
      client_id: patient.client_id,
      score: 90,
      source: 'restratification',
      status: 'pending',
      notes: `Riclassificato L1 dall'osteopata${reason ? ' · ' + reason : ''} — in attesa di pre-validazione`,
    }).catch(() => {});
    queuedForPrevalidation = true;
  }

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
  await logAccess(proId, 'reclassify', ip, `Paziente ${patientId} → ${level}${reason ? ' · ' + reason : ''}`).catch(() => {});

  return res.json({ ok: true, patient: updated, cancelledCycle, queued_for_prevalidation: queuedForPrevalidation });
});
