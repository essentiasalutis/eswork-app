import { requireProAuth } from '../../../../../lib/pro-auth';
import { upsertPatientDocument, getPatientById, getPatientDocuments, proCanAccessPatientClinical, logAccess } from '../../../../../lib/store';
import { anamnesiGiaCompilata } from '../../../../../lib/anamnesi.mjs';
import { hashIp, hashContent } from '../../../../../lib/crypto-utils';
import { getClientIp } from '../../../../../lib/rate-limit';
import { vistaDocumentoCartella } from '../../../../../lib/vista';
import { testoAccettabile, registraConsensoSoggetto } from '../../../../../lib/testi-legali-server';

// POST /api/pro/patients/documents/bulk?patientId=xxx
// Salva consenso + privacy + anamnesi in un'unica operazione con firma cumulativa.
// Registra: timestamp, hash contenuto documenti, ip anonimizzato, user-agent.
// Livello B (cartella clinica): SOLO l'osteopata assegnato al paziente.

export default requireProAuth(async function handler(req, res) {
  const proId = req.proSession.proId;

  if (req.method !== 'POST') return res.status(405).end();

  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ error: 'patientId richiesto' });

  const patient = await getPatientById(patientId);
  if (!patient) return res.status(404).json({ error: 'Paziente non trovato' });
  if (!(await proCanAccessPatientClinical(proId, patient))) {
    return res.status(403).json({ error: 'Accesso negato: documenti clinici riservati all\'osteopata assegnato.' });
  }

  try {
    const {
      signature_image,
      form_data,
      pro_notes,
      consenso_testo_id,
      informativa_testo_id,
    } = req.body;
    // L'azienda si legge dal paziente, non dal corpo della richiesta.
    const client_id = patient.client_id;

    // v64: i due testi firmati sono quelli dell'ARCHIVIO che il server ha servito
    // alla pagina. L'impronta è quella archiviata: MAI calcolata su un testo
    // arrivato dal browser. Versione ritirata da troppo tempo o sconosciuta → no.
    const [tConsenso, tInformativa] = await Promise.all([
      testoAccettabile(consenso_testo_id, 'consenso_trattamento'),
      testoAccettabile(informativa_testo_id, 'informativa_estesa'),
    ]);
    if (!tConsenso || !tInformativa) {
      return res.status(409).json({ error: 'I testi da firmare sono stati aggiornati: ricarica la cartella e fai rileggere i documenti prima di firmare.' });
    }
    if (!signature_image) return res.status(400).json({ error: 'firma obbligatoria' });
    if (!form_data)       return res.status(400).json({ error: 'dati anamnesi obbligatori' });

    const ip    = getClientIp(req);
    const now   = new Date().toISOString();
    const base  = {
      professional_id: proId,
      signed_at:       now,
      ip_hash:         hashIp(ip),
      user_agent:      req.headers['user-agent']?.slice(0, 200) || null,
      signature_image,
      // Firma in piattaforma: il documento corrente non è più una copia su carta.
      // Le copie caricate prima restano in copie_cartacee e nell'archivio file.
      modalita: 'piattaforma',
      carta_data_firma: null, carta_motivo: null, carta_motivo_nota: null,
      file_path: null, file_mime: null, file_bytes: null, file_impronta: null, caricato_il: null,
    };

    // Una nuova firma dei consensi (per esempio su una nuova versione) NON riscrive
    // l'anamnesi già compilata: resta l'originale con la sua firma (lib/anamnesi.mjs).
    const esistenti = await getPatientDocuments(patientId);
    const anamnesiEsistente = anamnesiGiaCompilata(esistenti) ? esistenti.find(d => d.type === 'anamnesi') : null;

    const [docConsent, docPrivacy, docAnamnesi] = await Promise.all([
      upsertPatientDocument(patientId, client_id, 'consent_treatment', {
        ...base,
        status:       'signed',
        content_hash: tConsenso.impronta,
        testo_legale_id: tConsenso.id,
        versione:     tConsenso.versione,
      }),
      upsertPatientDocument(patientId, client_id, 'privacy_extended', {
        ...base,
        status:       'signed',
        content_hash: tInformativa.impronta,
        testo_legale_id: tInformativa.id,
        versione:     tInformativa.versione,
      }),
      anamnesiEsistente ? Promise.resolve(anamnesiEsistente) : upsertPatientDocument(patientId, client_id, 'anamnesi', {
        ...base,
        status:       'completed',
        form_data,
        pro_notes:    pro_notes || null,
        content_hash: hashContent(JSON.stringify(form_data)),
      }),
    ]);

    // Registro dei consensi: una riga per documento firmato.
    const ipHash = hashIp(ip); const ua = req.headers['user-agent']?.slice(0, 200) || null;
    await Promise.all([
      registraConsensoSoggetto({ soggettoId: patientId, testo: tConsenso, consenso: 'trattamento', canale: 'cartella', ipHash, userAgent: ua }),
      registraConsensoSoggetto({ soggettoId: patientId, testo: tInformativa, consenso: 'informativa_estesa', canale: 'cartella', ipHash, userAgent: ua }),
    ]);

    await logAccess({ professional_id: proId, action: 'sign_documents', patient_id: patientId, ip, user_agent: req.headers['user-agent'], details: 'Firma cumulativa: consenso + privacy + anamnesi' }).catch(() => {});

    console.log(`[bulk-docs] patient=${patientId} signed at ${now} — consent=${docConsent.id} privacy=${docPrivacy.id} anamnesi=${docAnamnesi.id}`);
    // Mai l'immagine della firma autografa verso il browser (come la pagina SSR).
    return res.json([docConsent, docPrivacy, docAnamnesi].map(vistaDocumentoCartella));

  } catch (e) {
    console.error('[bulk-docs] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});
