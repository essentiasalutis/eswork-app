import { requireProAuth } from '../../../../../lib/pro-auth';
import {
  getAssignmentsByProfessional,
  getPatientsByClient,
  insertPatient,
  generateId,
} from '../../../../../lib/store';

export default requireProAuth(async function handler(req, res) {
  const { clientId } = req.query;
  const proId = req.proSession.proId;

  // Verifica che il professionista sia assegnato a questa azienda
  const assignments = await getAssignmentsByProfessional(proId);
  const allowed = assignments.some(a => a.client_id === clientId);
  if (!allowed) return res.status(403).json({ error: 'Accesso negato' });

  if (req.method === 'GET') {
    const patients = await getPatientsByClient(clientId);
    return res.json(patients);
  }

  if (req.method === 'POST') {
    try {
      const { first_name, last_name, ...rest } = req.body;
      if (!first_name?.trim() || !last_name?.trim()) {
        return res.status(400).json({ error: 'Nome e cognome obbligatori' });
      }
      const patient = await insertPatient({
        id: generateId('pat'),
        client_id: clientId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        ...rest,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return res.status(201).json(patient);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
