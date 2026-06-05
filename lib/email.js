// lib/email.js — Sistema email tramite Resend
// Richiede env: RESEND_API_KEY

// Mittente configurabile via env: deve usare un dominio VERIFICATO su Resend.
// Es. EMAIL_FROM="ES Work <noreply@send.essentiasalutis.it>" se è verificato il sottodominio.
const FROM = process.env.EMAIL_FROM || 'ES Work <noreply@essentiasalutis.it>';
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'info@essentiasalutis.it';

/**
 * Invia una email.
 * @param {object} opts
 * @param {string} opts.to - destinatario
 * @param {string} opts.subject - oggetto
 * @param {string} opts.html - corpo HTML
 * @param {string} [opts.from] - mittente (default noreply@essentiasalutis.it)
 * @returns {Promise<{ok: boolean, id?: string, error?: string}>}
 */
export async function sendEmail({ to, subject, html, from }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY non configurata — email non inviata:', { to, subject });
    return { ok: false, error: 'RESEND_API_KEY non configurata' };
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from: from || FROM,
      reply_to: REPLY_TO,
      to,
      subject,
      html,
    });

    if (result.error) {
      console.error('[email] Resend error:', result.error);
      return { ok: false, error: result.error.message || 'Errore invio' };
    }

    return { ok: true, id: result.data?.id };
  } catch (e) {
    console.error('[email] Exception:', e.message);
    return { ok: false, error: e.message };
  }
}

/**
 * Batch: invia a più destinatari in sequenza con delay per non superare rate limit.
 * @param {Array<{to, subject, html}>} emails
 * @returns {Promise<{sent: number, failed: number, errors: string[]}>}
 */
export async function sendEmailBatch(emails, delayMs = 100) {
  let sent = 0, failed = 0;
  const errors = [];

  for (const email of emails) {
    const result = await sendEmail(email);
    if (result.ok) {
      sent++;
    } else {
      failed++;
      errors.push(`${email.to}: ${result.error}`);
    }
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
  }

  return { sent, failed, errors };
}
