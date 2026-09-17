// GET /api/admin/patients/[patientId]/carta?copia=<id> — link di 60 s a una copia
// cartacea (anche una sostituita). L'apertura si registra con l'amministratore.
import { requireAuth } from '../../../../../lib/auth';
import supabase from '../../../../../lib/db';
import { getClientIp } from '../../../../../lib/rate-limit';
import { linkCopia } from '../../../../../lib/copia-cartacea-server';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { patientId, copia } = req.query;
  if (!copia) return res.status(400).json({ error: 'copia mancante' });
  try {
    const { data } = await supabase.from('copie_cartacee').select('file_path, patient_id').eq('id', copia).maybeSingle();
    if (!data || data.patient_id !== patientId) return res.status(404).json({ error: 'Copia non trovata' });
    const url = await linkCopia({ filePath: data.file_path, patientId, chi: { admin: req.session?.email || 'admin' }, ip: getClientIp(req), userAgent: req.headers['user-agent'] });
    if (!url) return res.status(404).json({ error: 'Copia non disponibile' });
    return res.redirect(302, url);
  } catch (e) {
    console.error('[admin carta] errore:', e.message);
    return res.status(500).json({ error: 'Errore del server' });
  }
});
