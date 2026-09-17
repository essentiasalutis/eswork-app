// POST /api/consensi/sessione — conferma della schermata dei consensi (check-up e
// invito). Pubblico: chi compila non è ancora nessuno. Registra SUBITO una riga
// per ciascun consenso, con l'orologio del server e la versione decisa dal server,
// e restituisce l'identificativo della sessione da consegnare insieme al check-up.
//   body: { testo_id, valori: { privacy: true, salute: true }, canale: 'checkup'|'invito' }
import { registraConsensiSessione } from '../../../lib/testi-legali-server';
import { hashIp } from '../../../lib/crypto-utils';
import { getClientIp } from '../../../lib/rate-limit';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const b = req.body || {};
  const canale = b.canale === 'invito' ? 'invito' : 'checkup';
  try {
    const r = await registraConsensiSessione({
      codice: 'informativa_checkup',
      testoId: b.testo_id,
      valori: b.valori || {},
      canale,
      ipHash: hashIp(getClientIp(req)),
      userAgent: (req.headers['user-agent'] || '').slice(0, 200) || null,
    });
    if (!r.ok) {
      const msg = r.errore === 'versione_non_valida'
        ? 'L\'informativa è stata aggiornata: ricarica la pagina e rileggila prima di proseguire.'
        : 'Per proseguire servono entrambi i consensi.';
      return res.status(r.errore === 'versione_non_valida' ? 409 : 400).json({ error: msg, codice: r.errore });
    }
    return res.json({ sessione_id: r.sessione_id, versione: r.versione });
  } catch (e) {
    console.error('[consensi/sessione]', e.message);
    return res.status(500).json({ error: 'Non è stato possibile registrare i consensi: riprova.' });
  }
}
