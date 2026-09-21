// GET  /api/mc/[clientId]/indicazioni → elenco reparti/mansioni + le proprie indicazioni
// POST /api/mc/[clientId]/indicazioni { reparto_id, testo } → nuova indicazione
// Il medico INDICA reparti o mansioni: mai persone (lib/medico-competente.mjs).
import { requireMcAzienda } from '../../../../lib/mc-auth';
import { reparti, indicazioniDelMedico, creaIndicazione, registra } from '../../../../lib/medico-competente-server';
import { GUIDA_INDICAZIONE, TESTO_MAX } from '../../../../lib/medico-competente.mjs';

export default requireMcAzienda(async function handler(req, res) {
  const log = (azione, esito, dettaglio) => registra({ medicoId: req.medico.id, clientId: req.clientId, azione, esito, dettaglio, ip: req.headers['x-forwarded-for'] || null, userAgent: req.headers['user-agent'] });
  if (req.method === 'GET') {
    const [elenco, mie] = await Promise.all([reparti(req.clientId), indicazioniDelMedico(req.medico.id, req.clientId)]);
    return res.json({ reparti: elenco.map(r => ({ id: r.id, tipo: r.tipo, nome: r.nome })), mie, guida: GUIDA_INDICAZIONE, testoMax: TESTO_MAX });
  }
  if (req.method === 'POST') {
    const { reparto_id, testo } = req.body || {};
    const r = await creaIndicazione({ medicoId: req.medico.id, clientId: req.clientId, repartoId: reparto_id, testo });
    // Nel registro: il fatto e, se rifiutata, il motivo. Mai il testo scritto.
    await log('indicazione', r.ok ? 'ok' : 'rifiutato', r.ok ? null : r.errore.slice(0, 120));
    if (!r.ok) return res.status(400).json({ error: r.errore });
    return res.json({ ok: true, mie: await indicazioniDelMedico(req.medico.id, req.clientId) });
  }
  return res.status(405).end();
});
