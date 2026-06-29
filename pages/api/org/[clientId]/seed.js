// POST /api/org/[clientId]/seed → "Importa nomi dall'assessment" (solo admin).
// Copia CIECA e una tantum dei soli nomi (first+last) in org_dipendente: nessun
// patient_id/assessment_id, nessun FK clinico, matching dedup solo in memoria.
import { requireAuth } from '../../../../lib/auth';
import { seedDipendentiDaAssessment } from '../../../../lib/org';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try { return res.json(await seedDipendentiDaAssessment(req.query.clientId)); }
  catch (e) { return res.status(500).json({ error: e.message }); }
});
