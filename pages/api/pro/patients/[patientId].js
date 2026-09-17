import { requireProAuth } from '../../../../lib/pro-auth';
import {
  getPatientById,
  updatePatient,
  proCanAccessPatientClinical,
  logAccess,
} from '../../../../lib/store';
import { validaModifica } from '../../../../lib/modifica-paziente.mjs';
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

  // PATCH — solo l'anamnesi (lib/modifica-paziente.mjs). Azienda, livello, stato,
  // prevenzione, osteopata assegnato e chiave dell'area personale non si toccano
  // da qui: prima il corpo della richiesta si salvava così com'era.
  if (req.method === 'PATCH') {
    const v = validaModifica(req.body);
    if (!v.ok) return res.status(400).json({ error: v.errore, campi_rifiutati: v.campi_rifiutati || [] });
    try {
      const updated = await updatePatient(patientId, v.campi);
      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
      await logAccess({ professional_id: proId, action: 'edit_patient', patient_id: patientId, ip, user_agent: req.headers['user-agent'], details: `Anamnesi modificata: ${Object.keys(v.campi).join(', ')}` }).catch(() => {});
      return res.json(vistaCartellaCurante(updated));
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // DELETE — tolto all'osteopata (Enrico, 17/9). Cancellare un paziente cancella
  // sedute e documenti firmati: è documentazione clinica da conservare. Resta solo
  // la procedura dell'amministratore (/api/admin/patients/[patientId]).
  if (req.method === 'DELETE') {
    return res.status(403).json({ error: 'La cancellazione di un paziente non è consentita dalla cartella: la documentazione clinica va conservata.' });
  }

  res.status(405).end();
});
