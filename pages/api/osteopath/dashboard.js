import { requireProAuth } from '../../../lib/pro-auth';
import {
  getPatientsByProfessional,
  getCyclesByPatient,
  getAcuteEventsByProfessional,
  getWaitlistByProfessional,
  getAllRestratAlerts,
} from '../../../lib/store';

export default requireProAuth(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const proId = req.proSession.proId;

  const [patients, acuteEvents, waitlist] = await Promise.all([
    getPatientsByProfessional(proId).catch(() => []),
    getAcuteEventsByProfessional(proId).catch(() => []),
    getWaitlistByProfessional(proId).catch(() => []),
  ]);

  // L1 in trattamento attivo
  const l1Patients = patients.filter(p => p.level === 'level1' && p.level_status === 'active');

  // Cicli attivi per ogni L1
  const cyclesMap = {};
  await Promise.all(
    l1Patients.map(async p => {
      const cycles = await getCyclesByPatient(p.id).catch(() => []);
      cyclesMap[p.id] = cycles;
    })
  );

  // Mini-check che richiedono contatto (restrat pending da checkpoint)
  // Già nelle restrat alerts - non duplichiamo

  return res.json({
    patients,
    l1Patients,
    cyclesMap,
    acuteEvents,
    waitlist,
    proId,
  });
});
