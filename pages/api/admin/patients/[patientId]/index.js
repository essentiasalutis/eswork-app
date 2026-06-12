import { requireAuth } from '../../../../../lib/auth';
import { getPatientById } from '../../../../../lib/store';
import supabase from '../../../../../lib/db';

// DELETE /api/admin/patients/[patientId] — elimina un paziente/dipendente e
// tutti i suoi dati collegati. Le risposte NMQ (responses) restano: sono
// anonime, non collegate al paziente, e servono agli aggregati dell'assessment.
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: 'patientId mancante' });

  try {
    // Idempotente: NON blocchiamo se la riga paziente è già sparita (es. eliminata
    // lato professionista). In quel caso ripuliamo comunque eventuali figli orfani
    // e rispondiamo ok, così la voce sparisce dalla lista dell'amministratore.
    const patient = await getPatientById(patientId);

    // Figli per patient_id. Quasi tutte le FK sono ON DELETE CASCADE, ma li
    // eliminiamo esplicitamente per coprire anche eventuali orfani e le FK non-cascade.
    const childTables = [
      'sessions',
      'treatment_cycles',
      'mini_checks',
      'pre_validations',
      'self_triggers',
      'waitlist',
      'restratification_alerts',
      'acute_events',
      'checkpoints',
      'patient_documents',
      'reassessments_t12',
      'email_log',
    ];
    for (const table of childTables) {
      // tollerante: la tabella potrebbe non esistere o non avere righe
      await supabase.from(table).delete().eq('patient_id', patientId).then(() => {}, () => {});
    }

    const { error } = await supabase.from('patients').delete().eq('id', patientId);
    if (error) throw error;

    // ok=true sia che il paziente esistesse, sia che fosse già stato rimosso
    return res.json({ ok: true, existed: !!patient });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});
