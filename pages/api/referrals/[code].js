import { getReferralCodeByCode, insertReferralUse } from '../../../lib/store';
import { getClientIp } from '../../../lib/rate-limit';

// Questa route è pubblica (no requireAuth) — serve la pagina /care/[code]
export default async function handler(req, res) {
  const { code } = req.query;

  // GET /api/referrals/[code] — valida il codice e restituisce info base
  if (req.method === 'GET') {
    const referral = await getReferralCodeByCode(code);
    if (!referral) return res.status(404).json({ error: 'Codice non valido o scaduto' });

    return res.json({
      code: referral.code,
      clientName: referral.clients?.name || '',
      valid: true,
    });
  }

  // POST /api/referrals/[code]/use — registra un utilizzo
  if (req.method === 'POST') {
    const referral = await getReferralCodeByCode(code);
    if (!referral) return res.status(404).json({ error: 'Codice non valido o scaduto' });

    const { patient_name } = req.body || {};
    const ip = getClientIp(req);

    await insertReferralUse({
      referral_code_id: referral.id,
      patient_name: patient_name?.trim() || null,
      ip,
    });

    return res.json({ ok: true });
  }

  res.status(405).end();
}
