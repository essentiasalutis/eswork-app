import { requireAuth } from '../../../lib/auth';
import { getFirstMeeting, upsertFirstMeeting, updateClient } from '../../../lib/store';

export default requireAuth(async function handler(req, res) {
  const { clientId } = req.query;

  if (req.method === 'GET') {
    const data = await getFirstMeeting(clientId);
    return res.json(data || {});
  }

  if (req.method === 'POST') {
    try {
      // Scheda colloquio: blob ricco in `data` + scalari che alimentano il calcolatore
      const { data, employees, sector, absence_days, num_locations } = req.body || {};

      const fields = { data: data || {} };
      if (employees != null) fields.employees = parseInt(employees) || null;
      if (sector != null) fields.sector = parseInt(sector) || null;
      if (absence_days != null) fields.absence_days = parseInt(absence_days) || null;
      if (num_locations != null) fields.num_locations = parseInt(num_locations) || null;

      const meeting = await upsertFirstMeeting(clientId, fields);

      // Allinea i dati base del cliente (dimensione/settore/tier) per dashboard e calcolatore
      const clientPatch = {};
      if (employees != null && parseInt(employees)) clientPatch.employees = parseInt(employees);
      if (sector != null && parseInt(sector)) clientPatch.sector = parseInt(sector);
      if (data?.step2?.tier) clientPatch.tier = data.step2.tier;
      // Nome e referente: l'azienda può nascere PRIMA che si arrivi al decisore (intake
      // telefonico: si crea appena ci sono nome e dipendenti) o essere corretta dopo. Senza
      // questo allineamento la scheda restava senza referente e la mail della Stima
      // partiva "Gentile referente", senza destinatario. Solo campi compilati: un campo
      // vuoto nel colloquio non cancella un contatto che l'azienda ha già.
      const testo = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
      const s1 = data?.step1 || {};
      if (testo(s1.nome)) clientPatch.name = testo(s1.nome);
      if (testo(s1.ref_nome)) clientPatch.contact_name = testo(s1.ref_nome);
      if (testo(s1.ref_email)) clientPatch.contact_email = testo(s1.ref_email);
      if (testo(s1.ref_tel)) clientPatch.contact_phone = testo(s1.ref_tel);
      // Binario: decisione manuale di Enrico nel colloquio (anche "non deciso" = null).
      if ('binario' in s1) clientPatch.binario = s1.binario === 'A' || s1.binario === 'B' ? s1.binario : null;
      if (Object.keys(clientPatch).length) {
        // Senza v53 la colonna binario non esiste: si riprova senza, gli altri campi si allineano comunque.
        await updateClient(clientId, clientPatch).catch(async (e) => {
          if (e && (e.code === 'PGRST204' || e.code === '42703') && 'binario' in clientPatch) {
            const { binario, ...resto } = clientPatch;
            if (Object.keys(resto).length) await updateClient(clientId, resto).catch(() => {});
          }
        });
      }

      return res.status(200).json(meeting);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
