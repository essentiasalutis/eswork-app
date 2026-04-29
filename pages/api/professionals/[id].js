import { requireAuth } from '../../../lib/auth';
import { getProfessionalById, updateProfessional } from '../../../lib/store';
import { hashPassword } from '../../../lib/pro-auth';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;
  const pro = await getProfessionalById(id);
  if (!pro) return res.status(404).json({ error: 'Non trovato' });

  // Disattiva / riattiva account
  if (req.method === 'PATCH') {
    try {
      const { active, must_reset_password, new_password } = req.body;
      const fields = {};
      if (active !== undefined) fields.active = active;
      if (must_reset_password !== undefined) fields.must_reset_password = must_reset_password;
      if (new_password) {
        if (new_password.length < 8) return res.status(400).json({ error: 'Password min. 8 caratteri' });
        fields.password_hash = hashPassword(new_password);
        fields.must_reset_password = true;
      }
      const updated = await updateProfessional(id, fields);
      return res.json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
