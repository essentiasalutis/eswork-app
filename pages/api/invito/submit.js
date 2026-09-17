// POST /api/invito/submit — canale PUBBLICO (no auth). Completa l'assessment del
// neoassunto e crea il paziente clinico, in modo ATOMICO, senza mai ricongiungere
// org↔paziente (vincolo #1).
//
// B4: il token viaggia nel BODY (mai in URL sul POST → non finisce negli access log).
// SELECT-eliminata: NESSUNA lettura DB prima del consumo. L'endpoint calcola solo
//   computeLevel(answers) in JS (logica clinica) e chiama l'RPC; l'UNICO gate è il
//   consumo atomico DENTRO l'RPC. Due submit concorrenti chiamano entrambi l'RPC e
//   perdono/vincono solo sul consumo → un solo paziente.
// B1: il care_token torna nel BODY (mai in URL). B2: client_id risolto server-side
//   nell'RPC. Risposta NEUTRA uniforme (un solo 200) su qualunque esito non-successo.
import crypto from 'crypto';
import supabase from '../../../lib/db';
import { computeLevel } from '../../../lib/scoring';
import { sessioneConsensiValida, collegaSessioneAPaziente } from '../../../lib/testi-legali-server';

const NEUTRO_ERR = 'Non è stato possibile completare la registrazione, riprova.';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: false, message: NEUTRO_ERR });
  try {
    const b = req.body || {};
    const token = typeof b.token === 'string' ? b.token : '';
    const answers = b.answers && typeof b.answers === 'object' ? b.answers : null;
    // Guardia 2 (v64): i consensi sono già registrati dal server, uno per casella,
    // con la versione decisa dal server. Qui si verifica la sessione — completa,
    // recente, non ancora usata. La versione passata all'RPC viene da lì, MAI dal
    // browser. È una lettura prima del consumo, ma sulla sessione dei consensi, non
    // sul token: non dice nulla sulla validità dell'invito (risposta sempre neutra).
    const consensi = await sessioneConsensiValida(b.consensi_sessione_id, 'informativa_checkup').catch(() => null);
    if (!token || token.length < 32 || !answers || !consensi) {
      return res.status(200).json({ ok: false, message: NEUTRO_ERR });
    }
    const informativa_version = consensi[0].versione;

    // Logica clinica in JS (l'RPC persiste il valore pre-calcolato).
    const computed_level = computeLevel(answers);
    const token_hash = crypto.createHash('sha256').update(token).digest('hex');

    // Consumo atomico + crea paziente + flip, tutto in una transazione dentro l'RPC.
    // Ritorna SOLO il care_token (o null se il consumo fallisce). Nessun dipendente_id.
    const { data: care_token, error } = await supabase.rpc('consuma_invito_neoassunto', {
      p_token_hash: token_hash,
      p_computed_level: computed_level,
      p_first_name: typeof b.first_name === 'string' ? b.first_name.trim() : null,
      p_last_name: typeof b.last_name === 'string' ? b.last_name.trim() : null,
      p_email: typeof b.email === 'string' ? b.email.trim() || null : null,
      p_phone: typeof b.phone === 'string' ? b.phone.trim() || null : null,
      p_location: typeof b.location === 'string' ? b.location.trim() || null : null,
      p_wants_contacted: typeof b.wants_to_be_contacted === 'boolean' ? b.wants_to_be_contacted : true,
      p_informativa_version: informativa_version,
    });

    if (error || !care_token) {
      // token invalido/consumato/scaduto/revocato, o errore tecnico → stesso neutro.
      return res.status(200).json({ ok: false, message: NEUTRO_ERR });
    }
    // Collega i consensi registrati al paziente appena creato dall'RPC.
    try {
      const { data: p } = await supabase.from('patients').select('id').eq('care_token', care_token).maybeSingle();
      if (p) await collegaSessioneAPaziente(b.consensi_sessione_id, p.id);
    } catch (e) { console.error('[invito] collega consensi:', e.message); }
    // B1: care_token nel BODY, mai in URL. La pagina lo usa per il link personale.
    return res.status(200).json({ ok: true, care_token });
  } catch (_e) {
    return res.status(200).json({ ok: false, message: NEUTRO_ERR });
  }
}
