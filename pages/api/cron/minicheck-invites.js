// GET /api/cron/minicheck-invites — Vercel Cron: ogni giorno alle 9:00
// Invia inviti mini-check T3 e T6 ai pazienti in scadenza

import {
  getPatientsForMinicheckInvite,
  getPatientsForRifotografiaInvite,
  getClientById,
  insertEmailLog,
} from '../../../lib/store';
import { sendEmail } from '../../../lib/email';
import { minicheckInvite, rifotografiaInvite } from '../../../lib/email-templates';
import { programmaAttivo } from '../../../lib/attivazione';
import { indirizzoPerEmail } from '../../../lib/indirizzo-sito.mjs';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Non autorizzato' });
    }
  }

  // Indirizzo dei link: se il valore è palesemente sbagliato, oggi non parte nessun
  // invito — meglio nessuna email che email con link rotti — e la risposta del cron
  // (visibile nei log di Vercel) dice quale valore ha trovato e quale si aspettava.
  const base = indirizzoPerEmail({ NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL, VERCEL_ENV: process.env.VERCEL_ENV });
  if (!base.ok) {
    console.error('[cron minicheck]', base.errore);
    return res.status(500).json({ error: base.errore, inviti_bloccati: true });
  }
  const BASE_URL = base.indirizzo;

  let totalSent = 0, totalFailed = 0, totalSaltati = 0;

  // Aziende: servono per sapere se il programma è ATTIVO (lib/attivazione). Prima
  // della firma non parte nessun invito: i check periodici sono parte del percorso,
  // e il percorso non è ancora stato acquistato. Cache per non ripetere la query.
  const cacheAziende = new Map();
  async function azienda(clientId) {
    if (!cacheAziende.has(clientId)) cacheAziende.set(clientId, await getClientById(clientId).catch(() => null));
    return cacheAziende.get(clientId);
  }

  // Solo T3: a sei mesi non si manda il mini-check ai soli pazienti in trattamento,
  // ma la ri-fotografia a tutta la popolazione (Enrico, 12/9).
  for (const checkpoint of ['t3']) {
    try {
      const patients = await getPatientsForMinicheckInvite(checkpoint);
      for (const patient of patients) {
        try {
          // Consenso revocato → niente inviti automatici
          if (patient.consent_withdrawn_at) continue;
          const client = await azienda(patient.client_id);
          // Programma non attivo → nessun invito (la relazione clients(name) della
          // query non porta pipeline_stage: l'azienda va letta intera).
          if (!programmaAttivo(client)) { totalSaltati++; continue; }
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

  // ── Ri-fotografia dei sei mesi: a TUTTA la popolazione che ha fatto il check-up
  // (non ai soli pazienti in trattamento). Aggancio: 180 giorni dalla compilazione.
  let rifotoInviate = 0, rifotoFallite = 0, rifotoSaltate = 0;
  try {
    const daInvitare = await getPatientsForRifotografiaInvite(180);
    for (const patient of daInvitare) {
      try {
        const client = await azienda(patient.client_id);
        if (!programmaAttivo(client)) { rifotoSaltate++; continue; }
        const link = `${BASE_URL}/employee/reassessment?token=${patient.care_token}&type=t6`;
        const html = rifotografiaInvite({
          employee_name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
          company_name: client?.name || 'la tua azienda',
          link,
        });
        const result = await sendEmail({ to: patient.email, subject: 'Check-up a sei mesi — ES Work', html });
        await insertEmailLog({
          patient_id: patient.id, client_id: patient.client_id,
          template: 'rifotografia_invite_t6', to_email: patient.email,
          subject: 'Check-up a sei mesi', status: result.ok ? 'sent' : 'failed',
          error_message: result.ok ? null : result.error,
        }).catch(() => {});
        if (result.ok) rifotoInviate++; else rifotoFallite++;
        await new Promise(r => setTimeout(r, 100));
      } catch (_) { rifotoFallite++; }
    }
  } catch (e) {
    console.error('[cron/minicheck-invites] ri-fotografia t6:', e.message);
  }

  return res.json({
    ok: true,
    minicheck: { sent: totalSent, failed: totalFailed, saltati_programma_non_attivo: totalSaltati },
    rifotografia_t6: { sent: rifotoInviate, failed: rifotoFallite, saltati_programma_non_attivo: rifotoSaltate },
    ts: new Date().toISOString(),
  });
}
