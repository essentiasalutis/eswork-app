// GET  /api/pro/documents          — elenco dei PROPRI documenti
// POST /api/pro/documents          — conferma upload (registra il record + log)
import { requireProAuth } from '../../../../lib/pro-auth';
import { getProDocuments, upsertProDocument, logProDocAccess } from '../../../../lib/store';
import { removeFile } from '../../../../lib/storage';
import { getClientIp } from '../../../../lib/rate-limit';
import { DOC_TYPES as TYPES } from '../../../../lib/pro-docs';

export default requireProAuth(async function handler(req, res) {
  const proId = req.proSession.proId;

  if (req.method === 'GET') {
    return res.json(await getProDocuments(proId));
  }

  if (req.method === 'POST') {
    const { doc_type, path, file_name, mime_type, size_bytes, expiry_date } = req.body || {};
    if (!TYPES.includes(doc_type) || !path) return res.status(400).json({ error: 'Dati mancanti' });
    // Difesa: si può confermare solo un path nella PROPRIA cartella
    if (!path.startsWith(`${proId}/`)) return res.status(403).json({ error: 'Percorso non consentito' });

    const fields = {
      professional_id: proId,
      doc_type,
      file_path: path,
      file_name: file_name || null,
      mime_type: mime_type || null,
      size_bytes: size_bytes != null ? parseInt(size_bytes, 10) : null,
      expiry_date: doc_type === 'rc_policy' ? (expiry_date || null) : null,
      uploaded_by: 'pro',
    };

    try {
      const { doc, oldPath } = await upsertProDocument(fields);
      if (oldPath) await removeFile(oldPath); // re-upload → rimuovi il vecchio file
      await logProDocAccess({
        professional_id: proId, doc_type, action: 'upload_pro_doc',
        actor_type: 'pro', actor_id: proId,
        ip: getClientIp(req), user_agent: req.headers['user-agent'],
      });
      return res.status(201).json(doc);
    } catch (e) {
      console.error('[pro-doc confirm] error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).end();
});
