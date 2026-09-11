// POST /api/hr/comunicazione — canale PUBBLICO (no auth), token-gated. L'HR scrive
// a Essentia Salutis (categoria + testo breve). SOLA SCRITTURA, stesse garanzie di
// /api/hr/ingresso:
//   - azienda risolta SOLO dal token (mai da input);
//   - rate-limit PER-AZIENDA, fail-closed;
//   - NESSUN ritorno della riga; conferma NEUTRA su qualunque esito diverso dal
//     successo (token invalido/revocato, limite, errore DB) → stesso messaggio.
// Il testo NON torna mai indietro all'HR: vedi lib/comunicazioni.js.
import { resolveHrToken, comunicazioniRateLimitOk, inserisciComunicazione } from '../../../lib/org';
import { validaComunicazione } from '../../../lib/comunicazioni';

const NEUTRO_OK = 'Messaggio inviato. Grazie.';
const NEUTRO_ERR = 'Non è stato possibile inviare il messaggio, riprova.';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const b = req.body || {};
    // Validazione PRIMA di toccare il DB: un input sbagliato non consuma quota.
    if (!b.token || validaComunicazione({ categoria: b.categoria, testo: b.testo })) {
      return res.status(200).json({ ok: false, message: NEUTRO_ERR });
    }
    const client_id = await resolveHrToken(b.token);
    if (!client_id) return res.status(200).json({ ok: false, message: NEUTRO_ERR });
    if (!(await comunicazioniRateLimitOk(client_id))) return res.status(200).json({ ok: false, message: NEUTRO_ERR });
    await inserisciComunicazione(client_id, { categoria: b.categoria, testo: b.testo });
    return res.status(200).json({ ok: true, message: NEUTRO_OK });
  } catch (_e) {
    return res.status(200).json({ ok: false, message: NEUTRO_ERR });
  }
}
