import { requireAuth } from '../../../lib/auth';
import { getProfessionals, insertProfessional, generateId } from '../../../lib/store';
import { hashPassword } from '../../../lib/pro-auth';

export default requireAuth(async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const pros = await getProfessionals();
      return res.json(pros);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, email, password, phone } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'Nome obbligatorio' });
      if (!email?.trim()) return res.status(400).json({ error: 'Email obbligatoria' });
      if (!password || password.length < 8) return res.status(400).json({ error: 'Password min. 8 caratteri' });

      const pro = await insertProfessional({
        id: generateId('pro'),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password_hash: hashPassword(password),
        phone: phone?.trim() || null,
        active: true,
        must_reset_password: true, // forza reset al primo login
        created_at: new Date().toISOString(),
      });

      // Non restituire il hash
      const { password_hash, ...safe } = pro;
      return res.status(201).json(safe);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
