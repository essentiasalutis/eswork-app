import { requireAuth } from '../../../../../lib/auth';
import { getPatientById, getProfessionalById, proCanAccessClient, updatePatient, getProAssignmentEligibility } from '../../../../../lib/store';
import { messaggioNonConforme } from '../../../../../lib/pro-docs';

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
      // Conformità (Enrico, 17/9): nessuna NUOVA presa in carico da un professionista
      // non in regola, per qualunque requisito. Se il paziente è già in carico allo
      // stesso professionista non cambia nulla: la cura prosegue.
      if (patient.assigned_professional_id !== professional_id) {
        const elig = await getProAssignmentEligibility(professional_id);
        if (elig.blocked) return res.status(409).json({ error: messaggioNonConforme(elig.reasons), blocked: true, reasons: elig.reasons });
      }
    }

    const updated = await updatePatient(patientId, { assigned_professional_id: professional_id || null });
    return res.json({ ok: true, patient: updated });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
