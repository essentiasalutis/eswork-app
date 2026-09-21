// /api/admin/medici-competenti/reparti — elenco reparti e mansioni curato dal coordinamento.
import { requireAuth } from '../../../../lib/auth';
import { reparti, creaReparto, disattivaReparto } from '../../../../lib/medico-competente-server';

export default requireAuth(async function handler(req, res) {
  if (req.method === 'GET') return res.json({ reparti: await reparti(String(req.query.clientId || ''), { soloAttivi: false }) });
  if (req.method !== 'POST') return res.status(405).end();
  const b = req.body || {};
  const r = b.azione === 'crea' ? await creaReparto({ clientId: String(b.clientId || ''), tipo: b.tipo, nome: b.nome })
    : b.azione === 'disattiva' ? await disattivaReparto(String(b.id || '')) : { ok: false, errore: 'Azione non valida' };
  return r.ok ? res.json({ ok: true }) : res.status(400).json({ error: r.errore });
});
