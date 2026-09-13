import {
  getPatientByCareToken,
  getCyclesByPatient,
  getSessionsByPatient,
  getMiniChecksByPatient,
  getReassessmentT12ByPatient,
  getSelfTriggerBudget,
  getClientById,
} from '../../../lib/store';
import { vistaPazienteAreaPersonale, vistaCicli, andamentoNrs, vistaPercorso } from '../../../lib/vista';
import { limiteAreaPersonale } from '../../../lib/employee-guard';
import { programmaAttivo } from '../../../lib/attivazione';

// Area personale del dipendente. Al browser va SOLO ciò che la pagina disegna
// (lib/vista.js): fino al 12/9 partivano anche anamnesi, red flag, note interne,
// note di trattamento dell'osteopata, note della pre-validazione e il care_token —
// campi che la pagina non mostra ma che chiunque apra gli strumenti del browser legge.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token mancante' });
  if (!limiteAreaPersonale(req, res, token)) return;

  const patient = await getPatientByCareToken(token).catch(() => null);
  if (!patient) return res.status(404).json({ error: 'Link non valido o scaduto' });

  const [cycles, sessions, miniChecks, reassessment, selfTriggerBudget, client] = await Promise.all([
    getCyclesByPatient(patient.id).catch(() => []),
    getSessionsByPatient(patient.id).catch(() => []),
    getMiniChecksByPatient(patient.id).catch(() => []),
    getReassessmentT12ByPatient(patient.id).catch(() => null),
    getSelfTriggerBudget(patient.id).catch(() => ({ used: 0, max: 2, remaining: 2 })),
    getClientById(patient.client_id).catch(() => null),
  ]);

  return res.json({
    patient: vistaPazienteAreaPersonale(patient),
    cycles: vistaCicli(cycles),
    // Solo i due numeri mostrati: nessuna riga di seduta, nessuna nota.
    nrs: andamentoNrs(sessions),
    // «Il mio percorso»: righe già pronte (fonte unica anche per i mini-check, che
    // prima viaggiavano come lista a sé).
    percorso: vistaPercorso({ sessions, cycles, miniChecks, reassessment }),
    selfTriggerBudget: { remaining: selfTriggerBudget ? selfTriggerBudget.remaining : 2 },
    // Solo il sì/no: la pagina spegne i pulsanti del percorso finché il programma
    // non è attivo. Il gate vero resta sul server (lib/attivazione + self-trigger).
    programmaAttivo: programmaAttivo(client),
  });
}
