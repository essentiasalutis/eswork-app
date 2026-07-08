// GET /api/hr/aggregati?token=... — canale PUBBLICO, token-gated. SOLA LETTURA
// AGGREGATA della PROPRIA azienda: solo numeri con k-anonymity (% copertura base,
// N nuovi ingressi in attesa). MAI nomi, MAI dati clinici, MAI una riga individuale.
// Azienda risolta SOLO dal token, mai esposta.
import { resolveHrToken, getAggregatiOrg } from '../../../lib/org';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(200).json({ ok: false });
  try {
    const client_id = await resolveHrToken(req.query.token);
    if (!client_id) return res.status(200).json({ ok: false }); // muto su token invalido
    const aggregati = await getAggregatiOrg(client_id); // aggregatiPubblici: solo numeri + flag soppressione
    return res.status(200).json({ ok: true, aggregati });
  } catch (_e) {
    return res.status(200).json({ ok: false });
  }
}
