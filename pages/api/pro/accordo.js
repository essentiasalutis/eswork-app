// Accordo sul trattamento dei dati — area del professionista (punto c).
//   GET                                   → testo in vigore (o null) e stato dell'accordo
//   GET  ?file=<id>                       → link di 60 s a un proprio file firmato
//   POST { azione:'sottoscrivi', testo_id } → la SPUNTA (solo da qui, solo il professionista)
//   POST { azione:'prepara', content_type } → link per caricare la copia firmata nel transito
//   POST { azione:'carica', path, testo_id } → verifica e archivia la copia firmata
import { requireProAuth } from '../../../lib/pro-auth';
import { getClientIp } from '../../../lib/rate-limit';
import { statoPerIlBrowser as perIlBrowser } from '../../../lib/accordo.mjs';
import { statoAccordoPro, testoAccordoInVigore, sottoscriviAccordo, preparaFileAccordo, accettaFileAccordo, linkFileAccordo, versioniAccordo } from '../../../lib/accordo-server';

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

export default requireProAuth(async function handler(req, res) {
  const proId = req.proSession.proId;
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'];
  try {
    if (req.method === 'GET') {
      if (req.query.file) {
        const url = await linkFileAccordo({ fileId: String(req.query.file), proId, chi: { proId }, ip, userAgent: ua });
        return url ? res.json({ url }) : res.status(404).json({ error: 'File non trovato' });
      }
      const [testo, stato, versioni] = await Promise.all([testoAccordoInVigore(), statoAccordoPro(proId), versioniAccordo()]);
      return res.json({ testo, stato: perIlBrowser(stato), versioni });
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (b.azione === 'sottoscrivi') {
        const r = await sottoscriviAccordo({ proId, testoId: b.testo_id, ip, userAgent: ua });
        if (!r.ok) return res.status(409).json({ error: 'La versione dell\'accordo non è più quella in vigore: ricarica la pagina e rileggila prima di sottoscrivere.' });
        return res.json({ ok: true, versione: r.versione, gia: !!r.gia, stato: perIlBrowser(await statoAccordoPro(proId)) });
      }
      if (b.azione === 'prepara') {
        const r = await preparaFileAccordo(proId, b.content_type);
        return r.ok ? res.json({ path: r.path, signed_url: r.signed_url }) : res.status(400).json({ error: r.errore });
      }
      if (b.azione === 'carica') {
        const r = await accettaFileAccordo({ proId, path: b.path, testoId: b.testo_id, caricatoDa: 'professionista', ip, userAgent: ua });
        if (!r.ok) return res.status(400).json({ error: r.errore });
        return res.status(201).json({ ok: true, stato: perIlBrowser(await statoAccordoPro(proId)) });
      }
      return res.status(400).json({ error: 'azione non valida' });
    }
    return res.status(405).end();
  } catch (e) {
    console.error('[accordo pro]', e.message);
    return res.status(500).json({ error: 'Errore del server: riprova.' });
  }
});
