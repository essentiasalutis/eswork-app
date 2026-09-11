// POST /api/clients/[id]/offerta — validità dell'offerta (punto 8 del funnel)
//   { azione: 'inviata', scade_il }  → "Invia offerta via email": Offerta aperta (solo in
//                                      avanti) con la scadenza scelta (null = senza scadenza)
//   { azione: 'sollecitata' }        → promemoria a metà validità fatto (dashboard)
import { requireAuth } from '../../../../lib/auth';
import { isYmd, oggiRoma } from '../../../../lib/checkup';
import { registraOffertaInviata, aggiornaClienteTollerante } from '../../../../lib/pipeline-server';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id } = req.query;
  const b = req.body || {};
  try {
    if (b.azione === 'inviata') {
      const scade = b.scade_il || null;
      if (scade !== null && (!isYmd(String(scade)) || scade < oggiRoma())) {
        return res.status(422).json({ error: 'La scadenza dell\'offerta deve essere oggi o un giorno futuro.' });
      }
      const r = await registraOffertaInviata(id, scade);
      if (!r.trovata) return res.status(404).json({ error: 'Azienda non trovata' });
      return res.json(r);
    }
    if (b.azione === 'sollecitata') {
      const { v55Mancante } = await aggiornaClienteTollerante(id, { offerta_sollecito_at: new Date().toISOString() });
      if (v55Mancante) return res.status(409).json({ error: 'Serve la migration v55 (promemoria dell\'offerta): applicala in Supabase e riprova.' });
      return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'azione non valida' });
  } catch (e) {
    if (e && e.code === 'PGRST116') return res.status(404).json({ error: 'Azienda non trovata' });
    return res.status(500).json({ error: e.message });
  }
});
