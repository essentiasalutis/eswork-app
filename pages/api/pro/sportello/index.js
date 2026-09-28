// GET   /api/pro/sportello          — le giornate e gli allarmi dell'osteopata collegato.
// PATCH /api/pro/sportello?id=...   — { sedute, ergonomia }: quanti posti ha prenotato.
//   Solo numeri, mai nomi (Enrico, 28/9); solo sulle giornate a lui assegnate.
import { requireProAuth } from '../../../../lib/pro-auth';
import { datiSportelloOsteopata, segnaPrenotazioni } from '../../../../lib/sportello-server';

export default requireProAuth(async function handler(req, res) {
  const proId = req.proSession.proId;
  try {
    if (req.method === 'GET') return res.json(await datiSportelloOsteopata(proId));
    if (req.method === 'PATCH') {
      const r = await segnaPrenotazioni(String(req.query.id || ''), req.body || {}, { proId });
      return r.errore ? res.status(422).json({ error: r.errore }) : res.json(r);
    }
    return res.status(405).end();
  } catch (e) {
    // Prima della v80 la tabella non c'è: lo si dice, invece di un errore tecnico.
    if (/sportello_giornate/.test(String(e && e.message))) return res.status(503).json({ error: 'Il calendario dello sportello non è ancora attivo: va applicata la migration v80 in Supabase.', mancaV80: true });
    return res.status(500).json({ error: e.message });
  }
});
