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

  const { client_id, type } = req.body;
  if (!client_id || !type) return res.status(400).json({ error: 'Dati mancanti' });

  try {
    const client = await getClientById(client_id);
    if (!client) return res.status(404).json({ error: 'Cliente non trovato' });

    let share_code;
    do {
      share_code = generateShareCode();
    } while (await shareCodeExists(share_code));

    // v4: strumento unico NMQ. PSS-10/UWES-9/eNPS rimossi dal modello.
    const assessment = await insertAssessment({
      id: generateId('a'),
      client_id,
      type,
      status: 'active',
      share_code,
      created_at: new Date().toISOString(),
    });

    return res.status(201).json(assessment);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
