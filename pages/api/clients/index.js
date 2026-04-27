import { requireAuth } from '../../../lib/auth';
import { readDb, writeDb, generateId } from '../../../lib/store';

export default requireAuth(function handler(req, res) {
  const db = readDb();

  if (req.method === 'GET') {
    return res.json(db.clients);
  }

  if (req.method === 'POST') {
    const { name, sector, employees } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nome richiesto' });
    const client = {
      id: generateId('c'),
      name: name.trim(),
      sector: parseInt(sector) || 1,
      employees: parseInt(employees) || 50,
      created_at: new Date().toISOString(),
    };
    db.clients.push(client);
    writeDb(db);
    return res.status(201).json(client);
  }

  res.status(405).end();
});
