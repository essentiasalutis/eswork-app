// GET  /api/sportello?da=&a=&clientId=  — calendario e monitoraggio (solo Essentia Salutis).
// POST /api/sportello                    — nuova giornata o serie settimanale { ...giornata, ripeti }.
// Stessa funzione per la sezione «Sportello» e per la scheda azienda (lib/sportello-server.js).
import { requireAuth } from '../../../lib/auth';
import { datiSportello, creaGiornate } from '../../../lib/sportello-server';

const GIORNO = /^\d{4}-\d{2}-\d{2}$/;

export default requireAuth(async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { da, a, clientId } = req.query;
      if (!GIORNO.test(String(da || '')) || !GIORNO.test(String(a || ''))) return res.status(400).json({ error: 'Periodo non valido.' });
      return res.json(await datiSportello({ da, a, clientId: clientId || null }));
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      const r = await creaGiornate({
        client_id: b.client_id, professional_id: b.professional_id || null, sede: b.sede, stanza: b.stanza,
        data: b.data, ora_inizio: b.ora_inizio, ora_fine: b.ora_fine, posti: parseInt(b.posti), note_logistiche: b.note_logistiche,
      }, { ripeti: b.ripeti });
      return r.errore ? res.status(422).json({ error: r.errore }) : res.json(r);
    }
    return res.status(405).end();
  } catch (e) {
    // Prima della v80 la tabella non c'è: lo si dice, invece di un errore tecnico.
    if (/sportello_giornate/.test(String(e && e.message))) return res.status(503).json({ error: 'Il calendario dello sportello non è ancora attivo: va applicata la migration v80 in Supabase.', mancaV80: true });
    return res.status(500).json({ error: e.message });
  }
});
