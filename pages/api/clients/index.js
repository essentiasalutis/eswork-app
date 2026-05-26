import { requireAuth } from '../../../lib/auth';
import { getClients, insertClient, generateId } from '../../../lib/store';

export default requireAuth(async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const clients = await getClients();
      return res.json(clients);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    const { name, sector, employees, contact_name, contact_email, contact_phone, notes, source } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nome richiesto' });
    try {
      const client = await insertClient({
        id: generateId('c'),
        name: name.trim(),
        sector: parseInt(sector) || 1,
        employees: parseInt(employees) || 50,
        contact_name: contact_name?.trim() || null,
        contact_email: contact_email?.trim() || null,
        contact_phone: contact_phone?.trim() || null,
        notes: notes?.trim() || null,
        source: source || 'passaparola',
        pipeline_stage: 'contacted',
        assessment_share_code: Math.random().toString(36).substring(2, 8),
        created_at: new Date().toISOString(),
      });
      return res.status(201).json(client);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
