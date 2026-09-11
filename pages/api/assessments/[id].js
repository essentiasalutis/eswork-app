import { requireAuth } from '../../../lib/auth';
import {
  getAssessmentById,
  getResponsesByAssessment,
  deleteAssessmentById,
} from '../../../lib/store';
import { reportAttivazioneDopo, getCheckupCorrente, scriviAssessmentTollerante, contaRisposte } from '../../../lib/checkup-server';
import { isYmd, oggiRoma, fineGiornataRoma } from '../../../lib/checkup';

const MIGRATION = 'Serve la migration v51 (scadenza e solleciti del check-up): applicala in Supabase e riprova.';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  const assessment = await getAssessmentById(id);
  if (!assessment) return res.status(404).json({ error: 'Non trovato' });

  if (req.method === 'GET') {
    // ?solo=conteggio → solo il numero di questionari (aggiornamento del tasso di risposta)
    if (req.query.solo === 'conteggio') return res.json({ risposte: await contaRisposte(id) });
    const responses = await getResponsesByAssessment(id);
    return res.json({ ...assessment, responses });
  }

  if (req.method === 'PATCH') {
    try {
      const { status, chiude_il, sollecito } = req.body || {};
      const now = new Date().toISOString();

      // ── Sollecito al referente fatto → il promemoria sparisce ──
      if (sollecito === 'meta' || sollecito === 'finale') {
        const campo = sollecito === 'meta' ? 'sollecito_meta_at' : 'sollecito_finale_at';
        const { data, v51Mancante } = await scriviAssessmentTollerante('update', { [campo]: now }, id);
        if (v51Mancante) return res.status(409).json({ error: MIGRATION });
        return res.json(data);
      }

      // ── Chiusura a mano: si registra l'ORA (serve alla grazia di 30 minuti) ──
      if (status === 'closed') {
        const { data } = await scriviAssessmentTollerante('update', { status: 'closed', chiuso_at: now }, id);
        return res.json(data);
      }

      // Da qui: riapertura e proroga. Dopo il Report di Attivazione di QUESTO
      // check-up l'analisi è congelata: il Report è stato scritto su quei numeri.
      if (status === 'active' || chiude_il !== undefined) {
        if (await reportAttivazioneDopo(assessment.client_id, assessment.created_at)) {
          return res.status(409).json({ error: 'Il Report di Attivazione è già stato generato su questo check-up: l\'analisi è congelata e il check-up non si riapre né si proroga.' });
        }
        if (chiude_il !== undefined && (!isYmd(chiude_il) || chiude_il < oggiRoma())) {
          return res.status(422).json({ error: 'La data di chiusura deve essere oggi o un giorno futuro.' });
        }
        const fields = {};
        if (chiude_il !== undefined) fields.chiude_il = chiude_il;
        if (status === 'active') {
          const corrente = await getCheckupCorrente(assessment.client_id);
          if (corrente && corrente.id !== id && corrente.status === 'active') {
            return res.status(409).json({ error: 'C\'è già un altro check-up aperto per questa azienda.' });
          }
          // Riaprire con una scadenza già passata lo richiuderebbe all'istante: serve una data nuova.
          const scadenza = fields.chiude_il || assessment.chiude_il;
          if (isYmd(scadenza) && fineGiornataRoma(scadenza) < new Date()) {
            return res.status(422).json({ error: 'La data di chiusura è già passata: indica fino a quando riaprire.' });
          }
          fields.status = 'active';
          fields.chiuso_at = null;
        }
        const { data, v51Mancante } = await scriviAssessmentTollerante('update', fields, id);
        // Senza v51: una proroga pura non scrive nulla (409); una riapertura avviene
        // comunque, ma senza scadenza — lo si dice invece di rispondere "errore".
        if (v51Mancante && !data) return res.status(409).json({ error: MIGRATION });
        if (v51Mancante && chiude_il !== undefined) return res.json({ ...data, avviso: 'Riaperto, ma senza data di chiusura: manca la migration v51.' });
        return res.json(data);
      }

      return res.status(400).json({ error: 'Nessuna modifica richiesta' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteAssessmentById(id);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
