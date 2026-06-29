// GET /api/org/[clientId]/aggregati → SOLO NUMERI: % popolazione con base completata
// e N nuovi ingressi in attesa. MAI una riga individuale, mai un nome/matricola.
// È l'unico endpoint org pensato per essere, in futuro, esposto lato azienda/HR;
// per ora resta admin (requireAuth). Il calcolo è server-side in lib/org.
import { requireAuth } from '../../../../lib/auth';
import { getAggregatiOrg } from '../../../../lib/org';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    // SOLO aggregati con k-anonymity: numeri/flag di soppressione, mai una riga.
    return res.json(await getAggregatiOrg(req.query.clientId));
  } catch (e) { return res.status(500).json({ error: e.message }); }
});
