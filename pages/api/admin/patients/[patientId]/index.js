import { requireAuth } from '../../../../../lib/auth';
import { getPatientById } from '../../../../../lib/store';
import supabase from '../../../../../lib/db';

// DELETE /api/admin/patients/[patientId] — elimina un paziente/dipendente e
// tutti i suoi dati collegati. Le risposte NMQ (responses) restano: sono
// anonime, non collegate al paziente, e servono agli aggregati dell'assessment.
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const { patientId } = req.query;

  try {
    const patient = await getPatientById(patientId);
    if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

    // Figli espliciti (alcune FK non sono ON DELETE CASCADE)
    const childTables = [
      'sessions',
      'treatment_cycles',
      'mini_checks',
      'pre_validations',
      'self_triggers',
      'waitlist',
      'restratification_alerts',
      'acute_events',
      'patient_documents',
      'reassessments_t12',
    ];
    for (const table of childTables) {
      // tollerante: la tabella potrebbe non esistere o non avere righe
      await supabase.from(table).delete().eq('patient_id', patientId).then(() => {}, () => {});
    }

    const { error } = await supabase.from('patients').delete().eq('id', patientId);
    if (error) throw error;

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
