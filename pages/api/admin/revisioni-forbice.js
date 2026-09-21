// GET /api/admin/revisioni-forbice — avvisi di revisione dei parametri della forbice
// (v75, SOLO admin): aziende in cui il massimo promesso ha portato il margine
// dell'Anno 1 sotto la soglia del Listino. Sola lettura: l'avviso non si modifica.
import { requireAuth } from '../../../lib/auth';
import supabase from '../../../lib/db';

const tabellaMancante = e => /relation .* does not exist|Could not find the table/i.test((e && e.message) || '');

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { data, error } = await supabase.from('forbice_revisioni')
    .select('id, client_id, settore, dipendenti, calcolato, massimo, costo, margine_pct, soglia_pct, fonte, creato_il')
    .order('creato_il', { ascending: false }).limit(200);
  if (error) return tabellaMancante(error) ? res.json({ righe: [], mancante: 'v75' }) : res.status(500).json({ error: error.message });
  const ids = [...new Set((data || []).map(r => r.client_id))];
  const { data: aziende } = ids.length ? await supabase.from('clients').select('id, name, is_demo').in('id', ids) : { data: [] };
  const perId = new Map((aziende || []).map(c => [c.id, c]));
  return res.json({ righe: (data || []).map(r => ({ ...r, azienda: perId.get(r.client_id)?.name || null, demo: !!perId.get(r.client_id)?.is_demo })) });
});
