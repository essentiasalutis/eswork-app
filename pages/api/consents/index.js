import { insertAssessmentConsent } from '../../../lib/store';
import { hashIp } from '../../../lib/crypto-utils';
import { getClientIp } from '../../../lib/rate-limit';

// POST /api/consents — salva il consenso pre-questionario
// Chiamato appena l'utente clicca "Inizia il questionario"
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { assessment_id, consent_privacy, consent_health } = req.body;
  if (!assessment_id || !consent_privacy || !consent_health) {
    return res.status(400).json({ error: 'Consensi obbligatori mancanti' });
  }

  const ip = getClientIp(req);
  const now = new Date().toISOString();

  try {
    const record = await insertAssessmentConsent({
      assessment_id,
      consent_privacy_at: now,
      consent_health_at: now,
      ip_hash: hashIp(ip),
      user_agent: req.headers['user-agent']?.slice(0, 200) || null,
    });
    return res.json({ ok: true, id: record.id });
  } catch (e) {
    console.error('[consent] save error:', e.message);
    return res.status(500).json({ error: 'Errore nel salvataggio del consenso' });
  }
}
