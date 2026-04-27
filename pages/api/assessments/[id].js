import { requireAuth } from '../../../lib/auth';
import {
  getAssessmentById,
  getResponsesByAssessment,
  updateAssessment,
  deleteAssessmentById,
} from '../../../lib/store';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  const assessment = await getAssessmentById(id);
  if (!assessment) return res.status(404).json({ error: 'Non trovato' });

  if (req.method === 'GET') {
    const responses = await getResponsesByAssessment(id);
    return res.json({ ...assessment, responses });
  }

  if (req.method === 'PATCH') {
    try {
      const { status } = req.body;
      const updated = await updateAssessment(id, { status });
      return res.json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteAssessmentById(id);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
