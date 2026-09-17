// ─────────────────────────────────────────────────────────────────────────────
// Copia cartacea del consenso — lato server. Regole pure in lib/copia-cartacea.mjs.
//
// Percorso del file:
//   1. prepara: link firmato per caricare in TRANSITO (transito/<paziente>/…).
//      Nulla si scrive sul paziente.
//   2. accetta: il server scarica il file dal transito, ne legge tipo, dimensione
//      e impronta, controlla versione, data (7 giorni) e motivo. Se una sola cosa
//      non va, il file si rimuove e il paziente resta com'era. Se va tutto bene,
//      il file passa nell'archivio (<paziente>/…), si scrivono la copia, il
//      documento corrente e il registro dei consensi.
// Il file archiviato non si cancella mai quando si carica una copia nuova: si
// conserva con la documentazione clinica (lo rimuove solo la procedura
// dell'amministratore, insieme al paziente).
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import supabase from './db';
import { upsertPatientDocument, logAccess } from './store';
import { hashIp } from './crypto-utils';
import { testoPerId, registraConsensoSoggetto } from './testi-legali-server';
import {
  BYTE_MAX, CODICE_PER_DOCUMENTO, CONSENSO_PER_DOCUMENTO, MOTIVI,
  erroreDataFirma, versioneInVigoreIl, erroreMotivo, tipoDaiByte, giornoRoma, cartaSospesa, CARTA_SOSPESA,
} from './copia-cartacea.mjs';

export const BUCKET = 'patient-documents';
const TRANSITO = 'transito';
const MIME_AMMESSI = ['application/pdf', 'image/jpeg', 'image/png'];
const RE_ID = /^[A-Za-z0-9_-]+$/;

const cartellaTransito = (patientId) => `${TRANSITO}/${patientId}/`;

async function rimuovi(paths) {
  const p = (paths || []).filter(Boolean);
  if (!p.length) return;
  await supabase.storage.from(BUCKET).remove(p).then(() => {}, () => {});
}

// Toglie dal transito i file di questo paziente mai confermati da più di un'ora.
async function pulisciTransito(patientId) {
  try {
    const { data } = await supabase.storage.from(BUCKET).list(`${TRANSITO}/${patientId}`, { limit: 100 });
    const vecchi = (data || []).filter(f => f.created_at && Date.now() - Date.parse(f.created_at) > 3600000)
      .map(f => `${TRANSITO}/${patientId}/${f.name}`);
    await rimuovi(vecchi);
  } catch (_) { /* la pulizia non blocca il caricamento */ }
}

