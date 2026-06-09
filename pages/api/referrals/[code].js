import { getReferralCodeByCode, insertReferralUse, buildVoucherCode } from '../../../lib/store';
import { getClientIp } from '../../../lib/rate-limit';

export default async function handler(req, res) {
  const { code } = req.query;

  // GET — valida codice e restituisce info per la pagina pubblica
  if (req.method === 'GET') {
    const referral = await getReferralCodeByCode(code);
    if (!referral) return res.status(404).json({ error: 'Codice non valido o scaduto' });

    // Verifica scadenza
    if (referral.expires_at && new Date(referral.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Codice scaduto' });
    }

    // Verifica max_uses (es. F code: usabile 1 volta)
    const usesCount = referral.referral_uses?.length || 0;
    if (referral.max_uses !== null && usesCount >= referral.max_uses) {
      return res.status(410).json({ error: 'Codice già utilizzato' });
    }

    return res.json({
      code: referral.code,
      type: referral.type || 'P',
      clientName: referral.clients?.name || '',
      expiresAt: referral.expires_at,
      valid: true,
    });
  }

  // POST — registra un utilizzo
  if (req.method === 'POST') {
    const referral = await getReferralCodeByCode(code);
    if (!referral) return res.status(404).json({ error: 'Codice non valido o scaduto' });

    if (referral.expires_at && new Date(referral.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Codice scaduto' });
    }

    const usesCount = referral.referral_uses?.length || 0;
    if (referral.max_uses !== null && usesCount >= referral.max_uses) {
      return res.status(410).json({ error: 'Codice già utilizzato al massimo consentito' });
    }

    const { patient_name } = req.body || {};
    const ip = getClientIp(req);
    const voucher_code = buildVoucherCode();

    try {
      await insertReferralUse({
        referral_code_id: referral.id,
        patient_name: patient_name?.trim() || null,
        ip,
        voucher_code,
        status: 'requested',
      });
    } catch (e) {
      // Fallback se la migration v26 (colonne voucher) non è ancora stata applicata:
      // registra comunque l'uso senza i nuovi campi, così /care non si rompe.
      await insertReferralUse({
        referral_code_id: referral.id,
        patient_name: patient_name?.trim() || null,
        ip,
      }).catch(() => {});
    }

    return res.json({ ok: true, voucher_code });
  }

  res.status(405).end();
}
