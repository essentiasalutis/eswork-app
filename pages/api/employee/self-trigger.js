// POST /api/employee/self-trigger
// Auto-segnalazione strutturata (consolida la vecchia logica "evento acuto").
// Mini-triage SENZA NRS → richiesta di pre-validazione instradata all'osteopata
// assegnato all'azienda (riusa il flusso waitlist + pre-validazione esistente).

import {
  getPatientByCareToken,
  getSelfTriggerBudget,
  getTreatmentCapacity,
  createSelfTrigger,
  addToWaitlist,
  getClientById,
  generateId,
} from '../../../lib/store';
import { sendEmail } from '../../../lib/email';
import { selfTriggerOsteopath } from '../../../lib/email-templates';
import supabase from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token, disturbance, functional_impact, duration, urgent, note } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token mancante' });
  if (!disturbance) return res.status(400).json({ error: 'Descrivi il disturbo' });

  const patient = await getPatientByCareToken(token).catch(() => null);
  if (!patient) return res.status(404).json({ error: 'Link non valido' });

  // Budget personale: massimo 2 attivazioni l'anno
  const budget = await getSelfTriggerBudget(patient.id);
  if (budget.remaining <= 0) {
    return res.status(429).json({
      error: 'Hai esaurito le 2 auto-segnalazioni disponibili quest\'anno. Per necessità urgenti scrivi a info@essentiasalutis.it',
      remaining: 0,
    });
  }

  // Capacità contrattuale azienda: cicli avviati + candidati in coda non possono
  // superare i percorsi pagati (L1 contratto + buffer 20%). Tutela automatica:
  // niente nuovi ingressi oltre quanto contrattualizzato.
  const capacity = await getTreatmentCapacity(patient.client_id).catch(() => null);
  if (capacity?.intakeSaturated) {
    return res.status(429).json({
      error: 'Il programma della tua azienda ha raggiunto la capacità annuale dei percorsi di trattamento. La tua segnalazione non può essere presa in carico al momento: riprova più avanti oppure scrivi a info@essentiasalutis.it.',
      capacity_reached: true,
    });
  }

  const isUrgent = !!urgent;

  // 1) Registra il self-trigger (per budget + storico + triage)
  await createSelfTrigger({
    patient_id: patient.id,
    client_id: patient.client_id,
    disturbance: disturbance || null,
    functional_impact: functional_impact === true || functional_impact === 'true',
    duration: duration || null,
    urgent: isUrgent,
    note: note || null,
    status: 'pending',
  }).catch(e => console.error('[self-trigger] create error:', e.message));

  // 2) Genera la richiesta di pre-validazione (waitlist) instradata all'osteopata
  //    dell'azienda. Riusa il flusso esistente: comparirà nella coda dell'osteopata.
  await addToWaitlist({
    patient_id: patient.id,
    client_id: patient.client_id,
    score: isUrgent ? 100 : 70,
    source: 'self_trigger',
    status: 'pending',
    notes: `Self-trigger${isUrgent ? ' URGENTE' : ''}: ${disturbance}${functional_impact ? ' · impatto sulle attività' : ''}${duration ? ` · da ${duration}` : ''}`,
  }).catch(e => console.error('[self-trigger] waitlist error:', e.message));

  // 3) Notifica l'osteopata assegnato all'azienda (immediata se urgente)
  notifyOsteopath(patient, { disturbance, functional_impact, duration, urgent: isUrgent, note }).catch(() => {});

  const remaining = Math.max(0, budget.remaining - 1);
  return res.json({ ok: true, remaining, urgent: isUrgent });
}

async function notifyOsteopath(patient, triage) {
  try {
    const { data: assignments } = await supabase
      .from('professional_assignments')
      .select('professionals(id, name, email)')
      .eq('client_id', patient.client_id)
      .eq('active', true)
      .limit(1);
    const professional = assignments?.[0]?.professionals;
    if (!professional?.email) return;

    const client = await getClientById(patient.client_id).catch(() => null);
    const html = selfTriggerOsteopath({
      patient_name: `${patient.first_name} ${patient.last_name}`,
      company_name: client?.name || 'Azienda cliente',
      disturbance: triage.disturbance,
      functional_impact: triage.functional_impact,
      duration: triage.duration,
      urgent: triage.urgent,
      note: triage.note,
    });
    await sendEmail({
      to: professional.email,
      subject: `${triage.urgent ? '🚨 ' : ''}Self-trigger — ${patient.first_name} ${patient.last_name}`,
      html,
    });
  } catch (e) {
    console.error('[self-trigger] notify osteopath error:', e.message);
  }
}
