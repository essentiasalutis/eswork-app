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
  getPatientDocuments,
  getIntegrazioniAnamnesi,
  getProfessionals,
  getPreValidationsByPatient,
} from '../../../../lib/store';
import { esitoPrevalidazione } from '../../../../lib/prevalidazione.mjs';
import { anamnesiPerInteressato } from '../../../../lib/anamnesi.mjs';
import { limiteAreaPersonale } from '../../../../lib/employee-guard';
import { giornoIt } from '../../../../lib/date-it.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token mancante' });
  if (!limiteAreaPersonale(req, res, token)) return;

  const patient = await getPatientByCareToken(token).catch(() => null);
  if (!patient) return res.status(404).json({ error: 'Link non valido o scaduto' });

  // Pre-validazioni (21/9, Enrico): dati scritti sulla persona, note cliniche comprese.
  // Se la lettura fallisce la copia NON esce senza dirlo: la sezione lo dichiara.
  let preValidazioni = null;
  try {
    const [righe, pro] = await Promise.all([getPreValidationsByPatient(patient.id), getProfessionals().catch(() => [])]);
    const nomi = Object.fromEntries((pro || []).map(p => [p.id, p.name]));
    preValidazioni = righe.slice().reverse().map(v => ({
      data: v.created_at, osteopata: nomi[v.professional_id] || 'osteopata', esito: esitoPrevalidazione(v.outcome),
      durata_videocall_minuti: v.duration_minutes, nrs_durante_videocall: v.nrs_during_call,
      zona_dolore: v.pain_zone, durata_sintomi_mesi: v.symptom_duration_months, note_cliniche: v.clinical_notes || null,
    }));
  } catch (e) {
    preValidazioni = { non_disponibile: 'Non è stato possibile leggere le pre-validazioni in questo momento: riprova più tardi.' };
  }

  const [sessions, cycles, miniChecks, reassessment, consent, requests] = await Promise.all([
    getSessionsByPatient(patient.id).catch(() => []),
    getCyclesByPatient(patient.id).catch(() => []),
    getMiniChecksByPatient(patient.id).catch(() => []),
    getReassessmentT12ByPatient(patient.id).catch(() => null),
    getConsentByPatient(patient.id).catch(() => null),
    getDataRequestsByPatient(patient.id).catch(() => []),
  ]);

  // Anamnesi (18/9): originale firmato + integrazioni dell'osteopata, con nome, data e
  // motivo. Se una delle due letture fallisce l'anamnesi NON esce a metà: senza le
  // integrazioni sembrerebbe l'originale, o l'originale sembrerebbe la versione attuale.
  let anamnesi = null;
  try {
    const docs = await getPatientDocuments(patient.id);
    const doc = docs.find(d => d.type === 'anamnesi');
    if (doc) {
      const [righe, pro] = await Promise.all([getIntegrazioniAnamnesi(patient.id), getProfessionals().catch(() => [])]);
      const nomi = Object.fromEntries((pro || []).map(p => [p.id, p.name]));
      anamnesi = anamnesiPerInteressato(doc, righe.map(r => ({ ...r, osteopata: nomi[r.professional_id] || 'osteopata' })));
    }
  } catch (e) {
    anamnesi = { non_disponibile: 'Non è stato possibile leggere l\'anamnesi completa in questo momento: riprova più tardi.' };
  }

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
    anamnesi,
    pre_validazioni: preValidazioni,
    sedute: (sessions || []).map(s => ({
      data: s.date, numero: s.session_number,
      nrs_pre: s.nrs_pre, nrs_post: s.nrs_post,
      note_trattamento: s.treatment_notes,
      // Anche le indicazioni per la seduta successiva sono dati sulla persona (Enrico, 18/9).
      indicazioni_prossima_seduta: s.next_session_notes || null,
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

  const filename = `es-work_miei-dati_${(patient.last_name || 'dati').toLowerCase()}_${giornoIt()}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(JSON.stringify(copia, null, 2));
}
