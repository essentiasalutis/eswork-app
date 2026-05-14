import { requireAuth } from '../../../lib/auth';
import {
  getAllReferralCodes,
  getReferralCodesByClient,
  getClientById,
  getAssessmentsByClient,
  buildReferralCode,
  countReferralPairsForClient,
  insertReferralCode,
} from '../../../lib/store';

const DISCOUNT_PRICE = 65.00;
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

      // Usa l'assessment chiuso più recente come riferimento
      const assessments = await getAssessmentsByClient(client_id);
      const lastClosed = assessments.find(a => a.status === 'closed');
      if (!lastClosed) return res.status(400).json({ error: 'Nessun assessment chiuso per questa azienda. Chiudi prima un assessment.' });

      const pairs = await countReferralPairsForClient(client_id);
      const seq = pairs + 1;

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + VALIDITY_MONTHS);

      const referral = await insertReferralCode({
        client_id,
        assessment_id: lastClosed.id,
        code: buildReferralCode(client.name, seq, type),
        type,
        expires_at: expiresAt.toISOString(),
        max_uses: type === 'F' ? 1 : null,
        session_price: DISCOUNT_PRICE,
      });

      return res.json(referral);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
