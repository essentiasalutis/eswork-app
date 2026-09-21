// GET/POST /api/admin/demo-permanente — azienda demo per i convegni (v78). Solo admin.
//   GET  → stato: azienda, risposte del check-up in corso, report
//   POST { azione: 'aggiorna', nome, dipendenti, settore }
//        { azione: 'prezzo', mostra }
//        { azione: 'azzera', conferma }   (conferma = nome dell'azienda per intero)
import { requireAuth } from '../../../lib/auth';
import { getDemo, aggiornaDemo, impostaPrezzo, azzeraDemo } from '../../../lib/demo-permanente-server';

export default requireAuth(async function handler(req, res) {
  if (req.method === 'GET') {
    const d = await getDemo();
    return d.errore ? res.status(409).json({ error: d.errore }) : res.json(d);
  }
  if (req.method !== 'POST') return res.status(405).end();
  const b = req.body || {};
  const r = b.azione === 'aggiorna' ? await aggiornaDemo(b)
    : b.azione === 'prezzo' ? await impostaPrezzo(b.mostra)
    : b.azione === 'azzera' ? await azzeraDemo(b)
    : { ok: false, status: 400, errore: 'azione non valida' };
  return r.ok ? res.json(r) : res.status(r.status || 500).json({ error: r.errore });
});
