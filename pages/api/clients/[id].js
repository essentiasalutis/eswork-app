import { requireAuth } from '../../../lib/auth';
import { readDb, writeDb } from '../../../lib/store';

export default requireAuth(function handler(req, res) {
  const { id } = req.query;
  const db = readDb();
  const idx = db.clients.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Non trovato' });

  if (req.method === 'GET') {
    return res.json(db.clients[idx]);
  }

  if (req.method === 'PUT') {
    const { name, sector, employees } = req.body;
    db.clients[idx] = { ...db.clients[idx], name, sector, employees };
    writeDb(db);
    return res.json(db.clients[idx]);
  }

  if (req.method === 'DELETE') {
    db.clients.splice(idx, 1);
    db.assessments = db.assessments.filter(a => a.client_id !== id);
    writeDb(db);
    return res.json({ ok: true });
  }

  res.status(405).end();
});
