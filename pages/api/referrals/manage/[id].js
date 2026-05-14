import { requireAuth } from '../../../../lib/auth';
import { updateReferralCode, deleteReferralCode } from '../../../../lib/store';

// PATCH /api/referrals/manage/[id] — { is_active: true/false }
// DELETE /api/referrals/manage/[id] — elimina codice + utilizzi (cascade)
export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PATCH') {
    try {
      const { is_active } = req.body;
      const updated = await updateReferralCode(id, { is_active });
      return res.json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteReferralCode(id);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
