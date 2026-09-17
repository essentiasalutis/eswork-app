// ─────────────────────────────────────────────────────────────────────────────
// Accordo sul trattamento dei dati del professionista — lato server.
// Regola pura in lib/accordo.mjs. Garanzie in banca dati (v64 registro, v66 file).
//
//   · la SPUNTA è una riga del registro dei consensi (soggetto professionista),
//     solo dal login del professionista;
//   · il FILE firmato passa da un'area di transito: il server ne legge tipo,
//     dimensione e impronta, poi lo archivia. Il professionista o l'admin (con la
//     dicitura). Nessun file precedente si cancella.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import supabase from './db';
import { hashIp } from './crypto-utils';
import { testoAccettabile, registraConsensoSoggetto, testoPerId, perIlBrowser } from './testi-legali-server';
import { CODICE_ACCORDO, CONSENSO_ACCORDO, statoAccordo } from './accordo.mjs';
import { tipoDaiByte, BYTE_MAX } from './copia-cartacea.mjs';

const BUCKET = 'pro-documents';
const MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const RE_ID = /^[A-Za-z0-9_-]+$/;
const transito = (proId) => `${proId}/accordo-transito/`;

export async function versioniAccordo() {
  const { data, error } = await supabase.from('testi_legali')
    .select('id, versione, stato, pubblicato_il, ritirato_il, impronta')
    .eq('codice', CODICE_ACCORDO).neq('stato', 'bozza')
    .order('pubblicato_il', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Stato dell'accordo per più professionisti in una volta: { [proId]: esito }.
export async function statiAccordo(proIds, adesso = new Date()) {
  const ids = [...new Set((proIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const [versioni, firmeR, fileR] = await Promise.all([
    versioniAccordo(),
    supabase.from('consensi_registrati').select('soggetto_id, testo_legale_id, valore, atto_at')
      .eq('soggetto_tipo', 'professionista').eq('codice', CODICE_ACCORDO).in('soggetto_id', ids),
    supabase.from('accordi_trattamento_file').select('id, professional_id, testo_legale_id, versione, caricato_il, caricato_da, file_bytes, file_mime')
      .in('professional_id', ids),
  ]);
  if (firmeR.error) throw firmeR.error;
  if (fileR.error) throw fileR.error;
  const out = {};
  for (const id of ids) {
    const firme = (firmeR.data || []).filter(f => f.soggetto_id === id);
    const file = (fileR.data || []).filter(f => f.professional_id === id);
    out[id] = { ...statoAccordo({ versioni, firme, file, adesso }), firme, file };
  }
  return out;
}

export async function statoAccordoPro(proId) {
  return (await statiAccordo([proId]))[proId];
}

// Testo in vigore da mostrare al professionista (o null se non pubblicato).
export async function testoAccordoInVigore() {
  const v = (await versioniAccordo()).find(x => x.stato === 'in_vigore');
  return v ? perIlBrowser(await testoPerId(v.id)) : null;
}

// SPUNTA: solo il professionista, solo sulla versione in vigore (o appena ritirata).
export async function sottoscriviAccordo({ proId, testoId, ip, userAgent }) {
  const testo = await testoAccettabile(testoId, CODICE_ACCORDO);
  if (!testo) return { ok: false, errore: 'versione_non_valida' };
  const stato = await statoAccordoPro(proId);
  const giaFirmato = (stato.firme || []).filter(f => f.testo_legale_id === testo.id)
    .sort((a, b) => Date.parse(a.atto_at) - Date.parse(b.atto_at)).pop();
  if (giaFirmato && giaFirmato.valore === 'dato') return { ok: true, gia: true, versione: testo.versione };
  await registraConsensoSoggetto({
    soggettoTipo: 'professionista', soggettoId: proId, testo, consenso: CONSENSO_ACCORDO,
    canale: 'area_professionista', ipHash: hashIp(ip), userAgent: userAgent ? String(userAgent).slice(0, 200) : null,
  });
  return { ok: true, versione: testo.versione };
}

// FILE — 1. link per caricare nel transito.
export async function preparaFileAccordo(proId, contentType) {
  if (!RE_ID.test(proId)) throw new Error('professionista non valido');
  if (!MIME.includes(contentType)) return { ok: false, errore: 'Il file non è un PDF, un JPG o un PNG.' };
  const path = `${transito(proId)}${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { ok: true, path, signed_url: data.signedUrl };
}

// FILE — 2. verifica e archivia. caricatoDa: 'professionista' | 'admin:<email>'.
export async function accettaFileAccordo({ proId, path, testoId, caricatoDa, ip, userAgent }) {
  const rimuovi = () => supabase.storage.from(BUCKET).remove([path]).then(() => {}, () => {});
  const pathOk = typeof path === 'string' && path.startsWith(transito(proId)) && RE_ID.test(path.slice(transito(proId).length));
  if (!pathOk) return { ok: false, errore: 'Il file non è arrivato: caricalo di nuovo.' };

  let testo = null;
  try { testo = testoId ? await testoPerId(String(testoId)) : null; } catch (_) { testo = null; }
  if (!testo || testo.codice !== CODICE_ACCORDO || testo.stato === 'bozza') {
    await rimuovi();
    return { ok: false, errore: 'Indica la versione dell\'accordo che è stata firmata.' };
  }

  const { data: blob, error: eDown } = await supabase.storage.from(BUCKET).download(path);
  if (eDown || !blob) return { ok: false, errore: 'Il file non è arrivato: caricalo di nuovo.' };
  const buf = Buffer.from(await blob.arrayBuffer());
  const tipo = buf.length ? tipoDaiByte(buf) : null;
  if (!buf.length || buf.length > BYTE_MAX || !tipo) {
    await rimuovi();
    return { ok: false, errore: buf.length > BYTE_MAX ? 'Il file supera i 10 MB.' : 'Il file non è un PDF, un JPG o un PNG.' };
  }

  const impronta = crypto.createHash('sha256').update(buf).digest('hex');
  const definitivo = `${proId}/accordo/${Date.now()}_${impronta.slice(0, 16)}.${tipo.ext}`;
  const { error: eMove } = await supabase.storage.from(BUCKET).move(path, definitivo);
  if (eMove) throw eMove;

  const riga = {
    id: `acf_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`,
    professional_id: proId, testo_legale_id: testo.id, versione: testo.versione,
    file_path: definitivo, file_mime: tipo.mime, file_bytes: buf.length, file_impronta: impronta,
    caricato_da: caricatoDa,
  };
  const { error } = await supabase.from('accordi_trattamento_file').insert(riga);
  if (error) { await supabase.storage.from(BUCKET).remove([definitivo]).then(() => {}, () => {}); throw error; }

  const admin = caricatoDa.startsWith('admin:');
  await supabase.from('pro_document_access_log').insert({
    id: `pdl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    professional_id: proId, doc_type: 'accordo_trattamento_dati', action: 'upload_pro_doc',
    actor_type: admin ? 'admin' : 'pro', actor_id: admin ? caricatoDa.slice(6) : proId,
    ip_hash: hashIp(ip), user_agent: userAgent ? String(userAgent).slice(0, 200) : null,
  }).then(() => {}, () => {});
  return { ok: true, file: { ...riga, file_path: undefined } };
}

// Link di 60 s a un file dell'accordo; l'apertura si registra.
export async function linkFileAccordo({ fileId, proId, chi, ip, userAgent }) {
  const { data } = await supabase.from('accordi_trattamento_file').select('file_path, professional_id').eq('id', fileId).maybeSingle();
  if (!data || (proId && data.professional_id !== proId)) return null;
  const { data: s, error } = await supabase.storage.from(BUCKET).createSignedUrl(data.file_path, 60);
  if (error) throw error;
  await supabase.from('pro_document_access_log').insert({
    id: `pdl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    professional_id: data.professional_id, doc_type: 'accordo_trattamento_dati', action: 'view_pro_doc',
    actor_type: chi.admin ? 'admin' : 'pro', actor_id: chi.admin || chi.proId,
    ip_hash: hashIp(ip), user_agent: userAgent ? String(userAgent).slice(0, 200) : null,
  }).then(() => {}, () => {});
  return s.signedUrl;
}
