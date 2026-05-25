import { requireAuth } from '../../../../lib/auth';
import { getClientById, insertPatient, generateId } from '../../../../lib/store';

// Atteso body: { rows: [{first_name, last_name, location, gender?, job_title?}] }
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.query;
  const client = await getClientById(id).catch(() => null);
  if (!client) return res.status(404).json({ error: 'Cliente non trovato' });

  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'rows obbligatorio' });
  if (rows.length > 500) return res.status(400).json({ error: 'Max 500 righe per importazione' });

  const results = { imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const firstName = (row.first_name || row.nome || '').trim();
    const lastName = (row.last_name || row.cognome || '').trim();
    if (!firstName || !lastName) { results.skipped++; continue; }

    try {
      await insertPatient({
        id: generateId('pat'),
        client_id: id,
        first_name: firstName,
        last_name: lastName,
        location: (row.location || row.sede || '').trim() || null,
        gender: ['M', 'F'].includes((row.gender || row.genere || '').toUpperCase())
          ? (row.gender || row.genere).toUpperCase() : null,
        job_title: (row.job_title || row.mansione || '').trim() || null,
        level: 'level3',
        level_status: 'active',
        created_at: new Date().toISOString(),
      });
      results.imported++;
    } catch (e) {
      results.errors.push({ row: `${firstName} ${lastName}`, error: e.message });
      results.skipped++;
    }
  }

  return res.json(results);
});
