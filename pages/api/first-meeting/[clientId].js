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
      const {
        employees, sector, max_people_training, num_locations,
        absence_days, turnover, remote_work, work_shifts, internal_contact,
        motivation, notes,
      } = req.body;

      const meeting = await upsertFirstMeeting(clientId, {
        employees: parseInt(employees) || null,
        sector: parseInt(sector) || null,
        max_people_training: parseInt(max_people_training) || null,
        num_locations: parseInt(num_locations) || null,
        absence_days: parseInt(absence_days) || null,
        turnover: parseInt(turnover) || null,
        remote_work: remote_work?.trim() || null,
        work_shifts: work_shifts?.trim() || null,
        internal_contact: internal_contact?.trim() || null,
        motivation: motivation?.trim() || null,
        notes: notes?.trim() || null,
      });

      // Aggiorna i dati base del cliente dalla sezione A
      if (employees) await updateClient(clientId, {
        employees: parseInt(employees),
        ...(sector ? { sector: parseInt(sector) } : {}),
      });

      return res.status(200).json(meeting);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
