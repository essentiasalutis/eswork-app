import { requireProAuth } from '../../../../../lib/pro-auth';
import {
  getPatientById,
  getPatientDocuments,
  getIntegrazioniAnamnesi,
  insertIntegrazioniAnamnesi,
  getProfessionals,
  proCanAccessPatientClinical,
  generateId,
  logAccess,
} from '../../../../../lib/store';
import { getClientIp } from '../../../../../lib/rate-limit';
import { anamnesiGiaCompilata, originaleDaDocumento, versioneCorrente, validaIntegrazione } from '../../../../../lib/anamnesi.mjs';

// GET  /api/pro/patients/[patientId]/anamnesi → originale firmato, integrazioni, versione corrente
// POST /api/pro/patients/[patientId]/anamnesi { valori, motivo } → nuove integrazioni
//
// Decisione di Enrico (18/9): una sola anamnesi, il documento firmato. La firma
// copre solo l'originale; ogni modifica dell'osteopata è un'integrazione (v71) con
// data e motivo, e l'originale resta sempre leggibile. Solo l'osteopata assegnato.
export default requireProAuth(async function handler(req, res) {
  const proId = req.proSession.proId;
  const { patientId } = req.query;

  const patient = await getPatientById(patientId).catch(() => null);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });
  if (!(await proCanAccessPatientClinical(proId, patient))) {
    return res.status(403).json({ error: 'Accesso negato: l\'anamnesi è riservata all\'osteopata assegnato.' });
  }

  const docs = await getPatientDocuments(patientId);
  if (!anamnesiGiaCompilata(docs)) return res.status(404).json({ error: 'L\'anamnesi non è ancora stata compilata e firmata.' });
  const doc = docs.find(d => d.type === 'anamnesi');
  const originale = originaleDaDocumento(doc);
  const ip = getClientIp(req);

  const risposta = async () => {
    const integrazioni = await getIntegrazioniAnamnesi(patientId);
    const nomi = Object.fromEntries(((await getProfessionals().catch(() => [])) || []).map(p => [p.id, p.name]));
    const conNome = integrazioni.map(r => ({ id: r.id, campo: r.campo, valore_prima: r.valore_prima, valore_dopo: r.valore_dopo, motivo: r.motivo, gruppo: r.gruppo, creato_il: r.creato_il, osteopata: nomi[r.professional_id] || 'Osteopata' }));
    const { valori } = versioneCorrente(originale, conNome);
    return { originale, firmata_il: doc.signed_at, modalita: doc.modalita || null, integrazioni: conNome, corrente: valori };
  };

  if (req.method === 'GET') {
    await logAccess({ professional_id: proId, action: 'view_anamnesi', patient_id: patientId, ip, user_agent: req.headers['user-agent'], details: 'Lettura anamnesi (originale e integrazioni)' }).catch(() => {});
    return res.json(await risposta());
  }

  if (req.method === 'POST') {
    const { valori, motivo } = req.body || {};
    const { valori: corrente } = versioneCorrente(originale, await getIntegrazioniAnamnesi(patientId));
    const v = validaIntegrazione(corrente, valori, motivo);
    if (!v.ok) return res.status(400).json({ error: v.errore });
    const gruppo = generateId('grp');
    const adesso = new Date().toISOString();
    try {
      await insertIntegrazioniAnamnesi(v.righe.map(r => ({
        id: generateId('ain'), patient_id: patientId, documento_id: doc.id, professional_id: proId,
        gruppo, campo: r.campo, valore_prima: r.valore_prima, valore_dopo: r.valore_dopo, motivo: v.motivo, creato_il: adesso,
      })));
    } catch (e) {
      return res.status(500).json({ error: `Integrazione non registrata: ${e.message}` });
    }
    // Nel registro: quali campi, non i valori (sono dati clinici).
    await logAccess({ professional_id: proId, action: 'integrate_anamnesi', patient_id: patientId, ip, user_agent: req.headers['user-agent'], details: `Anamnesi integrata: ${v.righe.map(r => r.campo).join(', ')}` }).catch(() => {});
    return res.json(await risposta());
  }

  res.status(405).end();
});
