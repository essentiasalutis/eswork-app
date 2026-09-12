import { requireProAuth } from '../../../../../lib/pro-auth';
import { vistaPazienteLista } from '../../../../../lib/vista';
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
    // Livello B: l'essere assegnati all'AZIENDA non dà la cartella dei suoi dipendenti.
    // Escono solo i propri pazienti, e solo i campi dell'elenco: mai anamnesi, mai note,
    // mai il care_token (che è la chiave dell'area personale del dipendente).
    const patients = await getPatientsByClient(clientId);
    const miei = (patients || []).filter(p => p.assigned_professional_id === proId);
    return res.json(miei.map(vistaPazienteLista));
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
      return res.status(201).json(vistaPazienteLista(patient));
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
