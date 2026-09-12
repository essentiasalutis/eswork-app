import {
  getPatientByCareToken,
  getCyclesByPatient,
  getSessionsByPatient,
  getMiniChecksByPatient,
  getSelfTriggerBudget,
} from '../../../lib/store';
import { vistaPazienteAreaPersonale, vistaCicli, vistaMiniCheck, andamentoNrs } from '../../../lib/vista';
import { limiteAreaPersonale } from '../../../lib/employee-guard';

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

  const [cycles, sessions, miniChecks, selfTriggerBudget] = await Promise.all([
    getCyclesByPatient(patient.id).catch(() => []),
    getSessionsByPatient(patient.id).catch(() => []),
    getMiniChecksByPatient(patient.id).catch(() => []),
    getSelfTriggerBudget(patient.id).catch(() => ({ used: 0, max: 2, remaining: 2 })),
  ]);

  return res.json({
    patient: vistaPazienteAreaPersonale(patient),
    cycles: vistaCicli(cycles),
    // Solo i due numeri mostrati: nessuna riga di seduta, nessuna nota.
    nrs: andamentoNrs(sessions),
    miniChecks: vistaMiniCheck(miniChecks),
    selfTriggerBudget: { remaining: selfTriggerBudget ? selfTriggerBudget.remaining : 2 },
  });
}
