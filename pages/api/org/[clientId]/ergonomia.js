// POST /api/org/[clientId]/ergonomia → registra un intervento di ergonomia (solo admin).
//  body { data?, note?, dipendenti: [id] } → sessione 'ergonomia' erogata + una
//  partecipazione per ciascun presente (origine 'intervento').
// Dominio ORGANIZZATIVO: presenza e data, mai osservazioni sulla persona (v59).
import { requireAuth } from '../../../../lib/auth';
import { registraInterventoErgonomia } from '../../../../lib/org';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { clientId } = req.query;
  const b = req.body || {};
  if (!Array.isArray(b.dipendenti) || !b.dipendenti.length) {
    return res.status(400).json({ error: 'Seleziona almeno un dipendente' });
  }
  if (b.data && !/^\d{4}-\d{2}-\d{2}$/.test(b.data)) {
    return res.status(400).json({ error: 'Data non valida' });
  }
  try {
    return res.json(await registraInterventoErgonomia(clientId, {
      data: b.data, note: typeof b.note === 'string' ? b.note.slice(0, 500) : null, dipendentiIds: b.dipendenti,
    }));
  } catch (e) { return res.status(400).json({ error: e.message }); }
});
