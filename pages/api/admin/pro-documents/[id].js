// GET /api/admin/pro-documents/[id] — URL firmato per scaricare un documento (titolare)
// PUT /api/admin/pro-documents/[id] — imposta la scadenza della polizza RC (admin)
import { requireAuth } from '../../../../lib/auth';
import { getProDocumentById, updateProDocument, logProDocAccess } from '../../../../lib/store';
import { createDownloadUrl } from '../../../../lib/storage';
import { getClientIp } from '../../../../lib/rate-limit';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;
  const adminEmail = req.session?.email || 'admin';

  const doc = await getProDocumentById(id);
  if (!doc) return res.status(404).json({ error: 'Documento non trovato' });

  if (req.method === 'GET') {
    try {
      const url = await createDownloadUrl(doc.file_path, 60);
      await logProDocAccess({
        professional_id: doc.professional_id, doc_type: doc.doc_type, action: 'view_pro_doc',
        actor_type: 'admin', actor_id: adminEmail, ip: getClientIp(req), user_agent: req.headers['user-agent'],
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

  return res.status(405).end();
});
