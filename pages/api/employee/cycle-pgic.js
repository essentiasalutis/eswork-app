// /api/employee/cycle-pgic
// PGIC di fine ciclo, AUTO-RIFERITO dal paziente (dal suo telefono o tablet in studio).
// GET  ?token=...  → info paziente + esistenza ciclo in attesa di PGIC
// POST { token, pgic } → registra il PGIC, chiude il ciclo, deriva l'esito, aggiorna il livello

import {
  getPatientByCareToken,
  getActiveCycleByPatient,
  updateTreatmentCycle,
  updatePatient,
} from '../../../lib/store';

// Esito derivato dal PGIC (1-5): 4-5 → migliorato · 1-3 → nessun miglioramento
function outcomeFromPgic(pgic) {
  return pgic >= 4 ? 'improved' : 'no_improvement';
}

export default async function handler(req, res) {
  const token = req.method === 'GET' ? req.query.token : req.body?.token;
  if (!token) return res.status(400).json({ error: 'Token mancante' });

  const patient = await getPatientByCareToken(token).catch(() => null);
  if (!patient) return res.status(404).json({ error: 'Link non valido' });

  const cycle = await getActiveCycleByPatient(patient.id).catch(() => null);
  const pending = cycle && cycle.status === 'pending_pgic' ? cycle : null;

  if (req.method === 'GET') {
    return res.json({
      patient: { first_name: patient.first_name },
      pending: !!pending,
      already_done: cycle ? false : true, // nessun ciclo aperto → o già chiuso o nessuno
    });
  }

  if (req.method === 'POST') {
    const pgic = parseInt(req.body?.pgic, 10);
    if (!(pgic >= 1 && pgic <= 5)) return res.status(400).json({ error: 'Valore PGIC non valido' });
    if (!pending) return res.status(409).json({ error: 'Nessun ciclo in attesa di PGIC' });

    const outcome = outcomeFromPgic(pgic);
    const now = new Date().toISOString();

    await updateTreatmentCycle(pending.id, {
      status: 'closed',
      outcome,
      pgic,
      closed_at: now,
    }).catch(() => {});

    // Esito → livello paziente:
    //  migliorato  → passa in monitoraggio (Livello 2)
    //  nessun migl. → esce dal programma (lettera clinica + referral medico competente)
    if (outcome === 'improved') {
      await updatePatient(patient.id, {
        level: 'level2', computed_level: 'level2', level_status: 'active',
        last_cycle_end_date: now,
      }).catch(() => {});
    } else {
      await updatePatient(patient.id, {
        level_status: 'opted_out', last_cycle_end_date: now,
      }).catch(() => {});
    }

    return res.json({ ok: true, outcome });
  }

  return res.status(405).end();
}
