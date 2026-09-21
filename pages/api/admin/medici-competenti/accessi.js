// GET /api/admin/medici-competenti/accessi?medicoId= — registro degli accessi del medico.
import { requireAuth } from '../../../../lib/auth';
import supabase from '../../../../lib/db';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { data } = await supabase.from('mc_accessi').select('id, client_id, azione, dettaglio, esito, creato_il')
    .eq('medico_id', String(req.query.medicoId || '')).order('creato_il', { ascending: false }).limit(300);
  return res.json({ accessi: data || [] });
});
