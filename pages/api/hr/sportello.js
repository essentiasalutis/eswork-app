// GET /api/hr/sportello?token=... — canale PUBBLICO, token-gated, SOLA LETTURA.
// Le giornate dello sportello della propria azienda e i posti: mai chi, mai quanti
// prenotati (Enrico, 28/9). Azienda risolta SOLO dal token, mai esposta; muto sugli errori.
import { resolveHrToken } from '../../../lib/org';
import { giornateAzienda } from '../../../lib/sportello-server';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(200).json({ ok: false });
  try {
    const client_id = await resolveHrToken(req.query.token);
    if (!client_id) return res.status(200).json({ ok: false });
    return res.status(200).json({ ok: true, giornate: await giornateAzienda(client_id) });
  } catch (_e) {
    return res.status(200).json({ ok: false });
  }
}
