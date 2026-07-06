import { requireAuth } from '../../../lib/auth';
import { getClientById, updateClient, deleteClientById } from '../../../lib/store';
import { getPricingSettingsV2 } from '../../../lib/pricing/settings';
import { validatePacchetto } from '../../../lib/pricing/v2';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  const client = await getClientById(id);
  if (!client) return res.status(404).json({ error: 'Non trovato' });

  if (req.method === 'GET') {
    return res.json(client);
  }

  if (req.method === 'PUT') {
    try {
      const { name, sector, employees, contact_name, contact_email, contact_phone, notes, source } = req.body;
      const updated = await updateClient(id, {
        name: name?.trim(),
        sector: parseInt(sector) || client.sector,
        employees: parseInt(employees) || client.employees,
        contact_name: contact_name?.trim() || null,
        contact_email: contact_email?.trim() || null,
        contact_phone: contact_phone?.trim() || null,
        notes: notes?.trim() || null,
        source: source || client.source,
      });
      return res.json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const body = { ...req.body };
      // pricing_version NON è modificabile via API: si decide alla creazione
      // (esistenti v1, nuove v2). Requisito #1: mai spostare un cliente di versione.
      delete body.pricing_version;

      // Prodotto d'ingresso: REGOLE DURE lato server (la UI può nascondere
      // l'opzione, ma è qui che viene rifiutata).
      if (body.tipo_prodotto != null && !['programma_completo', 'pacchetto_prevenzione'].includes(body.tipo_prodotto)) {
        return res.status(422).json({ error: 'tipo_prodotto non valido' });
      }
      if (body.tipo_prodotto === 'pacchetto_prevenzione' && client.tipo_prodotto !== 'pacchetto_prevenzione') {
        const { params } = await getPricingSettingsV2();
        const check = validatePacchetto({
          employees: body.employees != null ? body.employees : client.employees,
          pricingVersion: client.pricing_version || 'v1',
          v2Params: params,
        });
        if (!check.ok) return res.status(422).json({ error: check.motivo });
        // Durata 12 mesi, NON rinnovabile: scadenza fissata all'attivazione.
        body.stato_ingresso = 'attivo';
        if (!body.data_scadenza_ingresso) {
          const start = client.contract_start_date ? new Date(client.contract_start_date) : new Date();
          start.setMonth(start.getMonth() + 12);
          body.data_scadenza_ingresso = start.toISOString().slice(0, 10);
        }
      }
      // Alla scadenza (o anticipato): upgrade a programma completo.
      if (body.tipo_prodotto === 'programma_completo' && client.tipo_prodotto === 'pacchetto_prevenzione') {
        body.stato_ingresso = 'upgradato';
      }

      const updated = await updateClient(id, body);
      return res.json(updated);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteClientById(id);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
