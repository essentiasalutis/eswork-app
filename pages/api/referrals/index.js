import { requireAuth } from '../../../lib/auth';
import {
  getAllReferralCodes,
  getReferralCodesByClient,
  getClientById,
  getAssessmentsByClient,
  buildReferralCode,
  insertReferralCode,
} from '../../../lib/store';
import { CONFIG } from '../../../lib/config';

const VALIDITY_MONTHS = 12;

export default requireAuth(async function handler(req, res) {
  // GET /api/referrals
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

  // POST /api/referrals — genera manualmente un codice P o F
  if (req.method === 'POST') {
    try {
      const { client_id, type = 'P' } = req.body;
      if (!client_id) return res.status(400).json({ error: 'client_id richiesto' });
      if (!['P', 'F'].includes(type)) return res.status(400).json({ error: 'type deve essere P o F' });

      const client = await getClientById(client_id);
      if (!client) return res.status(404).json({ error: 'Cliente non trovato' });

      // 1 solo codice per tipo per azienda (Dipendenti / Famigliari)
      const existing = await getReferralCodesByClient(client_id);
      if (existing.some(c => (c.type || 'P') === type)) {
        return res.status(400).json({
          error: `Esiste già un codice ${type === 'F' ? 'Famigliari' : 'Dipendenti'} per questa azienda.`,
        });
      }

      // assessment_id è opzionale (opt-in): si collega all'assessment più recente
      // se presente, altrimenti resta null (richiede migration v25).
      const assessments = await getAssessmentsByClient(client_id).catch(() => []);
      const refAssessmentId = assessments[0]?.id || null;

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + VALIDITY_MONTHS);

      const referral = await insertReferralCode({
        client_id,
        assessment_id: refAssessmentId,
        code: buildReferralCode(client.name, type),
        type,
        expires_at: expiresAt.toISOString(),
        max_uses: null,
        session_price: CONFIG.referral_session_price ?? 65,
      });

      return res.json(referral);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
