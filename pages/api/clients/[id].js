import { requireAuth } from '../../../lib/auth';
import { getClientById, updateClient, deleteClientById } from '../../../lib/store';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  const client = await getClientById(id);
  if (!client) return res.status(404).json({ error: 'Non trovato' });

  if (req.method === 'GET') {
    return res.json(client);
  }

  if (req.method === 'PUT') {
    try {
      const { name, sector, employees, contact_name, contact_email, contact_phone, notes, source } = req.body;
      const updated = await updateClient(id, {
        name: name?.trim(),
        sector: parseInt(sector) || client.sector,
        employees: parseInt(employees) || client.employees,
        contact_name: contact_name?.trim() || null,
        contact_email: contact_email?.trim() || null,
        contact_phone: contact_phone?.trim() || null,
        notes: notes?.trim() || null,
        source: source || client.source,
      });
      return res.json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const updated = await updateClient(id, req.body);
      return res.json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteClientById(id);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
