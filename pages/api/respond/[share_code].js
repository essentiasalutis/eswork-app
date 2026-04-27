import {
  getAssessmentByShareCode,
  getClientById,
  insertResponse,
  generateId,
} from '../../../lib/store';

export default async function handler(req, res) {
  const { share_code } = req.query;

  if (req.method === 'GET') {
    const assessment = await getAssessmentByShareCode(share_code);
    if (!assessment) return res.status(404).json({ error: 'Link non valido' });
    if (assessment.status !== 'active') return res.status(410).json({ error: 'Questionario chiuso' });
    const client = await getClientById(assessment.client_id);
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
    const assessment = await getAssessmentByShareCode(share_code);
    if (!assessment) return res.status(404).json({ error: 'Link non valido' });
    if (assessment.status !== 'active') return res.status(410).json({ error: 'Questionario chiuso' });

    try {
      await insertResponse({
        id: generateId('r'),
        assessment_id: assessment.id,
        answers: req.body,
        submitted_at: new Date().toISOString(),
      });
      return res.status(201).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
}
