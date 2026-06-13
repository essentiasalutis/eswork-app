import { requireProAuth } from '../../../../../lib/pro-auth';
import {
  getPatientById,
  getPatientDocuments,
  upsertPatientDocument,
  proCanAccessPatientClinical,
} from '../../../../../lib/store';
import { hashIp, hashContent } from '../../../../../lib/crypto-utils';
import { getClientIp } from '../../../../../lib/rate-limit';

// GET  /api/pro/patients/documents?patientId=xxx
// POST /api/pro/patients/documents — firma o compila documento
// Livello B (cartella clinica): SOLO l'osteopata assegnato al paziente.
export default requireProAuth(async function handler(req, res) {
  const proId = req.proSession.proId;
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: 'patientId richiesto' });

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });
  if (!(await proCanAccessPatientClinical(proId, patient))) {
    return res.status(403).json({ error: 'Accesso negato: documenti clinici riservati all\'osteopata assegnato.' });
  }

  if (req.method === 'GET') {
    try {
      const docs = await getPatientDocuments(patientId);
      return res.json(docs);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { type, client_id, signature_image, form_data, pro_notes, document_text } = req.body;
      if (!type || !client_id) return res.status(400).json({ error: 'type e client_id richiesti' });

      const ip = getClientIp(req);
      const now = new Date().toISOString();
      const isAnamnesi = type === 'anamnesi';

      const fields = {
        professional_id: proId,
        status: isAnamnesi ? 'completed' : 'signed',
        signed_at: now,
        ip_hash: hashIp(ip),
        user_agent: req.headers['user-agent']?.slice(0, 200) || null,
        ...(signature_image && { signature_image }),
        ...(document_text && { content_hash: hashContent(document_text) }),
        ...(form_data && { form_data }),
        ...(pro_notes !== undefined && { pro_notes }),
      };

      const doc = await upsertPatientDocument(patientId, client_id, type, fields);
      return res.json(doc);
    } catch (e) {
      console.error('[patient-docs] save error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
