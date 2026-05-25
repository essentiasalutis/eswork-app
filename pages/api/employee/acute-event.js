import { getPatientByCareToken, createAcuteEvent, countAcuteEventsThisYear, generateId } from '../../../lib/store';

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

  return res.json({ ok: true });
}
