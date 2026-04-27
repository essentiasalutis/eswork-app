import { requireAuth } from '../../../lib/auth';
import { readDb, writeDb, generateId, generateShareCode } from '../../../lib/store';

export default requireAuth(function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { client_id, type, include_pss } = req.body;
  if (!client_id || !type) return res.status(400).json({ error: 'Dati mancanti' });

  const db = readDb();
  if (!db.clients.find(c => c.id === client_id))
    return res.status(404).json({ error: 'Cliente non trovato' });

  let share_code;
  do { share_code = generateShareCode(); }
  while (db.assessments.find(a => a.share_code === share_code));

  const assessment = {
    id: generateId('a'),
    client_id,
    type,
    status: 'active',
    include_pss: include_pss !== false,
    share_code,
    created_at: new Date().toISOString(),
  };
  db.assessments.push(assessment);
  writeDb(db);
  return res.status(201).json(assessment);
});
