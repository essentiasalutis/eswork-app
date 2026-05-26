import {
  getAssessmentByShareCode,
  getClientById,
  insertResponse,
  generateId,
  getPatientByCareToken,
  updatePatient,
  updatePatientAssessmentStatus,
  addToWaitlist,
} from '../../../lib/store';

// Calcola livello personale dalle risposte NMQ
function computePersonalLevel(answers) {
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
  const { share_code } = req.query;

  if (req.method === 'GET') {
    const assessment = await getAssessmentByShareCode(share_code);
    if (!assessment) return res.status(404).json({ error: 'Link non valido' });
    if (assessment.status !== 'active') return res.status(410).json({ error: 'Questionario chiuso' });
    const client = await getClientById(assessment.client_id);
    return res.json({
      assessment: {
        id: assessment.id,
        type: assessment.type,
      },
      client: { name: client?.name },
    });
  }

  if (req.method === 'POST') {
    const assessment = await getAssessmentByShareCode(share_code);
    if (!assessment) return res.status(404).json({ error: 'Link non valido' });
    if (assessment.status !== 'active') return res.status(410).json({ error: 'Questionario chiuso' });

    // Estrai care_token dal body (link personalizzato)
    const { _care_token, ...answers } = req.body || {};

    try {
      await insertResponse({
        id: generateId('r'),
        assessment_id: assessment.id,
        answers,
        submitted_at: new Date().toISOString(),
      });

      // Se link personalizzato: aggiorna paziente con livello calcolato
      if (_care_token) {
        try {
          const patient = await getPatientByCareToken(_care_token);
          if (patient) {
            const computed_level = computePersonalLevel(answers);

            // Aggiorna livello paziente
            await updatePatient(patient.id, {
              computed_level,
              assessment_completed_at: new Date().toISOString(),
            });

            // Se L1 e non è già in trattamento: aggiungi in waitlist
            if (computed_level === 'level1' && patient.level !== 'level1') {
              await updatePatient(patient.id, { level: 'level1', level_status: 'active' });
              await addToWaitlist({
                id: generateId('wl'),
                patient_id: patient.id,
                client_id: patient.client_id,
                assessment_id: assessment.id,
                score: 100,
                source: 'assessment',
                status: 'pending',
                created_at: new Date().toISOString(),
              }).catch(() => {}); // ignora se già presente
            } else if (computed_level === 'level2' && patient.level !== 'level1') {
              await updatePatient(patient.id, { level: 'level2', level_status: 'active' });
            }

            await updatePatientAssessmentStatus(patient.id, {
              assessment_completed_at: new Date().toISOString(),
            }).catch(() => {});
          }
        } catch {
          // Errori sul tracking non bloccano il salvataggio della risposta
        }
      }

      return res.status(201).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
}
