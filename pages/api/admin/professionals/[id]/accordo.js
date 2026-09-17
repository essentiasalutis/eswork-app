// Accordo sul trattamento dei dati — lato amministratore (punto c).
// L'admin può CARICARE la copia firmata (resta scritto «caricato dall'amministratore»);
// la SPUNTA no: quella la dà solo il professionista, dal suo login.
//   GET  ?file=<id>                          → apre (302) un file dell'accordo, apertura registrata
//   POST { azione:'prepara', content_type }  → link per caricare nel transito
//   POST { azione:'carica', path, testo_id } → verifica e archivia
import { requireAuth } from '../../../../../lib/auth';
import { getProfessionalById } from '../../../../../lib/store';
import { getClientIp } from '../../../../../lib/rate-limit';
import { preparaFileAccordo, accettaFileAccordo, linkFileAccordo } from '../../../../../lib/accordo-server';

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;
  const pro = await getProfessionalById(id).catch(() => null);
  if (!pro) return res.status(404).json({ error: 'Professionista non trovato' });
  const admin = req.session?.email || 'admin';
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'];
  try {
    if (req.method === 'GET' && req.query.file) {
      const url = await linkFileAccordo({ fileId: String(req.query.file), proId: id, chi: { admin }, ip, userAgent: ua });
      return url ? res.redirect(302, url) : res.status(404).json({ error: 'File non trovato' });
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (b.azione === 'prepara') {
        const r = await preparaFileAccordo(id, b.content_type);
        return r.ok ? res.json({ path: r.path, signed_url: r.signed_url }) : res.status(400).json({ error: r.errore });
      }
      if (b.azione === 'carica') {
        const r = await accettaFileAccordo({ proId: id, path: b.path, testoId: b.testo_id, caricatoDa: `admin:${admin}`, ip, userAgent: ua });
        return r.ok ? res.status(201).json({ ok: true }) : res.status(400).json({ error: r.errore });
      }
      if (b.azione === 'sottoscrivi') {
        return res.status(403).json({ error: 'La sottoscrizione dell\'accordo la dà solo il professionista, dal suo accesso.' });
      }
      return res.status(400).json({ error: 'azione non valida' });
    }
    return res.status(405).end();
  } catch (e) {
    console.error('[accordo admin]', e.message);
    return res.status(500).json({ error: 'Errore del server: riprova.' });
  }
});
