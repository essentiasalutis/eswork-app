// POST /api/employee/send-link — «Inviamelo per email» dalla schermata finale del
// check-up. Manda alla persona il link della SUA area personale, all'indirizzo che
// ha appena lasciato. Nessun esito, nessun dato clinico nel messaggio.
//
// Sta spento finché l'invio email non è davvero attivo (lib/email.invioEmailAttivo):
// il dominio mittente non è ancora verificato e nessuna email è mai partita. Un
// pulsante che dice «inviato» senza inviare è peggio di un pulsante che non c'è —
// per questo la schermata non lo mostra nemmeno, e qui il rifiuto è esplicito.
import { getPatientByCareToken, getClientById, insertEmailLog } from '../../../lib/store';
import { sendEmail, invioEmailAttivo } from '../../../lib/email';
import { linkAreaPersonale } from '../../../lib/email-templates';
import { limiteAreaPersonale } from '../../../lib/employee-guard';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://eswork-app.vercel.app';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token mancante' });
  if (!limiteAreaPersonale(req, res, token)) return;

  if (!invioEmailAttivo()) {
    return res.status(503).json({ error: 'L\'invio per email non è ancora attivo. Salva il link dalla pagina.', invio_non_attivo: true });
  }

  const patient = await getPatientByCareToken(token).catch(() => null);
  if (!patient) return res.status(404).json({ error: 'Link non valido' });
  // Si spedisce SOLO all'indirizzo già registrato del diretto interessato: il
  // destinatario non arriva mai dalla richiesta.
  if (!patient.email) return res.status(400).json({ error: 'Nessun indirizzo email registrato' });

  const client = await getClientById(patient.client_id).catch(() => null);
  const link = `${BASE_URL}/employee/${patient.care_token}`;
  const html = linkAreaPersonale({
    employee_name: patient.first_name || '',
    company_name: client?.name || '',
    link,
  });

  const result = await sendEmail({ to: patient.email, subject: 'La tua area personale — ES Work', html });

  await insertEmailLog({
    patient_id: patient.id,
    client_id: patient.client_id,
    template: 'link_area_personale',
    to_email: patient.email,
    subject: 'La tua area personale',
    status: result.ok ? 'sent' : 'failed',
    error_message: result.ok ? null : result.error,
  }).catch(() => {});

  if (!result.ok) return res.status(502).json({ error: 'Invio non riuscito: salva il link dalla pagina.' });
  return res.json({ ok: true });
}
