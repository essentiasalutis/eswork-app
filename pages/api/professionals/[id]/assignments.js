import { requireAuth } from '../../../../lib/auth';
import { getAssignmentsByProfessional, upsertAssignment, getProAssignmentEligibility } from '../../../../lib/store';

export default requireAuth(async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const assignments = await getAssignmentsByProfessional(id);
      return res.json(assignments);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // PUT { client_id, active }
  if (req.method === 'PUT') {
    try {
      const { client_id, active } = req.body;
      if (!client_id) return res.status(400).json({ error: 'client_id obbligatorio' });
      // Gate conformità: si può ASSEGNARE (active) solo un pro conforme. La
      // DISATTIVAZIONE è sempre consentita (anche per rimuovere un pro non conforme).
      if (active !== false) {
        const elig = await getProAssignmentEligibility(id);
        if (elig.blocked) {
          return res.status(409).json({
            error: 'Professionista non assegnabile: documentazione incompleta',
            blocked: true,
            reasons: elig.reasons,
          });
        }
      }
      const result = await upsertAssignment(id, client_id, active !== false);
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
});
