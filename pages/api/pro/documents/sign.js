// POST /api/pro/documents/sign — URL firmato per caricare un documento del PROPRIO
// profilo (isolamento per proprietà). Il file va dritto allo Storage privato.
import { requireProAuth } from '../../../../lib/pro-auth';
import { createUploadUrl } from '../../../../lib/storage';
import { DOC_TYPES as TYPES } from '../../../../lib/pro-docs';

const MIME_EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const proId = req.proSession.proId;
  const { doc_type, file_name, content_type } = req.body || {};

  if (!TYPES.includes(doc_type)) return res.status(400).json({ error: 'Tipo documento non valido' });
  if (!MIME_EXT[content_type]) return res.status(400).json({ error: 'Sono ammessi solo PDF, JPG o PNG' });

  const extFromName = (file_name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  const ext = ['pdf', 'jpg', 'jpeg', 'png'].includes(extFromName) ? extFromName : MIME_EXT[content_type];
  const path = `${proId}/${doc_type}_${Date.now()}.${ext}`;

  try {
    const data = await createUploadUrl(path); // { signedUrl, token, path }
    return res.json({ path, signed_url: data.signedUrl });
  } catch (e) {
    console.error('[pro-doc sign] error:', e.message);
    return res.status(500).json({ error: 'Impossibile generare il link di upload' });
  }
});
