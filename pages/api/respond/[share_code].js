import { readDb, writeDb, generateId } from '../../../lib/store';

export default function handler(req, res) {
  const { share_code } = req.query;

  if (req.method === 'GET') {
    const db = readDb();
    const assessment = db.assessments.find(a => a.share_code === share_code);
    if (!assessment) return res.status(404).json({ error: 'Link non valido' });
    if (assessment.status !== 'active') return res.status(410).json({ error: 'Questionario chiuso' });
    const client = db.clients.find(c => c.id === assessment.client_id);
    return res.json({
      assessment: {
        id: assessment.id,
        type: assessment.type,
        include_pss: assessment.include_pss,
      },
      client: { name: client?.name },
    });
  }

  if (req.method === 'POST') {
    const db = readDb();
    const assessment = db.assessments.find(a => a.share_code === share_code);
    if (!assessment) return res.status(404).json({ error: 'Link non valido' });
    if (assessment.status !== 'active') return res.status(410).json({ error: 'Questionario chiuso' });

    const response = {
      id: generateId('r'),
      assessment_id: assessment.id,
      answers: req.body,
      submitted_at: new Date().toISOString(),
    };
    db.responses.push(response);
    writeDb(db);
    return res.status(201).json({ ok: true });
  }

  res.status(405).end();
}
