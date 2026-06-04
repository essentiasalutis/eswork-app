import { getSessionToken, verifyToken } from '../../../../lib/auth';
import supabase from '../../../../lib/db';
import { sendEmail } from '../../../../lib/email';
import { outcomeL1, outcomeL2, outcomeL3 } from '../../../../lib/email-templates';
import { insertEmailLog } from '../../../../lib/store';
import { computeLevel } from '../../../../lib/scoring';

// Livello aggregato della campagna: la funzione unica computeLevel() è applicata
// a ogni risposta; vince la severità più alta (L1 > L2 > L3).
function computeCampaignLevel(responses) {
  if (!responses || responses.length === 0) return 'level3';
  const levels = responses.map(r => computeLevel(r.answers || {}));
  if (levels.includes('level1')) return 'level1';
  if (levels.includes('level2')) return 'level2';
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

    // Calcola livello con la funzione unica
    const computed_level = computeCampaignLevel(assessment.responses || []);

    // Aggiorna assessments.computed_level
    await supabase.from('assessments').update({ computed_level }).eq('id', id);

    // Invia email esito al paziente (se ha email e care_token)
    // Cerca paziente associato all'assessment tramite client_id (campagna)
    sendOutcomeEmail(assessment.client_id, computed_level).catch(() => {});

    return res.json({ computed_level, assessment_id: id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

async function sendOutcomeEmail(client_id, computed_level) {
  // Cerca l'assessment appena completato: aggiorna assessment_completed_at
  // In questo sistema, l'assessment è una campagna — non sappiamo quale paziente
  // specifico ha risposto (design anonimo). L'email post-stratificazione viene
  // inviata solo ai pazienti L1 identificati tramite il flusso pre-validazione.
  // TODO: quando viene implementato il tracking per-paziente, inviare l'email qui.
}
