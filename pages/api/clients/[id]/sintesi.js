// POST /api/clients/[id]/sintesi — PDF della Sintesi del Report di Attivazione (punto 7).
// Stessi dati della pagina (datiPresentazione → buildSintesiHtml). Solo admin.
import { requireAuth } from '../../../../lib/auth';
import { datiPresentazione } from '../../../../lib/presentazione-server';
import { buildSintesiHtml } from '../../../../lib/sintesi';
import { generateAndStorePdf } from '../../../../lib/pdf';

export const config = { maxDuration: 60 };

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const d = await datiPresentazione(req.query.id).catch(e => ({ errore: e.message }));
  if (d.errore) return res.status(422).json({ error: d.errore });
  const html = buildSintesiHtml(d);
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.json({ html, url: null, message: 'Archivio PDF non configurato: usa «Stampa / Salva PDF».' });
  try {
    const { url } = await generateAndStorePdf(html, `sintesi_${req.query.id}_${Date.now()}.pdf`, 'reports');
    return res.json({ html, url });
  } catch (e) {
    return res.json({ html, url: null, error: `PDF non generato: ${e.message}` });
  }
});
