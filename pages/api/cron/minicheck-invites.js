// GET /api/cron/minicheck-invites — Vercel Cron: ogni giorno alle 9:00
// Invia inviti mini-check T3 e T6 ai pazienti in scadenza

import {
  getPatientsForMinicheckInvite,
  getClientById,
  insertEmailLog,
} from '../../../lib/store';
import { sendEmail } from '../../../lib/email';
import { minicheckInvite } from '../../../lib/email-templates';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://eswork-app.vercel.app';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Non autorizzato' });
    }
  }

  let totalSent = 0, totalFailed = 0;

  for (const checkpoint of ['t3', 't6']) {
    try {
      const patients = await getPatientsForMinicheckInvite(checkpoint);
      for (const patient of patients) {
        try {
          // Consenso revocato → niente inviti automatici
          if (patient.consent_withdrawn_at) continue;
          const client = patient.clients || await getClientById(patient.client_id).catch(() => null);
          const companyName = client?.name || 'la tua azienda';
          const minicheckLink = `${BASE_URL}/employee/minicheck?token=${patient.care_token}&type=${checkpoint}`;

          const html = minicheckInvite({
            employee_name: `${patient.first_name} ${patient.last_name}`,
            company_name: companyName,
            minicheck_link: minicheckLink,
            checkpoint,
          });

          const result = await sendEmail({
            to: patient.email,
            subject: `Mini-check ${checkpoint.toUpperCase()} — ES Work`,
            html,
          });

          await insertEmailLog({
            patient_id: patient.id,
            client_id: patient.client_id,
            template: `minicheck_invite_${checkpoint}`,
            to_email: patient.email,
            subject: `Mini-check ${checkpoint.toUpperCase()}`,
            status: result.ok ? 'sent' : 'failed',
            error_message: result.ok ? null : result.error,
          }).catch(() => {});

          if (result.ok) totalSent++; else totalFailed++;
          await new Promise(r => setTimeout(r, 100));
        } catch (_) { totalFailed++; }
      }
    } catch (e) {
      console.error(`[cron/minicheck-invites] ${checkpoint}:`, e.message);
    }
  }

  return res.json({ ok: true, sent: totalSent, failed: totalFailed, ts: new Date().toISOString() });
}
