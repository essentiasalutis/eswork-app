import { requireProAuth } from '../../../../lib/pro-auth';
import { getReferralUseByVoucher, updateReferralUse } from '../../../../lib/store';

// POST { voucher_code, amount } — il professionista redime un buono visita B2C.
// La redenzione = prova che la visita è avvenuta (conversione reale, anti-elusione).
export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const proId = req.proSession.proId;
  const { voucher_code, amount } = req.body || {};
  const codeNorm = (voucher_code || '').trim().toUpperCase();
  if (!codeNorm) return res.status(400).json({ error: 'Buono visita richiesto' });

  try {
    const use = await getReferralUseByVoucher(codeNorm);
    if (!use) return res.status(404).json({ error: 'Buono non trovato. Controlla il codice.' });
    if (use.status === 'redeemed') {
      return res.status(409).json({ error: 'Buono già redento in precedenza.' });
    }

    const amt = amount != null && amount !== '' ? Number(amount) : null;
    if (amt != null && (isNaN(amt) || amt < 0)) {
      return res.status(400).json({ error: 'Importo non valido.' });
    }

    const updated = await updateReferralUse(use.id, {
      status: 'redeemed',
      redeemed_at: new Date().toISOString(),
      redeemed_by: proId,
      amount: amt,
    });

    return res.json({
      ok: true,
      patient_name: use.patient_name || null,
      client_name: use.referral_codes?.clients?.name || null,
      type: use.referral_codes?.type || null,
      amount: updated.amount,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
