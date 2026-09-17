import { requireProAuth } from '../../../../../lib/pro-auth';
import {
  getPatientById,
  getPatientDocuments,
  upsertPatientDocument,
  proCanAccessPatientClinical,
  logAccess,
} from '../../../../../lib/store';
import { hashIp, hashContent } from '../../../../../lib/crypto-utils';
import { getClientIp } from '../../../../../lib/rate-limit';
import { vistaDocumentoPaziente } from '../../../../../lib/vista';

// GET  /api/pro/patients/documents?patientId=xxx
// POST /api/pro/patients/documents — aggiorna l'anamnesi (i consensi: solo /bulk)
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
      await logAccess({ professional_id: proId, action: 'view_documents', patient_id: patientId, ip: getClientIp(req), user_agent: req.headers['user-agent'], details: 'Lettura documenti clinici' }).catch(() => {});
      // Proiezione (12/9): tipo, stato, data e impronta. Mai l'immagine della firma
      // autografa né il contenuto del modulo: la pagina mostra solo se esistono e se
      // sono validi (la pagina gemella SSR la firma la toglieva già).
      return res.json((docs || []).map(vistaDocumentoPaziente));
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST — SOLO l'anamnesi (modifica dalla cartella). I due consensi si firmano
  // unicamente da /documents/bulk, contro la versione d'archivio (v64): qui prima
  // si poteva segnare «firmato» un consenso senza firma, senza archivio e con
  // l'azienda presa dal corpo della richiesta.
  if (req.method === 'POST') {
    try {
      const { type, form_data, pro_notes } = req.body || {};
      if (type !== 'anamnesi') {
        return res.status(400).json({ error: 'Da qui si aggiorna solo l\'anamnesi: i consensi si firmano con la firma cumulativa.' });
      }
      if (!form_data || typeof form_data !== 'object') return res.status(400).json({ error: 'dati anamnesi obbligatori' });

      const ip = getClientIp(req);
      const now = new Date().toISOString();
      const fields = {
        professional_id: proId,
        status: 'completed',
        signed_at: now,
        ip_hash: hashIp(ip),
        user_agent: req.headers['user-agent']?.slice(0, 200) || null,
        form_data,
        content_hash: hashContent(JSON.stringify(form_data)),
        ...(pro_notes !== undefined && { pro_notes }),
      };

      // L'azienda si legge dal paziente, non dal corpo della richiesta.
      const doc = await upsertPatientDocument(patientId, patient.client_id, 'anamnesi', fields);
      await logAccess({ professional_id: proId, action: 'sign_document', patient_id: patientId, ip, user_agent: req.headers['user-agent'], details: 'Documento anamnesi compilato' }).catch(() => {});
      return res.json(vistaDocumentoPaziente(doc));
    } catch (e) {
      console.error('[patient-docs] save error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
