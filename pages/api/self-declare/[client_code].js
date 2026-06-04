// POST /api/self-declare/[client_code]
// Crea un paziente auto-dichiarato e salva le risposte NMQ

import {
  getClientByAssessmentShareCode,
  createSelfDeclaredPatient,
  getActiveAssessmentByClient,
  insertResponse,
  updatePatient,
  addToWaitlist,
  generateId,
} from '../../../lib/store';
import { computeLevel } from '../../../lib/scoring';

export default async function handler(req, res) {
  const { client_code } = req.query;

  if (req.method === 'GET') {
    const client = await getClientByAssessmentShareCode(client_code);
    if (!client) return res.status(404).json({ error: 'Link non valido' });
    return res.json({ client: { id: client.id, name: client.name } });
  }

  if (req.method === 'POST') {
    const client = await getClientByAssessmentShareCode(client_code);
    if (!client) return res.status(404).json({ error: 'Link non valido' });

    const {
      first_name,
      last_name,
      email,
      phone,
      location,
      wants_to_be_contacted,
      answers,
    } = req.body || {};

    try {
      // 1. Crea il record paziente
      const patient = await createSelfDeclaredPatient({
        client_id: client.id,
        first_name: wants_to_be_contacted ? first_name : null,
        last_name: wants_to_be_contacted ? last_name : null,
        email: wants_to_be_contacted ? email : null,
        phone: wants_to_be_contacted ? phone : null,
        location: location || null,
        wants_to_be_contacted: !!wants_to_be_contacted,
      });

      // 2. Calcola livello
      const computed_level = answers ? computeLevel(answers) : 'level3';
      const now = new Date().toISOString();

      // 3. Aggiorna livello sul paziente (non-fatale se fallisce)
      await updatePatient(patient.id, {
        computed_level,
        level: computed_level,
        assessment_completed_at: now,
      }).catch(e => console.error('updatePatient error:', e.message));

      // 4. Salva risposte NMQ nell'assessment attivo (non-fatale)
      const assessment = await getActiveAssessmentByClient(client.id).catch(() => null);
      if (assessment && answers) {
        await insertResponse({
          id: generateId('r'),
          assessment_id: assessment.id,
          answers,
          submitted_at: now,
        }).catch(e => console.error('insertResponse error:', e.message));
      }

      // 5. Se vuole essere contattato E risulta L1 → Waitlist
      if (wants_to_be_contacted && computed_level === 'level1') {
        await addToWaitlist({
          patient_id: patient.id,
          client_id: client.id,
          assessment_id: assessment?.id || null,
          score: 100,
          source: 'self_declaration',
          status: 'pending',
        }).catch(e => console.error('addToWaitlist error:', e.message));
      }

      return res.status(201).json({
        ok: true,
        level: computed_level,
        patient_id: patient.id,
      });
    } catch (e) {
      console.error('self-declare POST error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
}
