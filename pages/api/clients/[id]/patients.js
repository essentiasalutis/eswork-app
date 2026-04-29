import { requireAuth } from '../../../../lib/auth';
import { getPatientsByClient, getSessionsForClient } from '../../../../lib/store';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const [patients, sessions] = await Promise.all([
        getPatientsByClient(id),
        getSessionsForClient(id),
      ]);

      // Aggrega per paziente: no note cliniche, solo NRS aggregato
      const byPatient = patients.map(p => {
        const ps = sessions.filter(s => s.patient_id === p.id);
        const nrsFirst = ps.find(s => s.nrs_pre !== null)?.nrs_pre ?? null;
        const closedSessions = ps.filter(s => s.closed_at && s.nrs_post !== null);
        const nrsLast = closedSessions.length > 0
          ? closedSessions[closedSessions.length - 1].nrs_post
          : null;
        return {
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          level: p.level,
          session_count: ps.length,
          closed_count: closedSessions.length,
          nrs_first: nrsFirst,
          nrs_last: nrsLast,
        };
      });

      return res.json(byPatient);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
