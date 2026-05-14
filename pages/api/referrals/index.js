import { requireAuth } from '../../../lib/auth';
import {
  getAllReferralCodes,
  getReferralCodesByClient,
  getClientById,
  getAssessmentById,
  buildReferralCode,
  countReferralCodesForClientYear,
  insertReferralCode,
} from '../../../lib/store';

export default requireAuth(async function handler(req, res) {
  // GET /api/referrals — tutti i codici con statistiche (per dashboard admin)
  if (req.method === 'GET') {
    try {
      const { clientId } = req.query;
      const codes = clientId
        ? await getReferralCodesByClient(clientId)
        : await getAllReferralCodes();
      return res.json(codes);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST /api/referrals — genera manualmente un codice per un assessment
  if (req.method === 'POST') {
    try {
      const { assessment_id, client_id } = req.body;
      if (!assessment_id || !client_id) {
        return res.status(400).json({ error: 'assessment_id e client_id richiesti' });
      }

      const [client, assessment] = await Promise.all([
        getClientById(client_id),
        getAssessmentById(assessment_id),
      ]);

      if (!client) return res.status(404).json({ error: 'Cliente non trovato' });
      if (!assessment) return res.status(404).json({ error: 'Assessment non trovato' });

      const year = new Date().getFullYear();
      const existing = await countReferralCodesForClientYear(client_id, year);
      const code = buildReferralCode(client.name, year, existing + 1);

      const referral = await insertReferralCode({ client_id, assessment_id, code });
      return res.json(referral);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
