import { requireProAuth } from '../../../../lib/pro-auth';
import {
  getPatientById,
  proCanAccessPatientClinical,
  logAccess,
} from '../../../../lib/store';
import { vistaCartellaCurante } from '../../../../lib/vista';

export default requireProAuth(async function handler(req, res) {
  const { patientId } = req.query;
  const proId = req.proSession.proId;

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });

  // Livello B — cartella clinica: solo l'osteopata assegnato al paziente
  const allowed = await proCanAccessPatientClinical(proId, patient);
  if (!allowed) return res.status(403).json({ error: 'Accesso negato' });

  if (req.method === 'GET') {
    // Livello B — accesso alla cartella clinica di dettaglio: tracciato
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
    await logAccess({ professional_id: proId, action: 'view_patient', patient_id: patientId, ip, user_agent: req.headers['user-agent'], details: 'Apertura cartella clinica' }).catch(() => {});
    // Proiezione della cartella (12/9): niente email, telefono e campi di servizio.
    return res.json(vistaCartellaCurante(patient));
  }

  // PATCH — tolto il 18/9 (Enrico): c'è una sola anamnesi, il documento firmato, e
  // si modifica solo con le integrazioni (/api/pro/patients/[id]/anamnesi, v71).
  // Qui si modificavano i campi d'anamnesi della scheda: una seconda copia che
  // nessun documento mostrava.
  if (req.method === 'PATCH') {
    return res.status(405).json({ error: 'La scheda del paziente non si modifica da qui: l\'anamnesi si integra dalla cartella («Integra anamnesi»), il livello si cambia con «Riclassifica».' });
  }

  // DELETE — tolto all'osteopata (Enrico, 17/9). Cancellare un paziente cancella
  // sedute e documenti firmati: è documentazione clinica da conservare. Resta solo
  // la procedura dell'amministratore (/api/admin/patients/[patientId]).
  if (req.method === 'DELETE') {
    return res.status(403).json({ error: 'La cancellazione di un paziente non è consentita dalla cartella: la documentazione clinica va conservata.' });
  }

  res.status(405).end();
});
