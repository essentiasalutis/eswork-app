// Lettera di incarico (binario B) — file FIRMATO nell'archivio privato (stesso bucket e
// stesse regole dei documenti dei professionisti: mai URL pubblici, solo link firmati
// a breve scadenza). Il testo della Lettera è dell'avvocato: qui solo il file firmato.
//   POST { azione: 'link-caricamento', content_type } → { path, signed_url } (solo PDF)
//   POST { azione: 'conferma', path }                  → registra il file, stato "firmata"
//   GET                                                → { url } per aprirla (60 secondi)
import { requireAuth } from '../../../../lib/auth';
import { getClientById, updateClient } from '../../../../lib/store';
import { createUploadUrl, createDownloadUrl, removeFile } from '../../../../lib/storage';
import { oggiRoma } from '../../../../lib/checkup';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;
  const client = await getClientById(id).catch(() => null);
  if (!client) return res.status(404).json({ error: 'Azienda non trovata' });
  const prefisso = `clienti/${id}/`;

  if (req.method === 'GET') {
    if (!client.lettera_file_path) return res.status(404).json({ error: 'Nessuna lettera caricata' });
    try { return res.json({ url: await createDownloadUrl(client.lettera_file_path, 60) }); }
    catch (_) { return res.status(500).json({ error: 'Impossibile aprire il file' }); }
  }

  if (req.method === 'POST') {
    const { azione, content_type, path } = req.body || {};
    if (azione === 'link-caricamento') {
      if (content_type !== 'application/pdf') return res.status(400).json({ error: 'Carica la lettera in PDF' });
      const p = `${prefisso}lettera-incarico_${Date.now()}.pdf`;
      try { const d = await createUploadUrl(p); return res.json({ path: p, signed_url: d.signedUrl }); }
      catch (_) { return res.status(500).json({ error: 'Impossibile preparare il caricamento' }); }
    }
    if (azione === 'conferma') {
      // Il percorso deve essere di QUESTA azienda: nessun file di altri clienti agganciabile.
      if (typeof path !== 'string' || !path.startsWith(prefisso) || path.includes('..')) return res.status(400).json({ error: 'Percorso non valido' });
      const vecchio = client.lettera_file_path;
      try {
        const updated = await updateClient(id, {
          lettera_file_path: path,
          lettera_stato: 'firmata',
          lettera_firmata_il: client.lettera_firmata_il || oggiRoma(),
        });
        if (vecchio && vecchio !== path) await removeFile(vecchio); // ricaricata → niente file orfani
        return res.json(updated);
      } catch (e) {
        if (e && (e.code === 'PGRST204' || e.code === '42703')) return res.status(409).json({ error: 'Serve la migration v53: applicala in Supabase e riprova.' });
        return res.status(500).json({ error: 'Impossibile registrare la lettera' });
      }
    }
    return res.status(400).json({ error: 'Azione non valida' });
  }
  return res.status(405).end();
});
