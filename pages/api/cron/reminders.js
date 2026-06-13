// GET /api/cron/reminders — Vercel Cron: ogni giorno alle 9:00
// Invia reminder assessment a dipendenti non completati a 3gg e 7gg
// vercel.json: { "crons": [{ "path": "/api/cron/reminders", "schedule": "0 7 * * *" }] }

import {
  getPatientsNeedingReminder,
  getClientById,
  getActiveAssessmentByClient,
  insertEmailLog,
} from '../../../lib/store';
import { sendEmail } from '../../../lib/email';
import { reminderAssessment } from '../../../lib/email-templates';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://eswork-app.vercel.app';

export default async function handler(req, res) {
  // Vercel Cron invia Authorization header con Bearer token
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    // Permetti anche chiamate senza auth in dev
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Non autorizzato' });
    }
  }

  let totalSent = 0;
  let totalFailed = 0;

  for (const daysAgo of [3, 7]) {
    try {
      const patients = await getPatientsNeedingReminder(daysAgo);
      for (const patient of patients) {
        try {
          // Consenso revocato → niente trattamenti non obbligatori (promemoria)
          if (patient.consent_withdrawn_at) continue;
          const clientId = patient.client_id;
          const client = await getClientById(clientId).catch(() => null);
          const assessment = await getActiveAssessmentByClient(clientId).catch(() => null);
          if (!client || !assessment) continue;

          const assessmentLink = `${BASE_URL}/q/${assessment.share_code}`;
          const remainingDays = daysAgo === 3 ? 4 : null; // rough estimate

          const html = reminderAssessment({
            employee_name: `${patient.first_name} ${patient.last_name}`,
            company_name: client.name,
            assessment_link: assessmentLink,
            days_remaining: remainingDays,
          });

          const result = await sendEmail({
            to: patient.email,
            subject: `Promemoria: completa il questionario ES Work — ${client.name}`,
            html,
          });

          await insertEmailLog({
            patient_id: patient.id,
            client_id: clientId,
            template: `reminder_assessment_${daysAgo}d`,
            to_email: patient.email,
            subject: `Promemoria ${daysAgo}gg`,
            status: result.ok ? 'sent' : 'failed',
            error_message: result.ok ? null : result.error,
          }).catch(() => {});

          if (result.ok) totalSent++; else totalFailed++;
          await new Promise(r => setTimeout(r, 100));
        } catch (_) { totalFailed++; }
      }
    } catch (e) {
      console.error(`[cron/reminders] Error for ${daysAgo}d:`, e.message);
    }
  }

  return res.json({ ok: true, sent: totalSent, failed: totalFailed, ts: new Date().toISOString() });
}
