// POST /api/admin/clients/[id]/send-assessments
// Invia campagna assessment email a tutti i dipendenti pending
import { requireAuth } from '../../../../../lib/auth';
import {
  getClientById,
  getPatientsWithEmailByClient,
  getActiveAssessmentByClient,
  insertEmailLog,
  updatePatientAssessmentStatus,
} from '../../../../../lib/store';
import { sendEmail } from '../../../../../lib/email';
import { inviteAssessment } from '../../../../../lib/email-templates';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://eswork-app.vercel.app';

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.query;

  const client = await getClientById(id).catch(() => null);
  if (!client) return res.status(404).json({ error: 'Cliente non trovato' });

  // Trova assessment attivo
  const assessment = await getActiveAssessmentByClient(id).catch(() => null);
  if (!assessment) {
    return res.status(400).json({ error: 'Nessun assessment attivo per questo cliente. Creane uno prima.' });
  }

  const assessmentLink = `${BASE_URL}/q/${assessment.share_code}`;

  // Dipendenti con email e assessment non ancora completato
  const patients = await getPatientsWithEmailByClient(id).catch(() => []);
  const pending = patients.filter(p => !p.assessment_completed_at);

  if (pending.length === 0) {
    return res.json({ sent: 0, failed: 0, message: 'Nessun dipendente pending con email configurata.' });
  }

  let sent = 0, failed = 0;
  const errors = [];

  for (const patient of pending) {
    try {
      const html = inviteAssessment({
        employee_name: `${patient.first_name} ${patient.last_name}`,
        company_name: client.name,
        assessment_link: assessmentLink,
      });

      const result = await sendEmail({
        to: patient.email,
        subject: `${client.name} ti invita al questionario ES Work`,
        html,
      });

      await insertEmailLog({
        patient_id: patient.id,
        client_id: id,
        template: 'invite_assessment',
        to_email: patient.email,
        subject: `${client.name} ti invita al questionario ES Work`,
        status: result.ok ? 'sent' : 'failed',
        error_message: result.ok ? null : result.error,
      }).catch(() => {});

      if (result.ok) {
        sent++;
        await updatePatientAssessmentStatus(patient.id, {
          assessment_invite_sent_at: new Date().toISOString(),
        }).catch(() => {});
      } else {
        failed++;
        errors.push(`${patient.first_name} ${patient.last_name}: ${result.error}`);
      }

      // Rate limit: 100ms tra invii
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      failed++;
      errors.push(`${patient.first_name} ${patient.last_name}: ${e.message}`);
    }
  }

  return res.json({ sent, failed, errors, assessment_link: assessmentLink });
});
