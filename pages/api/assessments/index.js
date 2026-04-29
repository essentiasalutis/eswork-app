import { requireAuth } from '../../../lib/auth';
import {
  getClientById,
  insertAssessment,
  shareCodeExists,
  generateId,
  generateShareCode,
} from '../../../lib/store';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { client_id, type, include_pss } = req.body;
  if (!client_id || !type) return res.status(400).json({ error: 'Dati mancanti' });

  try {
    const client = await getClientById(client_id);
    if (!client) return res.status(404).json({ error: 'Cliente non trovato' });

    let share_code;
    do {
      share_code = generateShareCode();
    } while (await shareCodeExists(share_code));

    // PSS-10 solo per assessment iniziale e finale
    const pssAllowed = type === 'initial' || type === 'final';
    const assessment = await insertAssessment({
      id: generateId('a'),
      client_id,
      type,
      status: 'active',
      include_pss: pssAllowed && include_pss !== false,
      share_code,
      created_at: new Date().toISOString(),
    });

    return res.status(201).json(assessment);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
