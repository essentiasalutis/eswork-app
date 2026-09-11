// GET /api/clients/[id]/riepilogo — dati per la finestra "Mail di riepilogo" della Stima
// (punto 4+5): referente, riga di contesto dal colloquio, stato del check-up, binario,
// data del secondo incontro, avvisi per l'avvio del check-up. Solo lettura, solo admin.
import { requireAuth } from '../../../../lib/auth';
import { getClientById, getFirstMeeting, getClients } from '../../../../lib/store';
import { statoCheckupCliente } from '../../../../lib/checkup-server';
import { getOrgParams } from '../../../../lib/org';
import { isFirmato, checkupNonConvertiti } from '../../../../lib/pipeline';
import { rigaContesto } from '../../../../lib/riepilogo';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const client = await getClientById(req.query.id).catch(() => null);
  if (!client) return res.status(404).json({ error: 'Azienda non trovata' });
  const [fm, stato, params, tutti] = await Promise.all([
    getFirstMeeting(client.id).catch(() => null),
    statoCheckupCliente(client).catch(() => null),
    getOrgParams(),
    getClients().catch(() => []),
  ]);
  const s1 = (fm && fm.data && fm.data.step1) || {};
  const a = stato && stato.assessment;
  return res.json({
    azienda: client.name,
    referente: { nome: client.contact_name || null, email: client.contact_email || null },
    binario: client.binario || null,
    lettera_stato: client.lettera_stato || null,
    is_demo: !!client.is_demo,
    firmato: isFirmato(client.pipeline_stage),
    contesto: rigaContesto({ n: client.employees || (fm && fm.employees), sector: s1.sector, absenceDays: s1.absence_days != null && s1.absence_days !== '' ? s1.absence_days : fm && fm.absence_days }),
    shareCode: client.assessment_share_code,
    // stato: aperto | chiuso | adesione | non_avviato (lib/checkup.js). Solo "aperto" va nella mail.
    checkup: { stato: (stato && stato.stato) || 'non_avviato', chiude_il: (a && a.chiude_il) || null, attivo: !!(a && a.status === 'active') },
    secondo_incontro_il: client.secondo_incontro_il || null,
    checkupGiorni: params.checkupGiorni,
    checkupAperti: { limite: params.checkupMaxAperti, aziende: checkupNonConvertiti(tutti).filter(c => c.id !== client.id).map(c => ({ id: c.id, name: c.name })) },
  });
});
