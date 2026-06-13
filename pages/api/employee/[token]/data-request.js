// POST /api/employee/[token]/data-request
// L'interessato (dipendente, autenticato via care_token) esercita un diritto GDPR.
// La richiesta viene TRACCIATA e gestita dal titolare. La revoca del consenso ha
// effetto immediato (flag sul paziente) oltre a essere registrata.

import {
  getPatientByCareToken,
  createDataRequest,
  setConsentWithdrawn,
} from '../../../../lib/store';

const TYPES = ['access', 'rectification', 'erasure', 'consent_withdrawal'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { token } = req.query;
  const { type, note } = req.body || {};

  if (!token) return res.status(400).json({ error: 'Token mancante' });
  if (!TYPES.includes(type)) return res.status(400).json({ error: 'Tipo di richiesta non valido' });

  const patient = await getPatientByCareToken(token).catch(() => null);
  if (!patient) return res.status(404).json({ error: 'Link non valido o scaduto' });

  try {
    // La revoca del consenso ha EFFETTO IMMEDIATO + viene registrata come "done".
    // Le altre richieste restano "pending" finché il titolare non le processa.
    const isWithdrawal = type === 'consent_withdrawal';
    if (isWithdrawal) {
      await setConsentWithdrawn(patient.id);
    }

    const reqRow = await createDataRequest({
      patient_id: patient.id,
      client_id: patient.client_id,
      type,
      status: isWithdrawal ? 'done' : 'pending',
      note: (note || '').slice(0, 2000) || null,
      response_note: isWithdrawal ? 'Consenso revocato dall\'interessato: trattamenti non obbligatori interrotti. La documentazione clinica è conservata per l\'obbligo legale.' : null,
      processed_at: isWithdrawal ? new Date().toISOString() : null,
      processed_by: isWithdrawal ? 'system' : null,
    });

    return res.status(201).json({ ok: true, id: reqRow.id, type, status: reqRow.status });
  } catch (e) {
    console.error('[data-request] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
