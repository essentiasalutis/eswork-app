import { requireAuth } from '../../../lib/auth';
import { getProfessionalById, updateProfessional } from '../../../lib/store';
import { hashPassword } from '../../../lib/pro-auth';
import supabase from '../../../lib/db';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;
  const pro = await getProfessionalById(id);
  if (!pro) return res.status(404).json({ error: 'Non trovato' });

  // Disattiva / riattiva / aggiorna password
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

  // Elimina professionista
  if (req.method === 'DELETE') {
    try {
      // Rimuove assegnazioni e log accessi prima di eliminare
      await supabase.from('professional_assignments').delete().eq('professional_id', id);
      await supabase.from('access_logs').delete().eq('professional_id', id);
      const { error } = await supabase.from('professionals').delete().eq('id', id);
      if (error) throw error;
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
