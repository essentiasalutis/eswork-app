import { requireProAuth } from '../../../../../lib/pro-auth';
import {
  getPatientById,
  getSessionsByPatient,
  insertSession,
  updateSession,
  getAssignmentsByProfessional,
  generateId,
  logAccess,
} from '../../../../../lib/store';

async function checkAccess(proId, patient) {
  if (!patient) return false;
  const assignments = await getAssignmentsByProfessional(proId);
  return assignments.some(a => a.client_id === patient.client_id);
}

export default requireProAuth(async function handler(req, res) {
  const { patientId } = req.query;
  const proId = req.proSession.proId;

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

  const allowed = await checkAccess(proId, patient);
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
      });

      if (close) {
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
        await logAccess(proId, 'close_session', ip, `Sessione ${session.id} chiusa`);
      }

      return res.status(201).json(session);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // PATCH — aggiorna sessione (chiudi visita o modifica se aperta)
  if (req.method === 'PATCH') {
    try {
      const { sessionId, nrs_post, treatment_notes, next_session_notes, close } = req.body;
      const sessions = await getSessionsByPatient(patientId);
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return res.status(404).json({ error: 'Sessione non trovata' });

      // Blocco: sessione già chiusa non è modificabile
      if (session.closed_at) {
        return res.status(409).json({ error: 'Sessione già chiusa. Non è modificabile.' });
      }

      const fields = {};
      if (nrs_post !== undefined) fields.nrs_post = parseInt(nrs_post);
      if (treatment_notes !== undefined) fields.treatment_notes = treatment_notes?.trim() || null;
      if (next_session_notes !== undefined) fields.next_session_notes = next_session_notes?.trim() || null;

      if (close) {
        fields.closed_at = new Date().toISOString();
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
        await logAccess(proId, 'close_session', ip, `Sessione ${sessionId} chiusa`);
      }

      const updated = await updateSession(sessionId, fields);
      return res.json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
