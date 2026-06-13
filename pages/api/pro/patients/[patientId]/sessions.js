import { requireProAuth } from '../../../../../lib/pro-auth';
import {
  getPatientById,
  getSessionsByPatient,
  insertSession,
  updateSession,
  proCanAccessPatientClinical,
  generateId,
  logAccess,
  getActiveCycleByPatient,
  updateTreatmentCycle,
} from '../../../../../lib/store';
import { sendCyclePgicLink } from '../../../../../lib/notify';

export default requireProAuth(async function handler(req, res) {
  const { patientId } = req.query;
  const proId = req.proSession.proId;

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

  // Livello B — sessioni (cartella clinica): solo l'osteopata assegnato al paziente
  const allowed = await proCanAccessPatientClinical(proId, patient);
  if (!allowed) return res.status(403).json({ error: 'Accesso negato' });

  if (req.method === 'GET') {
    const sessions = await getSessionsByPatient(patientId);
    return res.json(sessions);
  }

  // POST — crea nuova sessione (atomica: crea e chiude in un colpo)
  if (req.method === 'POST') {
    try {
      const sessions = await getSessionsByPatient(patientId);
      const nextNumber = sessions.filter(s => s.closed_at).length + 1;
      const { nrs_pre, treatment_notes, next_session_notes, close } = req.body;
      const now = new Date().toISOString();

      // Recupera ciclo attivo (se esiste)
      let activeCycle = null;
      try {
        activeCycle = await getActiveCycleByPatient(patientId);
      } catch (_) {
        // Tabella non ancora creata — ignora gracefully
      }

      // Controlla limite 4 sessioni per ciclo
      if (activeCycle) {
        const cycleSessions = sessions.filter(s => s.cycle_id === activeCycle.id && s.closed_at);
        if (close && cycleSessions.length >= 4) {
          return res.status(400).json({ error: 'Limite di 4 sessioni per ciclo raggiunto' });
        }
      }

      const session = await insertSession({
        id: generateId('ses'),
        patient_id: patientId,
        professional_id: proId,
        client_id: patient.client_id,
        date: now,
        session_number: nextNumber,
        nrs_pre: nrs_pre !== undefined ? parseInt(nrs_pre) : null,
        nrs_post: null,
        treatment_notes: treatment_notes?.trim() || null,
        next_session_notes: next_session_notes?.trim() || null,
        closed_at: close ? now : null,
        cycle_id: activeCycle ? activeCycle.id : null,
      });

      let pendingPgic = false;
      if (close) {
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
        await logAccess({ professional_id: proId, action: 'close_session', patient_id: patientId, ip, user_agent: req.headers['user-agent'], details: `Sessione ${session.id} chiusa` });

        // Aggiorna sessions_completed del ciclo; alla seduta finale → in attesa di PGIC
        if (activeCycle) {
          try {
            const newCompleted = (activeCycle.sessions_completed || 0) + 1;
            const planned = activeCycle.sessions_planned || 4;
            // REGOLA v4: alla seduta finale il ciclo NON si chiude da solo: passa a
            // 'pending_pgic' e si chiude solo registrando il PGIC (via "Chiudi ciclo").
            const reachedEnd = newCompleted >= planned && activeCycle.status === 'active';
            await updateTreatmentCycle(activeCycle.id, {
              sessions_completed: newCompleted,
              ...(reachedEnd ? { status: 'pending_pgic' } : {}),
            });
            pendingPgic = reachedEnd;
            // Alla seduta finale: invia AUTOMATICAMENTE il link PGIC al paziente
            if (reachedEnd) await sendCyclePgicLink(patient).catch(() => {});
          } catch (_) {
            // ignora errori di aggiornamento ciclo
          }
        }
      }

      return res.status(201).json({ ...session, pending_pgic: pendingPgic });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // PATCH — chiudi una visita aperta OPPURE modifica una seduta (anche già chiusa)
  if (req.method === 'PATCH') {
    try {
      const { sessionId, nrs_pre, nrs_post, treatment_notes, next_session_notes, close } = req.body;
      const sessions = await getSessionsByPatient(patientId);
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return res.status(404).json({ error: 'Sessione non trovata' });

      const fields = {};
      if (nrs_pre !== undefined) fields.nrs_pre = nrs_pre === null || nrs_pre === '' ? null : parseInt(nrs_pre);
      if (nrs_post !== undefined) fields.nrs_post = nrs_post === null || nrs_post === '' ? null : parseInt(nrs_post);
      if (treatment_notes !== undefined) fields.treatment_notes = treatment_notes?.trim() || null;
      if (next_session_notes !== undefined) fields.next_session_notes = next_session_notes?.trim() || null;

      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;

      if (close && !session.closed_at) {
        // Chiusura di una visita aperta
        fields.closed_at = new Date().toISOString();
        await logAccess({ professional_id: proId, action: 'close_session', patient_id: patientId, ip, user_agent: req.headers['user-agent'], details: `Sessione ${sessionId} chiusa` });
      } else {
        // Modifica di una seduta esistente (anche già chiusa) — tracciata per integrità
        await logAccess({ professional_id: proId, action: 'edit_session', patient_id: patientId, ip, user_agent: req.headers['user-agent'], details: `Seduta ${sessionId} modificata` });
      }

      const updated = await updateSession(sessionId, fields);
      return res.json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
