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
import { computeLevel } from '../../../lib/scoring';

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
            const computed_level = computeLevel(answers);

            // prevention_eligible: L2 da assessment solo nei tier Plus/Enterprise
            const respClient = await getClientById(patient.client_id).catch(() => null);
            const rn = parseInt(respClient?.employees) || 0;
            const rtier = respClient?.tier || (rn <= 150 ? 'core' : rn <= 500 ? 'plus' : 'enterprise');
            const prevention_eligible = computed_level === 'level2' && (rtier === 'plus' || rtier === 'enterprise');

            await updatePatient(patient.id, {
              computed_level,
              prevention_eligible,
              assessment_completed_at: new Date().toISOString(),
            });

            // Se L1: CANDIDATO in coda pre-validazione (level_status='pending'),
            // NON confermato. Il level active lo dà solo la pre-validazione l1_confirmed.
            if (computed_level === 'level1' && patient.level !== 'level1') {
              await updatePatient(patient.id, { level: 'level1', level_status: 'pending' });
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