// 1. Link firmato per caricare nel transito.
export async function preparaCaricamento(patientId, contentType) {
  if (!RE_ID.test(patientId)) throw new Error('paziente non valido');
  if (!MIME_AMMESSI.includes(contentType)) return { ok: false, errore: 'file_tipo_non_ammesso' };
  await pulisciTransito(patientId);
  const path = `${cartellaTransito(patientId)}${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { ok: true, path, signed_url: data.signedUrl };
}

// 2. Verifica e, solo se tutto torna, archivia.
// documenti: [{ tipo: 'consent_treatment'|'privacy_extended', testo_legale_id }]
// Un file può contenere entrambi i documenti firmati.
export async function accettaCopia({ patient, proId, documenti, path, dataFirma, motivo, motivoNota, ip, userAgent, adesso = new Date() }) {
  const errori = [];
  const tipiVisti = new Set();
  const elenco = Array.isArray(documenti) ? documenti : [];
  if (!elenco.length) errori.push('documenti_mancanti');
  for (const d of elenco) {
    if (d && cartaSospesa(d.tipo)) { errori.push(CARTA_SOSPESA[d.tipo]); continue; }
    if (!d || !CODICE_PER_DOCUMENTO[d.tipo] || tipiVisti.has(d.tipo)) { errori.push('documento_non_valido'); continue; }
    tipiVisti.add(d.tipo);
    if (!d.testo_legale_id) errori.push('versione_sconosciuta');
  }
  const eData = erroreDataFirma(dataFirma, adesso); if (eData) errori.push(eData);
  const eMotivo = erroreMotivo(motivo, motivoNota); if (eMotivo) errori.push(eMotivo);

  // Il percorso deve essere nel transito di QUESTO paziente, e nient'altro.
  const pathValido = typeof path === 'string' && path.startsWith(cartellaTransito(patient.id))
    && !path.includes('..') && RE_ID.test(path.slice(cartellaTransito(patient.id).length));
  if (!pathValido) return { ok: false, errori: [...new Set([...errori, 'file_mancante'])] };

  // Versioni dall'archivio: devono esistere, essere del documento giusto ed essere
  // state in vigore il giorno della firma.
  const testi = {};
  if (!eData) {
    for (const d of elenco) {
      if (!d || !CODICE_PER_DOCUMENTO[d.tipo] || cartaSospesa(d.tipo) || !d.testo_legale_id) continue;
      let t = null;
      try { t = await testoPerId(String(d.testo_legale_id)); } catch (_) { t = null; }
      if (!t || t.codice !== CODICE_PER_DOCUMENTO[d.tipo]) { errori.push('versione_sconosciuta'); continue; }
      if (!versioneInVigoreIl(t, dataFirma)) { errori.push('versione_non_in_vigore'); continue; }
      testi[d.tipo] = t;
    }
  }

  // Il file: scaricato dal server, letto nei suoi byte.
  let buf = null, tipo = null;
  const { data: blob, error: eDown } = await supabase.storage.from(BUCKET).download(path);
  if (eDown || !blob) errori.push('file_mancante');
  else {
    buf = Buffer.from(await blob.arrayBuffer());
    if (buf.length === 0) errori.push('file_mancante');
    else if (buf.length > BYTE_MAX) errori.push('file_troppo_grande');
    else { tipo = tipoDaiByte(buf); if (!tipo) errori.push('file_tipo_non_ammesso'); }
  }

  if (errori.length) {
    await rimuovi([path]);   // rifiutato: il file non resta, il paziente non cambia
    return { ok: false, errori: [...new Set(errori)] };
  }

  const impronta = crypto.createHash('sha256').update(buf).digest('hex');
  const definitivo = `${patient.id}/${Date.now()}_${impronta.slice(0, 16)}.${tipo.ext}`;
  const { error: eMove } = await supabase.storage.from(BUCKET).move(path, definitivo);
  if (eMove) throw eMove;

  const caricatoIl = adesso.toISOString();
  const nota = (motivo === 'altro' && motivoNota) ? motivoNota.trim().slice(0, 500) : null;
  const copie = elenco.map(d => ({
    id: `cc_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`,
    patient_id: patient.id, client_id: patient.client_id, professional_id: proId,
    documento: d.tipo, testo_legale_id: testi[d.tipo].id, versione: testi[d.tipo].versione,
    data_firma: dataFirma, motivo, motivo_nota: nota,
    file_path: definitivo, file_mime: tipo.mime, file_bytes: buf.length, file_impronta: impronta,
    caricato_il: caricatoIl,
  }));
  const { error: eCopie } = await supabase.from('copie_cartacee').insert(copie);
  if (eCopie) { await rimuovi([definitivo]); throw eCopie; }

  const ipHash = hashIp(ip);
  const documentiScritti = [];
  for (const d of elenco) {
    const t = testi[d.tipo];
    const doc = await upsertPatientDocument(patient.id, patient.client_id, d.tipo, {
      professional_id: proId,
      status: 'signed',
      // La data della firma è quella dichiarata: a mezzogiorno UTC resta lo stesso
      // giorno in Italia. L'ora vera del caricamento è in caricato_il.
      signed_at: `${dataFirma}T12:00:00Z`,
      signature_image: null,
      content_hash: t.impronta,
      testo_legale_id: t.id,
      versione: t.versione,
      modalita: 'carta',
      carta_data_firma: dataFirma,
      carta_motivo: motivo,
      carta_motivo_nota: nota,
      file_path: definitivo,
      file_mime: tipo.mime,
      file_bytes: buf.length,
      file_impronta: impronta,
      caricato_il: caricatoIl,
      ip_hash: ipHash,
      user_agent: userAgent ? String(userAgent).slice(0, 200) : null,
    });
    documentiScritti.push(doc);
    await registraConsensoSoggetto({
      soggettoId: patient.id, testo: t, consenso: CONSENSO_PER_DOCUMENTO[d.tipo], canale: 'carta',
      ipHash, userAgent: userAgent ? String(userAgent).slice(0, 200) : null,
      nota: `Firmato su carta il ${dataFirma} (data dichiarata dall'osteopata); caricato il ${giornoRoma(adesso)}; motivo: ${MOTIVI[motivo]}${nota ? ` — ${nota}` : ''}; file sha256 ${impronta}`,
    });
  }

  await logAccess({
    professional_id: proId, action: 'upload_paper_consent', patient_id: patient.id, ip, user_agent: userAgent,
    details: `Copia cartacea: ${elenco.map(d => d.tipo).join(' + ')} · firmata il ${dataFirma} · sha256 ${impronta.slice(0, 16)}`,
  }).catch(() => {});

  return { ok: true, documenti: documentiScritti, impronta };
}

// Link a breve scadenza (60 s) per aprire una copia; l'apertura si registra.
export async function linkCopia({ filePath, patientId, chi, ip, userAgent }) {
  if (!filePath || !filePath.startsWith(`${patientId}/`)) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 60);
  if (error) throw error;
  await logAccess({
    professional_id: chi.proId || null, action: 'view_paper_consent', patient_id: patientId, ip, user_agent: userAgent,
    details: `Apertura copia cartacea${chi.admin ? ` (amministratore ${chi.admin})` : ''}`,
  }).catch(() => {});
  return data.signedUrl;
}

// Tutti i file del paziente, archiviati e in transito: per la procedura di
// cancellazione dell'amministratore.
export async function rimuoviFilePaziente(patientId) {
  if (!RE_ID.test(patientId)) return;
  for (const cartella of [patientId, `${TRANSITO}/${patientId}`]) {
    const { data } = await supabase.storage.from(BUCKET).list(cartella, { limit: 1000 }).catch(() => ({ data: [] }));
    await rimuovi((data || []).filter(f => f.id).map(f => `${cartella}/${f.name}`));
  }
}
