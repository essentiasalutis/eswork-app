// GET /api/admin/comunicazioni — tutte le comunicazioni dalle aziende (SOLO admin),
// con il nome dell'azienda e il conteggio dei non letti.
import { requireAuth } from '../../../../lib/auth';
import { getComunicazioniAdmin, contaComunicazioniNonLette } from '../../../../lib/org';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    // ?solo=conteggio → solo il numero dei non letti (badge del menu, leggero).
    if (req.query.solo === 'conteggio') return res.json({ nonLette: await contaComunicazioniNonLette() });
    const [comunicazioni, nonLette] = await Promise.all([getComunicazioniAdmin(), contaComunicazioniNonLette()]);
    return res.json({ comunicazioni, nonLette });
  } catch (e) {
    // Tabella assente (v50 non ancora applicata) → pagina vuota con avviso, non un crash.
    return res.status(200).json({ comunicazioni: [], nonLette: 0, avviso: 'Comunicazioni non disponibili: manca la migration v50.' });
  }
});
