import { sendEmail } from './email';
import { cyclePgicInvite } from './email-templates';

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://eswork-app.vercel.app';

// Invia al PAZIENTE il link per il PGIC di fine ciclo (auto-riferito).
export async function sendCyclePgicLink(patient) {
  if (!patient?.email || !patient?.care_token) return { ok: false, reason: 'no_email_or_token' };
  const link = `${BASE}/employee/cycle-pgic?token=${patient.care_token}`;
  const html = cyclePgicInvite({
    employee_name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
    pgic_link: link,
  });
  return sendEmail({ to: patient.email, subject: 'Valutazione fine ciclo — ES Work', html }).catch(e => ({ ok: false, error: e.message }));
}
