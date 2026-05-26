// POST /api/self-declare/[client_code]
// Crea un paziente auto-dichiarato e salva le risposte NMQ

import {
  getClientByAssessmentShareCode,
  createSelfDeclaredPatient,
  getActiveAssessmentByClient,
  insertResponse,
  updatePatient,
  updatePatientAssessmentStatus,
  addToWaitlist,
  generateId,
} from '../../../lib/store';

// Calcola livello personale dalle risposte NMQ
function computeLevel(answers) {
  const zones = Object.keys(answers).filter(k => k.startsWith('nmq_') && k.endsWith('_0'));
  let hasFunctionalImpact = false;
  let hasPain7days = false;
  for (const zoneKey of zones) {
    const zi = zoneKey.split('_')[1];
    if (answers[`nmq_${zi}_1`] === 1 || answers[`nmq_${zi}_1`] === true) hasFunctionalImpact = true;
    if (answers[`nmq_${zi}_2`] === 1 || answers[`nmq_${zi}_2`] === true) hasPain7days = true;
  }
  if (hasFunctionalImpact) return 'level1';
  if (hasPain7days) return 'level2';
  return 'level3';
}

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

      // 2. Salva risposte NMQ
      const assessment = await getActiveAssessmentByClient(client.id).catch(() => null);
      if (assessment && answers) {
        await insertResponse({
          id: generateId('r'),
          assessment_id: assessment.id,
          answers,
          submitted_at: new Date().toISOString(),
        }).catch(() => {});
      }

      // 3. Calcola livello e aggiorna paziente
      const computed_level = answers ? computeLevel(answers) : 'level3';
      const now = new Date().toISOString();

      await updatePatient(patient.id, {
        computed_level,
        assessment_completed_at: now,
      });

      await updatePatientAssessmentStatus(patient.id, {
        assessment_completed_at: now,
      }).catch(() => {});

      // 4. Se vuole essere contattato E risulta L1 → Waitlist
      if (wants_to_be_contacted && computed_level === 'level1') {
        await updatePatient(patient.id, { level: 'level1', level_status: 'active' });
        await addToWaitlist({
          patient_id: patient.id,
          client_id: client.id,
          assessment_id: assessment?.id || null,
          score: 100,
          source: 'self_declaration',
          status: 'pending',
        }).catch(() => {});
      } else if (wants_to_be_contacted && computed_level === 'level2') {
        await updatePatient(patient.id, { level: 'level2', level_status: 'active' });
      }

      return res.status(201).json({
        ok: true,
        level: computed_level,
        patient_id: patient.id,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
}
