// GET    /api/pro/documents/[id]   — URL firmato (60s) per scaricare il PROPRIO documento
// PUT    /api/pro/documents/[id]   — aggiorna la scadenza (solo polizza RC)
// DELETE /api/pro/documents/[id]   — elimina documento (record + file)
import { requireProAuth } from '../../../../lib/pro-auth';
import {
  getProDocumentById, updateProDocument, deleteProDocumentRow, logProDocAccess,
} from '../../../../lib/store';
import { createDownloadUrl, removeFile } from '../../../../lib/storage';
import { getClientIp } from '../../../../lib/rate-limit';

export default requireProAuth(async function handler(req, res) {
  const proId = req.proSession.proId;
  const { id } = req.query;

  const doc = await getProDocumentById(id);
  if (!doc) return res.status(404).json({ error: 'Documento non trovato' });
  // Isolamento per PROPRIETÀ: un osteopata accede solo ai propri documenti
  if (doc.professional_id !== proId) return res.status(403).json({ error: 'Accesso negato' });

  if (req.method === 'GET') {
    try {
      const url = await createDownloadUrl(doc.file_path, 60);
      await logProDocAccess({
        professional_id: proId, doc_type: doc.doc_type, action: 'view_pro_doc',
        actor_type: 'pro', actor_id: proId, ip: getClientIp(req), user_agent: req.headers['user-agent'],
      });
      return res.json({ url });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'PUT') {
    if (doc.doc_type !== 'rc_policy') return res.status(400).json({ error: 'La scadenza si imposta solo sulla polizza RC' });
    const { expiry_date } = req.body || {};
    try {
      const updated = await updateProDocument(id, { expiry_date: expiry_date || null });
      return res.json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await removeFile(doc.file_path);
      await deleteProDocumentRow(id);
      await logProDocAccess({
        professional_id: proId, doc_type: doc.doc_type, action: 'delete_pro_doc',
        actor_type: 'pro', actor_id: proId, ip: getClientIp(req), user_agent: req.headers['user-agent'],
      });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).end();
});
