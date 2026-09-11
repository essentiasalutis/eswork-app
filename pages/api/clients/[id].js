import { requireAuth } from '../../../lib/auth';
import { getClientById, updateClient, deleteClientById } from '../../../lib/store';
import { getPricingSettingsV2 } from '../../../lib/pricing/settings';
import { validatePacchetto } from '../../../lib/pricing/v2';
import { TUTTI, normalizza } from '../../../lib/pipeline';
import { isYmd, oggiRoma, aggiungiGiorni } from '../../../lib/checkup';
import { getOrgParams } from '../../../lib/org';

const V54 = ['ricontatto_il', 'offerta_scade_il'];

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
      delete body.lettera_file_path; // il file della Lettera passa solo da /api/clients/[id]/lettera-incarico

      // Binario commerciale: scelta MANUALE di Enrico (A/B) o non deciso (null).
      if ('binario' in body && body.binario !== null && !['A', 'B'].includes(body.binario)) {
        return res.status(422).json({ error: 'binario non valido (A, B o vuoto)' });
      }
      if ('lettera_stato' in body && body.lettera_stato !== null && !['da_inviare', 'inviata', 'firmata'].includes(body.lettera_stato)) {
        return res.status(422).json({ error: 'stato della Lettera non valido' });
      }
      for (const k of ['lettera_inviata_il', 'lettera_firmata_il']) {
        if (k in body && body[k] !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(body[k]))) return res.status(422).json({ error: 'data non valida' });
      }

      // Pipeline: solo gli stati della fonte unica (lib/pipeline.js).
      if ('pipeline_stage' in body && !TUTTI.some(x => x.id === body.pipeline_stage)) {
        return res.status(422).json({ error: 'stato della pipeline non valido' });
      }
      for (const k of V54) {
        if (k in body && body[k] !== null && !isYmd(String(body[k]))) return res.status(422).json({ error: 'data non valida' });
      }
      const attuale = normalizza(client.pipeline_stage);
      const finale = 'pipeline_stage' in body ? body.pipeline_stage : attuale;
      // "Non ora" esiste solo con la data in cui ricontattare (decisione Enrico).
      if (finale === 'not_now') {
        if ((attuale !== 'not_now' && !body.ricontatto_il) || ('ricontatto_il' in body && !body.ricontatto_il)) {
          return res.status(422).json({ error: 'Per "Non ora" serve la data di ricontatto.' });
        }
        if (body.ricontatto_il && body.ricontatto_il < oggiRoma()) return res.status(422).json({ error: 'La data di ricontatto deve essere oggi o un giorno futuro.' });
      }
      // Offerta aperta: binario A scade dopo i giorni del Listino; B (e non deciso) non
      // scade — può essere un sì in attesa del nuovo budget. Una data esplicita vince.
      if (finale === 'offer_open' && attuale !== 'offer_open' && !('offerta_scade_il' in body)) {
        const binario = 'binario' in body ? body.binario : client.binario;
        body.offerta_scade_il = binario === 'A' ? aggiungiGiorni(oggiRoma(), (await getOrgParams()).offertaGiorniA) : null;
      }

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

      try {
        const updated = await updateClient(id, body);
        return res.json(updated);
      } catch (e) {
        // v54 non ancora applicata: senza la data "Non ora" non si può salvare; per il
        // resto si salva lo stato e si avvisa che la scadenza non è stata registrata.
        if (!(e && (e.code === 'PGRST204' || e.code === '42703')) || !V54.some(k => k in body)) throw e;
        if (finale === 'not_now' || body.ricontatto_il) return res.status(409).json({ error: 'Serve la migration v54 (date di ricontatto e scadenza dell\'offerta): applicala in Supabase e riprova.' });
        const senza = { ...body };
        V54.forEach(k => delete senza[k]);
        const updated = await updateClient(id, senza);
        return res.json({ ...updated, ...(body.offerta_scade_il ? { avviso: 'Scadenza dell\'offerta non salvata: manca la migration v54.' } : {}) });
      }
    } catch (e) {
      if (e && (e.code === 'PGRST204' || e.code === '42703')) return res.status(409).json({ error: 'Serve la migration v53 (binario e Lettera di incarico): applicala in Supabase e riprova.' });
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
