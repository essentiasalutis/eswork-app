// Copia cartacea del consenso (punto d) — solo l'osteopata assegnato.
//   POST { azione:'prepara', content_type }                      → link per caricare nel transito
//   POST { azione:'accetta', documenti, path, data_firma, motivo, motivo_nota }
//                                                                → verifica e archivia, o rifiuta
//   GET  ?documento=consent_treatment|privacy_extended           → link di 60 s alla copia corrente
// Nessuno stato intermedio: il documento risulta firmato solo dopo «accetta».
import { requireProAuth } from '../../../../../lib/pro-auth';
import { getPatientById, getPatientDocuments, proCanAccessPatientClinical } from '../../../../../lib/store';
import { getClientIp } from '../../../../../lib/rate-limit';
import { preparaCaricamento, accettaCopia, linkCopia } from '../../../../../lib/copia-cartacea-server';
import { MESSAGGI } from '../../../../../lib/copia-cartacea.mjs';
import { vistaDocumentoCartella } from '../../../../../lib/vista';

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

export default requireProAuth(async function handler(req, res) {
  const proId = req.proSession.proId;
  const { patientId } = req.query;
  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });
  if (!(await proCanAccessPatientClinical(proId, patient))) {
    return res.status(403).json({ error: 'Accesso negato: documenti clinici riservati all\'osteopata assegnato.' });
  }
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'];

  try {
    if (req.method === 'GET') {
      const tipo = req.query.documento;
      const doc = (await getPatientDocuments(patientId)).find(d => d.type === tipo && d.modalita === 'carta');
      if (!doc) return res.status(404).json({ error: 'Nessuna copia su carta per questo documento' });
      const url = await linkCopia({ filePath: doc.file_path, patientId, chi: { proId }, ip, userAgent: ua });
      if (!url) return res.status(404).json({ error: 'Copia non disponibile' });
      return res.json({ url });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (b.azione === 'prepara') {
        const r = await preparaCaricamento(patientId, b.content_type);
        if (!r.ok) return res.status(400).json({ errori: [r.errore], error: MESSAGGI[r.errore] });
        return res.json({ path: r.path, signed_url: r.signed_url });
      }
      if (b.azione === 'accetta') {
        const r = await accettaCopia({
          patient, proId,
          documenti: b.documenti, path: b.path,
          dataFirma: b.data_firma, motivo: b.motivo, motivoNota: b.motivo_nota,
          ip, userAgent: ua,
        });
        if (!r.ok) {
          return res.status(400).json({ errori: r.errori, messaggi: r.errori.map(e => MESSAGGI[e] || e), error: r.errori.map(e => MESSAGGI[e] || e).join(' ') });
        }
        // Mai l'immagine della firma autografa verso il browser.
        return res.status(201).json({ documenti: r.documenti.map(vistaDocumentoCartella) });
      }
      return res.status(400).json({ error: 'azione non valida' });
    }

    return res.status(405).end();
  } catch (e) {
    console.error('[carta] errore:', e.message);
    return res.status(500).json({ error: 'Errore del server: la copia non è stata registrata, riprova.' });
  }
});
