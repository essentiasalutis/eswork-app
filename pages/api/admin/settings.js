import { requireAuth } from '../../../lib/auth';
import { getAdminSettings, upsertAdminSetting } from '../../../lib/store';

export default requireAuth(async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const settings = await getAdminSettings();
      return res.json(settings);
    } catch {
      return res.status(500).json({ error: 'Errore lettura impostazioni' });
    }
  }

  if (req.method === 'PATCH') {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: 'key e value obbligatori' });
    try {
      const updated = await upsertAdminSetting(key, String(value));
      return res.json(updated);
    } catch {
      return res.status(500).json({ error: 'Errore salvataggio' });
    }
  }

  return res.status(405).end();
});
