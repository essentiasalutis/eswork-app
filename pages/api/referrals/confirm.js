import { getReferralUseByVoucher, updateReferralUse } from '../../../lib/store';

// POST { voucher_code, response: 'done' | 'not_done' }
// Conferma lato PAZIENTE che la visita è avvenuta (o no). Pubblico (no auth):
// il possesso del voucher è sufficiente. È la controprova anti-elusione.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { voucher_code, response } = req.body || {};
  const codeNorm = (voucher_code || '').trim().toUpperCase();
  const resp = response === 'not_done' ? 'not_done' : response === 'done' ? 'done' : null;
  if (!codeNorm) return res.status(400).json({ error: 'Buono mancante' });
  if (!resp) return res.status(400).json({ error: 'Risposta non valida' });

  try {
    const use = await getReferralUseByVoucher(codeNorm);
    if (!use) return res.status(404).json({ error: 'Buono non trovato' });

    await updateReferralUse(use.id, {
      confirm_response: resp,
      confirmed_at: new Date().toISOString(),
    });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
