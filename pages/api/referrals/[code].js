import { getReferralCodeByCode, insertReferralUse, buildVoucherCode, getAssignmentsByClient } from '../../../lib/store';
import { getClientIp } from '../../../lib/rate-limit';
import { sendEmail } from '../../../lib/email';

export default async function handler(req, res) {
  const { code } = req.query;

  // GET — valida codice e restituisce info per la pagina pubblica
  if (req.method === 'GET') {
    const referral = await getReferralCodeByCode(code);
    if (!referral) return res.status(404).json({ error: 'Codice non valido o scaduto' });

    // Verifica scadenza
    if (referral.expires_at && new Date(referral.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Codice scaduto' });
    }

    // Verifica max_uses (es. F code: usabile 1 volta)
    const usesCount = referral.referral_uses?.length || 0;
    if (referral.max_uses !== null && usesCount >= referral.max_uses) {
      return res.status(410).json({ error: 'Codice già utilizzato' });
    }

    return res.json({
      code: referral.code,
      type: referral.type || 'P',
      clientName: referral.clients?.name || '',
      expiresAt: referral.expires_at,
      valid: true,
    });
  }

  // POST — registra un utilizzo
  if (req.method === 'POST') {
    const referral = await getReferralCodeByCode(code);
    if (!referral) return res.status(404).json({ error: 'Codice non valido o scaduto' });

    if (referral.expires_at && new Date(referral.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Codice scaduto' });
    }

    const usesCount = referral.referral_uses?.length || 0;
    if (referral.max_uses !== null && usesCount >= referral.max_uses) {
      return res.status(410).json({ error: 'Codice già utilizzato al massimo consentito' });
    }

    const { patient_name, patient_phone, patient_email, preferred_when } = req.body || {};
    const ip = getClientIp(req);
    const voucher_code = buildVoucherCode();
    const clean = v => (typeof v === 'string' ? v.trim() : '') || null;

    try {
      // Insert completo (Fase 2 — richiede v26 + v27)
      await insertReferralUse({
        referral_code_id: referral.id,
        patient_name: clean(patient_name),
        patient_phone: clean(patient_phone),
        patient_email: clean(patient_email),
        preferred_when: clean(preferred_when),
        ip,
        voucher_code,
        status: 'requested',
      });
    } catch (e) {
      // Fallback se le migration non sono ancora applicate: /care non si rompe.
      await insertReferralUse({
        referral_code_id: referral.id,
        patient_name: clean(patient_name),
        ip,
      }).catch(() => {});
    }

    // Notifica i professionisti assegnati all'azienda (best-effort, non blocca)
    (async () => {
      try {
        const assignments = await getAssignmentsByClient(referral.client_id);
        const emails = (assignments || [])
          .filter(a => a.active && a.professionals?.email)
          .map(a => a.professionals.email);
        const companyName = referral.clients?.name || 'azienda';
        for (const to of emails) {
          await sendEmail({
            to,
            subject: `Nuovo lead Referral B2C — ${companyName}`,
            html: `<p>Nuovo lead dal programma ES Work (${companyName}).</p>
              <ul>
                <li><strong>Nome:</strong> ${clean(patient_name) || '—'}</li>
                <li><strong>Telefono:</strong> ${clean(patient_phone) || '—'}</li>
                <li><strong>Email:</strong> ${clean(patient_email) || '—'}</li>
                <li><strong>Disponibilità:</strong> ${clean(preferred_when) || '—'}</li>
                <li><strong>Buono visita:</strong> ${voucher_code}</li>
              </ul>
              <p>Trovi il lead nella tua area professionista (Lead B2C in attesa).</p>`,
          }).catch(() => {});
        }
      } catch (_) {}
    })();

    return res.json({ ok: true, voucher_code });
  }

  res.status(405).end();
}
