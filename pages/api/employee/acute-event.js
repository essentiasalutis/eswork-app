import {
  getPatientByCareToken,
  createAcuteEvent,
  countAcuteEventsThisYear,
  generateId,
  getClientById,
} from '../../../lib/store';
import { sendEmail } from '../../../lib/email';
import { acuteEventOsteopath } from '../../../lib/email-templates';
import supabase from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token, description, pain_zone, nrs } = req.body;
  if (!token) return res.status(400).json({ error: 'Token mancante' });

  const patient = await getPatientByCareToken(token).catch(() => null);
  if (!patient) return res.status(404).json({ error: 'Link non valido' });

  // Anti-abuso: max 2 eventi acuti all'anno
  const count = await countAcuteEventsThisYear(patient.id).catch(() => 0);
  if (count >= 2) {
    return res.status(429).json({
      error: 'Hai già segnalato 2 eventi acuti quest\'anno. Contatta direttamente il coordinatore a info@essentiasalutis.it',
    });
  }

  const escalation_deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await createAcuteEvent({
    id: generateId('ae'),
    patient_id: patient.id,
    client_id: patient.client_id,
    pain_zone,
    nrs: nrs ? parseInt(nrs, 10) : null,
    description,
    status: 'pending',
    escalation_deadline,
    reported_at: new Date().toISOString(),
  });

  // Notifica osteopata assegnato al cliente
  notifyOsteopath(patient, description, pain_zone, nrs, escalation_deadline).catch(() => {});

  return res.json({ ok: true });
}

async function notifyOsteopath(patient, description, pain_zone, nrs, escalation_deadline) {
  try {
    // Trova professionista assegnato al cliente
    const { data: assignments } = await supabase
      .from('professional_assignments')
      .select('professionals(id, name, email)')
      .eq('client_id', patient.client_id)
      .eq('active', true)
      .limit(1);

    const professional = assignments?.[0]?.professionals;
    if (!professional?.email) return;

    const client = await getClientById(patient.client_id).catch(() => null);
    const companyName = client?.name || 'Azienda cliente';
    const patientName = `${patient.first_name} ${patient.last_name}`;

    const html = acuteEventOsteopath({
      patient_name: patientName,
      company_name: companyName,
      description,
      nrs,
      zone: pain_zone,
      deadline: escalation_deadline,
    });

    await sendEmail({
      to: professional.email,
      subject: `🚨 Evento acuto segnalato — ${patientName} (${companyName})`,
      html,
    });
  } catch (e) {
    console.error('[acute-event] notify osteopath error:', e.message);
  }
}
