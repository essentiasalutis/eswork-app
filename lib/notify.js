import { sendEmail } from './email';
import { cyclePgicInvite } from './email-templates';
import { indirizzoPerEmail } from './indirizzo-sito.mjs';

// Invia al PAZIENTE il link per il PGIC di fine ciclo (auto-riferito).
export async function sendCyclePgicLink(patient) {
  if (!patient?.email || !patient?.care_token) return { ok: false, reason: 'no_email_or_token' };
  // Indirizzo verificato (lib/indirizzo-sito.mjs): con un valore sbagliato non si
  // spedisce un link rotto, e il motivo dice cosa si è trovato e cosa si aspettava.
  const base = indirizzoPerEmail({ NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL, VERCEL_ENV: process.env.VERCEL_ENV });
  if (!base.ok) { console.error('[pgic]', base.errore); return { ok: false, error: base.errore }; }
  const link = `${base.indirizzo}/employee/cycle-pgic?token=${patient.care_token}`;
  const html = cyclePgicInvite({
    employee_name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
    pgic_link: link,
  });
  return sendEmail({ to: patient.email, subject: 'Valutazione fine ciclo — ES Work', html }).catch(e => ({ ok: false, error: e.message }));
}
