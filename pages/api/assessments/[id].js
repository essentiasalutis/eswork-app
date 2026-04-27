import { requireAuth } from '../../../lib/auth';
import { readDb, writeDb } from '../../../lib/store';

export default requireAuth(function handler(req, res) {
  const { id } = req.query;
  const db = readDb();
  const idx = db.assessments.findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Non trovato' });

  if (req.method === 'GET') {
    const a = db.assessments[idx];
    const responses = db.responses.filter(r => r.assessment_id === id);
    return res.json({ ...a, responses });
  }

  if (req.method === 'PATCH') {
    const { status } = req.body;
    db.assessments[idx] = { ...db.assessments[idx], status };
    writeDb(db);
    return res.json(db.assessments[idx]);
  }

  if (req.method === 'DELETE') {
    db.assessments.splice(idx, 1);
    db.responses = db.responses.filter(r => r.assessment_id !== id);
    writeDb(db);
    return res.json({ ok: true });
  }

  res.status(405).end();
});
