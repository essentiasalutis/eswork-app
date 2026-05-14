import { requireAuth } from '../../../lib/auth';
import {
  getAssessmentById,
  getClientById,
  getResponsesByAssessment,
  updateAssessment,
  deleteAssessmentById,
  buildReferralCode,
  countReferralCodesForClientYear,
  insertReferralCode,
} from '../../../lib/store';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  const assessment = await getAssessmentById(id);
  if (!assessment) return res.status(404).json({ error: 'Non trovato' });

  if (req.method === 'GET') {
    const responses = await getResponsesByAssessment(id);
    return res.json({ ...assessment, responses });
  }

  if (req.method === 'PATCH') {
    try {
      const { status } = req.body;
      const updated = await updateAssessment(id, { status });

      // Auto-genera codice referral quando l'assessment viene chiuso
      if (status === 'closed' && assessment.status !== 'closed') {
        try {
          const client = await getClientById(assessment.client_id);
          if (client) {
            const year = new Date().getFullYear();
            const existing = await countReferralCodesForClientYear(assessment.client_id, year);
            const code = buildReferralCode(client.name, year, existing + 1);
            await insertReferralCode({
              client_id: assessment.client_id,
              assessment_id: id,
              code,
            });
            return res.json({ ...updated, referral_code: code });
          }
        } catch (refErr) {
          // Non bloccare la risposta se il referral fallisce
          console.error('[referral] auto-generate failed:', refErr.message);
        }
      }

      return res.json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteAssessmentById(id);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
