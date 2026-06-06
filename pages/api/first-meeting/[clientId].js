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
      if (Object.keys(clientPatch).length) await updateClient(clientId, clientPatch).catch(() => {});

      return res.status(200).json(meeting);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
