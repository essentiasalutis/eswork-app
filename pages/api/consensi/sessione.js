// POST /api/consensi/sessione — conferma della schermata dei consensi (check-up e
// invito). Pubblico: chi compila non è ancora nessuno. Registra SUBITO una riga
// per ciascun consenso, con l'orologio del server e la versione decisa dal server,
// e restituisce l'identificativo della sessione da consegnare insieme al check-up.
//   body: { testo_id, valori: { privacy: true, salute: true }, canale: 'checkup'|'invito' }
import { registraConsensiSessione } from '../../../lib/testi-legali-server';
import { hashIp } from '../../../lib/crypto-utils';
import { getClientIp } from '../../../lib/rate-limit';
import { getClientByAssessmentShareCode } from '../../../lib/store';
import { limiteCheckup, MESSAGGIO_LIMITE } from '../../../lib/limite-checkup';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const b = req.body || {};
  // Azienda del check-up (dal suo codice): decide il SERVER se è la demo permanente,
  // mai il browser. In demo: canale 'checkup_demo' (si cancella all'azzeramento) e
  // nessuna impronta dell'indirizzo né del browser — la fascia dice «anonime» (21/9).
  const client = b.canale !== 'invito' && typeof b.codice === 'string' && b.codice
    ? await getClientByAssessmentShareCode(b.codice).catch(() => null) : null;
  const demo = !!(client && client.demo_permanente);
  const canale = b.canale === 'invito' ? 'invito' : demo ? 'checkup_demo' : 'checkup';
  const limite = limiteCheckup(req, { fase: 'consensi', clientId: client && client.id, demo });
  if (!limite.ok) return res.status(429).json({ error: MESSAGGIO_LIMITE });
  try {
    const r = await registraConsensiSessione({
      codice: 'informativa_checkup',
      testoId: b.testo_id,
      valori: b.valori || {},
      canale,
      ipHash: demo ? null : hashIp(getClientIp(req)),
      userAgent: demo ? null : ((req.headers['user-agent'] || '').slice(0, 200) || null),
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
