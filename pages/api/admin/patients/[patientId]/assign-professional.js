import { requireAuth } from '../../../../../lib/auth';
import { getPatientById, getProfessionalById, proCanAccessClient, updatePatient } from '../../../../../lib/store';

// Admin: assegna (o rimuove) il professionista referente di un paziente.
// PUT { professional_id: string | null }
//   - null  → rimuove l'assegnazione (assigned_professional_id = null)
//   - id    → il professionista deve essere assegnato (attivo) all'azienda del paziente
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).end();

  const { patientId } = req.query;
  const { professional_id } = req.body || {};

  try {
    const patient = await getPatientById(patientId);
    if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

    if (professional_id) {
      const pro = await getProfessionalById(professional_id);
      if (!pro) return res.status(404).json({ error: 'Professionista non trovato' });
      const ok = await proCanAccessClient(professional_id, patient.client_id);
      if (!ok) {
        return res.status(400).json({ error: "Il professionista non è assegnato a quest'azienda. Assegnalo prima all'azienda." });
      }
    }

    const updated = await updatePatient(patientId, { assigned_professional_id: professional_id || null });
    return res.json({ ok: true, patient: updated });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
