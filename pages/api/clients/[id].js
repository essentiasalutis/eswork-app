import { requireAuth } from '../../../lib/auth';
import { getClientById, updateClient, deleteClientById } from '../../../lib/store';
import { getPricingSettingsV2 } from '../../../lib/pricing/settings';
import { validatePacchetto } from '../../../lib/pricing/v2';
import { TUTTI, normalizza } from '../../../lib/pipeline';
import { isYmd, oggiRoma, aggiungiGiorni } from '../../../lib/checkup';
import { getOrgParams } from '../../../lib/org';
import { aggiornaClienteTollerante } from '../../../lib/pipeline-server';
import { giornoIt } from '../../../lib/date-it.mjs';

const V54 = ['ricontatto_il', 'offerta_scade_il'];
const DATE_SEMPLICI = [...V54, 'secondo_incontro_il', 'data_avvio_programma'];

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
      // Il binario A/B è uscito dall'interfaccia il 13/9 (funnel unico) e non viene più
      // scritto. La guardia resta: se qualcosa provasse a scrivere un valore, va rifiutato.
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
      for (const k of DATE_SEMPLICI) {
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
      // Offerta aperta: la scadenza si PROPONE sempre (giorni dal Listino) e si può
      // cancellare. Un'offerta senza data muore in silenzio, e il «ci risentiamo» senza
      // scadenza è il modo più comune di perdere un cliente (Enrico, 13/9).
      // Una data esplicita nel body vince sempre, anche se vuota.
      if (finale === 'offer_open' && attuale !== 'offer_open') {
        if (!('offerta_scade_il' in body)) {
          body.offerta_scade_il = aggiungiGiorni(oggiRoma(), (await getOrgParams()).offertaGiorni);
        }
        // Da qui si conta la metà validità per il promemoria (v55).
        body.offerta_aperta_il = oggiRoma();
        body.offerta_sollecito_at = null;
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
          // Dal giorno di inizio contratto, o da OGGI in Italia (non il giorno UTC).
          const start = new Date(`${client.contract_start_date || giornoIt()}T12:00:00Z`);
          start.setUTCMonth(start.getUTCMonth() + 12);
          body.data_scadenza_ingresso = start.toISOString().slice(0, 10);
        }
      }
      // Alla scadenza (o anticipato): upgrade a programma completo.
      if (body.tipo_prodotto === 'programma_completo' && client.tipo_prodotto === 'pacchetto_prevenzione') {
        body.stato_ingresso = 'upgradato';
      }

      // Senza v55 si salva tutto il resto (il promemoria a metà validità parte dopo).
      const { data: updated } = await aggiornaClienteTollerante(id, body);
      return res.json(updated);
    } catch (e) {
      if (e && (e.code === 'PGRST204' || e.code === '42703')) return res.status(409).json({ error: 'Nel database manca una migration non ancora applicata: applicala in Supabase e riprova.' });
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      // Cancellare un'azienda cancella i suoi pazienti: stesso vincolo di
      // conservazione della cancellazione del singolo paziente (Enrico, 17/9).
      const { vincoloConservazioneAzienda } = await import('../../../lib/conservazione-server');
      const vincolo = await vincoloConservazioneAzienda(id);
      if (vincolo.bloccato) return res.status(409).json({ codice: 'conservazione', error: vincolo.messaggio, fino_al: vincolo.finoAl, pazienti: vincolo.pazienti });
      await deleteClientById(id);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
