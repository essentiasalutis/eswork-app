// GET /api/employee/[token]/export
// Diritto di accesso e portabilità (GDPR artt. 15, 20): l'interessato scarica
// una copia dei PROPRI dati in formato leggibile/strutturato (JSON).

import {
  getPatientByCareToken,
  getSessionsByPatient,
  getCyclesByPatient,
  getMiniChecksByPatient,
  getReassessmentT12ByPatient,
  getConsentByPatient,
  getDataRequestsByPatient,
} from '../../../../lib/store';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token mancante' });

  const patient = await getPatientByCareToken(token).catch(() => null);
  if (!patient) return res.status(404).json({ error: 'Link non valido o scaduto' });

  const [sessions, cycles, miniChecks, reassessment, consent, requests] = await Promise.all([
    getSessionsByPatient(patient.id).catch(() => []),
    getCyclesByPatient(patient.id).catch(() => []),
    getMiniChecksByPatient(patient.id).catch(() => []),
    getReassessmentT12ByPatient(patient.id).catch(() => null),
    getConsentByPatient(patient.id).catch(() => null),
    getDataRequestsByPatient(patient.id).catch(() => []),
  ]);

  const copia = {
    documento: 'Copia dei dati personali — ES Work (Essentia Salutis)',
    base_giuridica: 'GDPR artt. 15 (accesso) e 20 (portabilità)',
    generato_il: new Date().toISOString(),
    titolare: 'Essentia Salutis — info@essentiasalutis.it',
    anagrafica: {
      nome: patient.first_name,
      cognome: patient.last_name,
      email: patient.email,
      telefono: patient.phone,
      sede: patient.location,
      livello: patient.level,
      stato_livello: patient.level_status,
      assessment_completato_il: patient.assessment_completed_at,
      consenso_revocato_il: patient.consent_withdrawn_at || null,
    },
    consenso_pre_questionario: consent ? {
      consenso_privacy_il: consent.consent_privacy_at,
      consenso_salute_il: consent.consent_health_at,
      versione_informativa: consent.informativa_version,
      registrato_il: consent.created_at,
    } : null,
    sedute: (sessions || []).map(s => ({
      data: s.date, numero: s.session_number,
      nrs_pre: s.nrs_pre, nrs_post: s.nrs_post,
      note_trattamento: s.treatment_notes,
    })),
    cicli: (cycles || []).map(c => ({
      numero: c.cycle_number, tipo: c.cycle_type, stato: c.status,
      esito: c.outcome, avviato_il: c.started_at, chiuso_il: c.closed_at,
    })),
    mini_check: (miniChecks || []).map(m => ({
      tipo: m.check_type, nrs: m.nrs_current, limitazioni: m.has_limitations, data: m.created_at,
    })),
    rivalutazione_t12: reassessment ? {
      pgic: reassessment.pgic, livello_ricalcolato: reassessment.computed_level, completata_il: reassessment.completed_at,
    } : null,
    richieste_diritti: (requests || []).map(r => ({
      tipo: r.type, stato: r.status, richiesta_il: r.created_at, processata_il: r.processed_at,
    })),
  };

  const filename = `es-work_miei-dati_${(patient.last_name || 'dati').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(JSON.stringify(copia, null, 2));
}
