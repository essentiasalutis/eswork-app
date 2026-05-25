import { getSessionToken, verifyToken } from '../../../../lib/auth';
import supabase from '../../../../lib/db';

// Calcola livello da risposte NMQ
function computeLevelFromResponses(responses) {
  if (!responses || responses.length === 0) return 'level3';
  let hasFunctionalImpact = false;
  let hasPain7days = false;
  for (const r of responses) {
    const a = r.answers || {};
    if (a.functional_impact === true || a.functional_impact === 'true' || a.functional_impact === 1) {
      hasFunctionalImpact = true;
    }
    if (
      a.pain_7days === true || a.pain_7days === 'true' || a.pain_7days === 1 ||
      (typeof a.pain_7days === 'number' && a.pain_7days > 0)
    ) {
      hasPain7days = true;
    }
  }
  if (hasFunctionalImpact) return 'level1';
  if (hasPain7days) return 'level2';
  return 'level3';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = getSessionToken(req);
  if (!token || !verifyToken(token)) return res.status(401).json({ error: 'Non autorizzato' });

  const { id } = req.query;
  try {
    // Prendi assessment + risposte
    const { data: assessment, error: ae } = await supabase
      .from('assessments').select('*, responses(*)').eq('id', id).single();
    if (ae || !assessment) return res.status(404).json({ error: 'Assessment non trovato' });

    // Calcola livello
    const computed_level = computeLevelFromResponses(assessment.responses || []);

    // Aggiorna assessments.computed_level
    await supabase.from('assessments').update({ computed_level }).eq('id', id);

    return res.json({ computed_level, assessment_id: id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
