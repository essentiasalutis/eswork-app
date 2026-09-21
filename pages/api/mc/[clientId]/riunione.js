// POST /api/mc/[clientId]/riunione — contributo alla riunione periodica (art. 35).
// Con l'archivio PDF configurato restituisce anche il file; altrimenti l'HTML da stampare.
import { requireMcAzienda } from '../../../../lib/mc-auth';
import { riunioneHtmlPerMedico, registra } from '../../../../lib/medico-competente-server';
import { generateAndStorePdf } from '../../../../lib/pdf';

export const config = { maxDuration: 60 };

export default requireMcAzienda(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const r = await riunioneHtmlPerMedico(req.clientId);
  await registra({ medicoId: req.medico.id, clientId: req.clientId, azione: 'riunione_art35', esito: r.html ? 'ok' : 'rifiutato', dettaglio: r.html ? null : r.motivo, ip: req.headers['x-forwarded-for'] || null, userAgent: req.headers['user-agent'] });
  if (!r.html) return res.status(422).json({ error: 'Documento non disponibile' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.json({ html: r.html, url: null });
  try {
    const { url } = await generateAndStorePdf(r.html, r.nomeFile, 'medico-competente');
    return res.json({ html: r.html, url });
  } catch (e) {
    return res.json({ html: r.html, url: null, errore: 'PDF non generato: usa «Stampa / Salva PDF».' });
  }
});
