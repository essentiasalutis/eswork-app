// POST /api/hr/comunicazioni — canale PUBBLICO, token-gated. L'HR rilegge lo STATO
// delle proprie richieste: categoria, data di invio, stato, eventuale data
// programmata. MAI il testo, MAI identificativi: se il link finisce in mani
// sbagliate non si legge nulla di scritto a mano. Token nel BODY (non in URL):
// così non finisce nei log delle richieste. Muto su token invalido.
import { resolveHrToken, getComunicazioniPubbliche } from '../../../lib/org';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: false });
  try {
    const client_id = await resolveHrToken((req.body || {}).token);
    if (!client_id) return res.status(200).json({ ok: false });
    return res.status(200).json({ ok: true, richieste: await getComunicazioniPubbliche(client_id) });
  } catch (_e) {
    return res.status(200).json({ ok: false });
  }
}
