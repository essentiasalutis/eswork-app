// PATCH /api/sportello/[id] — Essentia Salutis modifica una giornata: orari, posti,
// osteopata, luogo, prenotazioni, oppure la annulla / la ripristina (stato).
import { requireAuth } from '../../../lib/auth';
import { modificaGiornata } from '../../../lib/sportello-server';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end();
  try {
    const r = await modificaGiornata(req.query.id, req.body || {});
    return r.errore ? res.status(422).json({ error: r.errore }) : res.json(r);
  } catch (e) {
    // Prima della v80 la tabella non c'è: lo si dice, invece di un errore tecnico.
    if (/sportello_giornate/.test(String(e && e.message))) return res.status(503).json({ error: 'Il calendario dello sportello non è ancora attivo: va applicata la migration v80 in Supabase.', mancaV80: true });
    return res.status(500).json({ error: e.message });
  }
});
