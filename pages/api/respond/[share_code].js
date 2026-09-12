import {
  getAssessmentByShareCode,
  getClientById,
  insertResponse,
  generateId,
  getPatientByCareToken,
  updatePatient,
  updatePatientAssessmentStatus,
  addToWaitlist,
} from '../../../lib/store';
import { computeLevel } from '../../../lib/scoring';
import { checkRateLimit, getClientIp } from '../../../lib/rate-limit';

// Anti-enumerazione del link questionario. Il limite vale SOLO sui tentativi
// FALLITI (codice inesistente o questionario chiuso) e non tocca MAI una richiesta
// con un codice valido — nemmeno da un IP che ha già esaurito i tentativi.
// Il motivo è concreto: i dipendenti di un'azienda escono tutti dallo STESSO IP
// (NAT aziendale). Bloccare l'IP "a monte" significherebbe che un solo scanner —
// o un collega che sbaglia il link undici volte — chiude fuori dal questionario
// l'intera azienda. Un link valido dev'essere servito sempre; chi tira a
// indovinare colleziona 404 e dopo la soglia riceve solo 429.
// NB: limiter in-memory per istanza serverless (come quello del login): ferma la
// singola sorgente, non un attacco distribuito.
const MISS_LIMIT = 10;
const MISS_WINDOW_MS = 15 * 60 * 1000;

export default async function handler(req, res) {
  const { share_code } = req.query;
  const missKey = `respond-miss:${getClientIp(req)}`;

  // Conta il fallimento e risponde: l'errore reale entro soglia, 429 oltre.
  const miss = (status, error) => {
    const rl = checkRateLimit(missKey, MISS_LIMIT, MISS_WINDOW_MS);
    if (!rl.ok) return res.status(429).json({ error: 'Troppi tentativi. Riprova più tardi.' });
    return res.status(status).json({ error });
  };

  if (req.method === 'GET') {
    const assessment = await getAssessmentByShareCode(share_code);
    if (!assessment) return miss(404, 'Link non valido');
    if (assessment.status !== 'active') return miss(410, 'Questionario chiuso');
    const client = await getClientById(assessment.client_id);
    return res.json({
      assessment: {
        id: assessment.id,
        type: assessment.type,
      },
      client: { name: client?.name },
    });
  }

  if (req.method === 'POST') {
    const assessment = await getAssessmentByShareCode(share_code);
    if (!assessment) return miss(404, 'Link non valido');
    if (assessment.status !== 'active') return miss(410, 'Questionario chiuso');

    // Estrai care_token dal body (link personalizzato)
    const { _care_token, ...answers } = req.body || {};

    try {
      await insertResponse({
        id: generateId('r'),
        assessment_id: assessment.id,
        answers,
        submitted_at: new Date().toISOString(),
      });

      // Se link personalizzato: aggiorna paziente con livello calcolato
      if (_care_token) {
        try {
          const patient = await getPatientByCareToken(_care_token);
          if (patient) {
            const computed_level = computeLevel(answers);

            // Prevenzione attiva: spetta a OGNI Livello 2 (Enrico, 12/9). Il listino v2
            // la fa pagare a tutti, e in un'azienda dove stanno tutti bene è la prevenzione
            // a dare un programma da erogare. La configurazione non c'entra più.
            const prevention_eligible = computed_level === 'level2';

            await updatePatient(patient.id, {
              computed_level,
              prevention_eligible,
              assessment_completed_at: new Date().toISOString(),
            });

            // Se L1: CANDIDATO in coda pre-validazione (level_status='pending'),
            // NON confermato. Il level active lo dà solo la pre-validazione l1_confirmed.
            if (computed_level === 'level1' && patient.level !== 'level1') {
              await updatePatient(patient.id, { level: 'level1', level_status: 'pending' });
              await addToWaitlist({
                id: generateId('wl'),
                patient_id: patient.id,
                client_id: patient.client_id,
                assessment_id: assessment.id,
                score: 100,
                source: 'assessment',
                status: 'pending',
                created_at: new Date().toISOString(),
              }).catch(() => {}); // ignora se già presente
            } else if (computed_level === 'level2' && patient.level !== 'level1') {
              await updatePatient(patient.id, { level: 'level2', level_status: 'active' });
            }

            await updatePatientAssessmentStatus(patient.id, {
              assessment_completed_at: new Date().toISOString(),
            }).catch(() => {});
          }
        } catch {
          // Errori sul tracking non bloccano il salvataggio della risposta
        }
      }

      return res.status(201).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
}
