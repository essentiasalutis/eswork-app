import { requireProAuth } from '../../../lib/pro-auth';
import { getAssignmentsByProfessional, getPatientsByClient, getSessionsForClient } from '../../../lib/store';

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const proId = req.proSession.proId;

  const assignments = await getAssignmentsByProfessional(proId);
  const result = await Promise.all(
    assignments.map(async (a) => {
      const patients = await getPatientsByClient(a.client_id);
      const myPatients = patients.filter(() => true); // pro sees all for assigned clients
      return {
        client: a.clients,
        patientCount: myPatients.length,
      };
    })
  );

  return res.json(result);
});
