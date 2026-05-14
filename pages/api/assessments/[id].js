import { requireAuth } from '../../../lib/auth';
import {
  getAssessmentById,
  getClientById,
  getResponsesByAssessment,
  updateAssessment,
  deleteAssessmentById,
  buildReferralCode,
  countReferralPairsForClient,
  insertReferralCode,
} from '../../../lib/store';

const DISCOUNT_PRICE = 65.00; // prezzo scontato 20% (su base ~81€)
const VALIDITY_MONTHS = 12;

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

      // Auto-genera coppia P+F alla chiusura
      if (status === 'closed' && assessment.status !== 'closed') {
        try {
          const client = await getClientById(assessment.client_id);
          if (client) {
            const pairs = await countReferralPairsForClient(assessment.client_id);
            const seq = pairs + 1;
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + VALIDITY_MONTHS);

            const [codeP, codeF] = await Promise.all([
              insertReferralCode({
                client_id: assessment.client_id,
                assessment_id: id,
                code: buildReferralCode(client.name, seq, 'P'),
                type: 'P',
                expires_at: expiresAt.toISOString(),
                max_uses: null,   // illimitato
                session_price: DISCOUNT_PRICE,
              }),
              insertReferralCode({
                client_id: assessment.client_id,
                assessment_id: id,
                code: buildReferralCode(client.name, seq, 'F'),
                type: 'F',
                expires_at: expiresAt.toISOString(),
                max_uses: 1,      // una sola intestazione familiare
                session_price: DISCOUNT_PRICE,
              }),
            ]);

            return res.json({ ...updated, referral_code_p: codeP.code, referral_code_f: codeF.code });
          }
        } catch (refErr) {
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
