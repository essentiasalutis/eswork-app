// POST /api/assessments/save-progress
// Salva progressi parziali dell'assessment (autosave server-side)
import { updateAssessmentProgress, getAssessmentByShareCode } from '../../../lib/store';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { share_code, progress_data } = req.body;
  if (!share_code || !progress_data) return res.status(400).json({ error: 'share_code e progress_data obbligatori' });

  try {
    const assessment = await getAssessmentByShareCode(share_code).catch(() => null);
    if (!assessment) return res.status(404).json({ error: 'Assessment non trovato' });

    await updateAssessmentProgress(assessment.id, progress_data);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
