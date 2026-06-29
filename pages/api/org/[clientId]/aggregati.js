// GET /api/org/[clientId]/aggregati → SOLO NUMERI: % popolazione con base completata
// e N nuovi ingressi in attesa. MAI una riga individuale, mai un nome/matricola.
// È l'unico endpoint org pensato per essere, in futuro, esposto lato azienda/HR;
// per ora resta admin (requireAuth). Il calcolo è server-side in lib/org.
import { requireAuth } from '../../../../lib/auth';
import { getAggregatiOrg } from '../../../../lib/org';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const a = await getAggregatiOrg(req.query.clientId);
    // Restituisce ESCLUSIVAMENTE i due numeri aggregati.
    return res.json({ pctBaseCompletata: a.pctBaseCompletata, nNuoviInAttesa: a.nNuoviInAttesa });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});
