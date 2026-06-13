import { requireProAuth } from '../../../../../lib/pro-auth';
import { upsertPatientDocument, getPatientById, proCanAccessPatientClinical, logAccess } from '../../../../../lib/store';
import { hashIp, hashContent } from '../../../../../lib/crypto-utils';
import { getClientIp } from '../../../../../lib/rate-limit';

// POST /api/pro/patients/documents/bulk?patientId=xxx
// Salva consenso + privacy + anamnesi in un'unica operazione con firma cumulativa.
// Registra: timestamp, hash contenuto documenti, ip anonimizzato, user-agent.
// Livello B (cartella clinica): SOLO l'osteopata assegnato al paziente.

export default requireProAuth(async function handler(req, res) {
  const proId = req.proSession.proId;

  if (req.method !== 'POST') return res.status(405).end();

  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: 'patientId richiesto' });

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });
  if (!(await proCanAccessPatientClinical(proId, patient))) {
    return res.status(403).json({ error: 'Accesso negato: documenti clinici riservati all\'osteopata assegnato.' });
  }

  try {
    const {
      client_id,
      signature_image,
      form_data,
      pro_notes,
      consent_text,
      privacy_text,
    } = req.body;

    if (!client_id)       return res.status(400).json({ error: 'client_id richiesto' });
    if (!signature_image) return res.status(400).json({ error: 'firma obbligatoria' });
    if (!form_data)       return res.status(400).json({ error: 'dati anamnesi obbligatori' });

    const ip    = getClientIp(req);
    const now   = new Date().toISOString();
    const base  = {
      professional_id: proId,
      signed_at:       now,
      ip_hash:         hashIp(ip),
      user_agent:      req.headers['user-agent']?.slice(0, 200) || null,
      signature_image,
    };

    const [docConsent, docPrivacy, docAnamnesi] = await Promise.all([
      upsertPatientDocument(patientId, client_id, 'consent_treatment', {
        ...base,
        status:       'signed',
        content_hash: consent_text ? hashContent(consent_text) : null,
      }),
      upsertPatientDocument(patientId, client_id, 'privacy_extended', {
        ...base,
        status:       'signed',
        content_hash: privacy_text ? hashContent(privacy_text) : null,
      }),
      upsertPatientDocument(patientId, client_id, 'anamnesi', {
        ...base,
        status:       'completed',
        form_data,
        pro_notes:    pro_notes || null,
        content_hash: hashContent(JSON.stringify(form_data)),
      }),
    ]);

    await logAccess({ professional_id: proId, action: 'sign_documents', patient_id: patientId, ip, user_agent: req.headers['user-agent'], details: 'Firma cumulativa: consenso + privacy + anamnesi' }).catch(() => {});

    console.log(`[bulk-docs] patient=${patientId} signed at ${now} — consent=${docConsent.id} privacy=${docPrivacy.id} anamnesi=${docAnamnesi.id}`);
    return res.json([docConsent, docPrivacy, docAnamnesi]);

  } catch (e) {
    console.error('[bulk-docs] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});
