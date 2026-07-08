// POST /api/hr/ingresso — canale PUBBLICO (no auth), token-gated. L'HR aggiunge
// un nuovo ingresso (nome + data). SOLA SCRITTURA:
//   - azienda_id risolto SOLO dal token (mai da input);
//   - inserito_da='hr' forzato; rate-limit PER-TOKEN; dedup asincrona lato admin;
//   - NESSUN ritorno della riga; conferma NEUTRA su QUALUNQUE esito diverso dal
//     successo (token invalido/revocato/altra azienda, rate-limit, errore DB o
//     interno) → stesso messaggio generico, MAI un dettaglio tecnico.
// L'INSERT è server-side (service_role): nessun grant anon (la anon key è pubblica).
import { resolveHrToken, hrRateLimitOk, aggiungiDipendente, getOrgParams } from '../../../lib/org';

const NEUTRO_OK = 'Ingresso registrato. Grazie.';
const NEUTRO_ERR = 'Non è stato possibile registrare l\'ingresso, riprova.';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const b = req.body || {};
    const nome = typeof b.nome === 'string' ? b.nome.trim() : '';
    if (!nome || !b.token) return res.status(200).json({ ok: false, message: NEUTRO_ERR });

    const client_id = await resolveHrToken(b.token);
    if (!client_id) return res.status(200).json({ ok: false, message: NEUTRO_ERR }); // invalido/revocato/altra azienda: identico

    const op = await getOrgParams();
    if (!(await hrRateLimitOk(client_id, op.hrMaxPerOra))) return res.status(200).json({ ok: false, message: NEUTRO_ERR });

    // azienda_id dal TOKEN, inserito_da='hr' forzato. Il risultato (riga + eventuale
    // duplicato) è consumato SOLO server-side; all'HR non torna nulla di specifico.
    await aggiungiDipendente(client_id, {
      nome,
      data_ingresso: b.data_ingresso || null,
      identificativo_hr: typeof b.identificativo_hr === 'string' && b.identificativo_hr.trim() ? b.identificativo_hr.trim() : null,
      inserito_da: 'hr',
    });
    return res.status(200).json({ ok: true, message: NEUTRO_OK }); // neutro anche su duplicato
  } catch (_e) {
    // QUALUNQUE errore tecnico → generico, MAI struttura DB/errore.
    return res.status(200).json({ ok: false, message: NEUTRO_ERR });
  }
}
