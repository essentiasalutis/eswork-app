// ─────────────────────────────────────────────────────────────────────────────
// MEDICO COMPETENTE — lato server. Regole pure in lib/medico-competente.mjs,
// garanzie in banca dati (v73). Decisioni di Enrico (21/9).
//
// Il medico legge SOLO:
//   · la Sintesi sanitaria (datiPresentazione → vistaRiservata, le stesse funzioni e
//     le stesse soglie dell'azienda, senza sezioni commerciali);
//   · i report T3, T6 e Annuale VALIDATI (gli stessi documenti consegnati all'azienda).
// Il report di Attivazione resta fuori: prezzo e clinica sono mescolati nel testo.
// Ogni documento si controlla prima di servirlo: con un termine commerciale non esce.
// Ogni accesso, riuscito o rifiutato, finisce nel registro (mc_accessi).
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import supabase from './db';
import { hashIp } from './crypto-utils';
import { tipoDaiByte, BYTE_MAX } from './copia-cartacea.mjs';
import { requisitiAssegnazione, validaIndicazione, paroleDaNomi, terminiCommerciali, DOCUMENTI_MC } from './medico-competente.mjs';
import { K_ANON } from './kanon';

const BUCKET = 'pro-documents';
const MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const RE_ID = /^[A-Za-z0-9_-]+$/;
const id = (p) => `${p}_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;

// Report che il medico può leggere: solo quelli di monitoraggio.
export const REPORT_PER_MEDICO = ['checkpoint_t3', 'checkpoint_t6', 'checkpoint_t12'];
export const ETICHETTE_REPORT = { checkpoint_t3: 'Report intermedio a 3 mesi', checkpoint_t6: 'Report intermedio a 6 mesi', checkpoint_t12: 'Report annuale' };

// ─── Medici ──────────────────────────────────────────────────────────────────
export async function medicoPerEmail(email) {
  const { data } = await supabase.from('medici_competenti').select('*').eq('email', String(email || '').trim().toLowerCase()).maybeSingle();
  return data || null;
}

// Il medico come lo vede il server a ogni richiesta: esiste ed è attivo.
export async function medicoAttivo(medicoId) {
  if (!medicoId || !RE_ID.test(medicoId)) return null;
  const { data } = await supabase.from('medici_competenti').select('id, nome, email, attivo, must_reset_password').eq('id', medicoId).maybeSingle();
  return data && data.attivo ? data : null;
}

export async function creaMedico({ nome, email, passwordHash }) {
  const riga = { id: id('mc'), nome: String(nome || '').trim(), email: String(email || '').trim().toLowerCase(), password_hash: passwordHash, must_reset_password: true };
  const { data, error } = await supabase.from('medici_competenti').insert(riga).select('id, nome, email, attivo, must_reset_password, creato_il').single();
  if (error) throw error;
  return data;
}

export async function aggiornaMedico(medicoId, campi) {
  const { error } = await supabase.from('medici_competenti').update(campi).eq('id', medicoId);
  if (error) throw error;
}

// ─── Relazioni con le aziende ────────────────────────────────────────────────
export async function aziendeDelMedico(medicoId) {
  const { data: rel } = await supabase.from('medico_aziende').select('client_id, dal').eq('medico_id', medicoId).is('revocato_il', null);
  const ids = (rel || []).map(r => r.client_id);
  if (!ids.length) return [];
  const { data: cl } = await supabase.from('clients').select('id, name').in('id', ids);
  const nomi = Object.fromEntries((cl || []).map(c => [c.id, c.name]));
  return (rel || []).filter(r => nomi[r.client_id]).map(r => ({ clientId: r.client_id, nome: nomi[r.client_id], dal: r.dal }));
}

// Controllato a OGNI richiesta: una revoca vale dalla richiesta successiva.
export async function relazioneAttiva(medicoId, clientId) {
  if (!medicoId || !clientId || !RE_ID.test(String(clientId))) return false;
  const { data } = await supabase.from('medico_aziende').select('id').eq('medico_id', medicoId).eq('client_id', clientId).is('revocato_il', null).maybeSingle();
  return !!data;
}

async function contenutoInformativaInVigore() {
  const { data } = await supabase.from('testi_legali').select('contenuto').eq('codice', 'informativa_checkup').eq('stato', 'in_vigore').order('pubblicato_il', { ascending: false }).limit(1).maybeSingle();
  return data ? data.contenuto : null;
}

export async function informativaPronta() {
  return requisitiAssegnazione({ isDemo: false, contenutoInformativa: await contenutoInformativaInVigore(), tipiDocumenti: ['accordo', 'dichiarazione_presidi'] }).ok;
}

export async function assegna({ medicoId, clientId, admin }) {
  const [{ data: cliente }, medico, { data: docs }] = await Promise.all([
    supabase.from('clients').select('id, is_demo').eq('id', clientId).maybeSingle(),
    medicoAttivo(medicoId),
    supabase.from('mc_documenti').select('tipo').eq('medico_id', medicoId),
  ]);
  if (!cliente) return { ok: false, errore: 'Azienda non trovata.' };
  if (!medico) return { ok: false, errore: 'Medico non trovato o disattivato.' };
  const req = requisitiAssegnazione({ isDemo: !!cliente.is_demo, contenutoInformativa: await contenutoInformativaInVigore(), tipiDocumenti: (docs || []).map(d => d.tipo) });
  if (!req.ok) return { ok: false, errore: req.messaggio, mancanti: req.mancanti };
  if (await relazioneAttiva(medicoId, clientId)) return { ok: false, errore: 'Il medico è già assegnato a questa azienda.' };
  const { error } = await supabase.from('medico_aziende').insert({ id: id('mca'), medico_id: medicoId, client_id: clientId, assegnato_da: `admin:${admin}` });
  if (error) return { ok: false, errore: `Assegnazione non registrata: ${error.message}` };
  return { ok: true };
}

export async function revoca({ relazioneId, admin }) {
  const { error } = await supabase.from('medico_aziende').update({ revocato_il: new Date().toISOString(), revocato_da: `admin:${admin}` }).eq('id', relazioneId).is('revocato_il', null);
  if (error) return { ok: false, errore: error.message };
  return { ok: true };
}

// ─── Registro ────────────────────────────────────────────────────────────────
export async function registra({ medicoId, clientId = null, azione, dettaglio = null, esito = 'ok', ip = null, userAgent = null }) {
  await supabase.from('mc_accessi').insert({
    id: id('mcl'), medico_id: medicoId, client_id: clientId, azione, dettaglio, esito,
    ip_hash: ip ? hashIp(ip) : null, user_agent: userAgent ? String(userAgent).slice(0, 200) : null,
  }).then(() => {}, () => {});
}

// ─── Documenti del medico (accordo, dichiarazione dei presidi) ───────────────
const transito = (medicoId) => `medici-competenti/${medicoId}/transito/`;

export async function preparaDocumento(medicoId, contentType) {
  if (!RE_ID.test(medicoId)) throw new Error('medico non valido');
  if (!MIME.includes(contentType)) return { ok: false, errore: 'Il file non è un PDF, un JPG o un PNG.' };
  const path = `${transito(medicoId)}${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { ok: true, path, signed_url: data.signedUrl };
}

export async function accettaDocumento({ medicoId, path, tipo, dataFirma, admin }) {
  // Prima di tutto: il percorso deve stare nel transito di QUESTO medico. Solo dopo
  // si può rimuovere qualcosa (mai un file fuori dal transito).
  const pathOk = typeof path === 'string' && RE_ID.test(medicoId) && path.startsWith(transito(medicoId)) && RE_ID.test(path.slice(transito(medicoId).length));
  if (!pathOk) return { ok: false, errore: 'Il file non è arrivato: caricalo di nuovo.' };
  const rimuovi = () => supabase.storage.from(BUCKET).remove([path]).then(() => {}, () => {});
  if (!DOCUMENTI_MC[tipo]) { await rimuovi(); return { ok: false, errore: 'Tipo di documento non valido.' }; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataFirma || '')) || dataFirma > new Date().toISOString().slice(0, 10)) {
    await rimuovi(); return { ok: false, errore: 'Indica la data della firma (non nel futuro).' };
  }
  const { data: blob, error: eDown } = await supabase.storage.from(BUCKET).download(path);
  if (eDown || !blob) return { ok: false, errore: 'Il file non è arrivato: caricalo di nuovo.' };
  const buf = Buffer.from(await blob.arrayBuffer());
  const t = buf.length ? tipoDaiByte(buf) : null;
  if (!buf.length || buf.length > BYTE_MAX || !t) { await rimuovi(); return { ok: false, errore: buf.length > BYTE_MAX ? 'Il file supera i 10 MB.' : 'Il file non è un PDF, un JPG o un PNG.' }; }
  const impronta = crypto.createHash('sha256').update(buf).digest('hex');
  const definitivo = `medici-competenti/${medicoId}/${tipo}/${Date.now()}_${impronta.slice(0, 16)}.${t.ext}`;
  const { error: eMove } = await supabase.storage.from(BUCKET).move(path, definitivo);
  if (eMove) throw eMove;
  const riga = { id: id('mcd'), medico_id: medicoId, tipo, file_path: definitivo, file_mime: t.mime, file_bytes: buf.length, file_impronta: impronta, data_firma: dataFirma, caricato_da: `admin:${admin}` };
  const { error } = await supabase.from('mc_documenti').insert(riga);
  if (error) { await supabase.storage.from(BUCKET).remove([definitivo]).then(() => {}, () => {}); throw error; }
  return { ok: true };
}

export async function linkDocumento(documentoId) {
  const { data } = await supabase.from('mc_documenti').select('file_path').eq('id', documentoId).maybeSingle();
  if (!data) return null;
  const { data: s, error } = await supabase.storage.from(BUCKET).createSignedUrl(data.file_path, 60);
  if (error) throw error;
  return s.signedUrl;
}

// ─── Reparti e mansioni (coordinamento) ──────────────────────────────────────
export async function reparti(clientId, { soloAttivi = true } = {}) {
  let q = supabase.from('mc_reparti').select('id, tipo, nome, attivo, creato_il, disattivato_il').eq('client_id', clientId).order('tipo').order('nome');
  if (soloAttivi) q = q.eq('attivo', true);
  const { data } = await q;
  return data || [];
}

export async function creaReparto({ clientId, tipo, nome }) {
  const n = String(nome || '').trim().replace(/\s+/g, ' ');
  if (!['reparto', 'mansione'].includes(tipo)) return { ok: false, errore: 'Scegli reparto o mansione.' };
  if (n.length < 2 || n.length > 80) return { ok: false, errore: 'Il nome va da 2 a 80 caratteri.' };
  const { error } = await supabase.from('mc_reparti').insert({ id: id('mcr'), client_id: clientId, tipo, nome: n });
  if (error) return { ok: false, errore: /uq_mc_reparti_nome/.test(error.message) ? 'Esiste già con questo nome.' : error.message };
  return { ok: true };
}

export async function disattivaReparto(repartoId) {
  const { error } = await supabase.from('mc_reparti').update({ attivo: false, disattivato_il: new Date().toISOString() }).eq('id', repartoId).eq('attivo', true);
  if (error) return { ok: false, errore: error.message };
  return { ok: true };
}

// ─── Indicazioni del medico ──────────────────────────────────────────────────
// Parole da non ammettere nel testo: nomi e cognomi dell'anagrafica organizzativa e
// dei pazienti di QUELL'azienda. Si leggono solo qui, lato server: non escono mai.
async function paroleVietate(clientId) {
  const [{ data: dip }, { data: paz }] = await Promise.all([
    supabase.from('org_dipendente').select('nome').eq('client_id', clientId),
    supabase.from('patients').select('first_name, last_name').eq('client_id', clientId),
  ]);
  return paroleDaNomi([...(dip || []).map(d => d.nome), ...(paz || []).flatMap(p => [p.first_name, p.last_name])]);
}

export async function creaIndicazione({ medicoId, clientId, repartoId, testo }) {
  const { data: r } = await supabase.from('mc_reparti').select('id, client_id, tipo, nome, attivo').eq('id', String(repartoId || '')).maybeSingle();
  if (!r || r.client_id !== clientId || !r.attivo) return { ok: false, errore: 'Scegli un reparto o una mansione dall\'elenco.' };
  const v = validaIndicazione(testo, await paroleVietate(clientId));
  if (!v.ok) return { ok: false, errore: v.errore };
  const { error } = await supabase.from('mc_indicazioni').insert({ id: id('mci'), medico_id: medicoId, client_id: clientId, reparto_id: r.id, reparto_tipo: r.tipo, reparto_nome: r.nome, testo: v.testo });
  if (error) return { ok: false, errore: `Indicazione non registrata: ${error.message}` };
  return { ok: true };
}

// Per il medico: le proprie indicazioni, senza la marcatura (è una valutazione interna).
export async function indicazioniDelMedico(medicoId, clientId) {
  const { data } = await supabase.from('mc_indicazioni').select('id, reparto_tipo, reparto_nome, testo, creato_il').eq('medico_id', medicoId).eq('client_id', clientId).order('creato_il', { ascending: false });
  return data || [];
}

// Per il coordinamento: tutte, con la marcatura e il nome del medico.
export async function indicazioniPerAzienda(clientId) {
  const { data } = await supabase.from('mc_indicazioni').select('*').eq('client_id', clientId).order('creato_il', { ascending: false });
  const ids = [...new Set((data || []).map(i => i.medico_id))];
  const { data: med } = ids.length ? await supabase.from('medici_competenti').select('id, nome').in('id', ids) : { data: [] };
  const nomi = Object.fromEntries((med || []).map(m => [m.id, m.nome]));
  return (data || []).map(i => ({ ...i, medico: nomi[i.medico_id] || i.medico_id }));
}

export async function marcaNonUtilizzabile({ indicazioneId, admin, motivo }) {
  const m = String(motivo || '').trim();
  if (m.length < 3) return { ok: false, errore: 'Scrivi il motivo (almeno 3 caratteri).' };
  const { error } = await supabase.from('mc_indicazioni').update({ non_utilizzabile_il: new Date().toISOString(), non_utilizzabile_da: `admin:${admin}`, non_utilizzabile_motivo: m }).eq('id', indicazioneId).is('non_utilizzabile_il', null);
  if (error) return { ok: false, errore: error.message };
  return { ok: true };
}

// ─── Documenti per il medico (flusso A) ──────────────────────────────────────
// Sintesi sanitaria: stessa funzione dell'azienda (datiPresentazione), impaginata
// senza le sezioni commerciali. Con un termine commerciale non esce.
export async function sintesiPerMedico(clientId) {
  const [{ datiPresentazione }, { buildSintesiSanitariaHtml, datiSanitariSintesi }] = await Promise.all([
    import('./presentazione-server'), import('./sintesi'),
  ]);
  const d = await datiPresentazione(clientId).catch(e => ({ errore: e.message }));
  if (!d || d.errore) return { html: null, motivo: d && d.errore ? d.errore : 'Dati non disponibili.' };
  const html = buildSintesiSanitariaHtml(datiSanitariSintesi(d));
  const trovati = terminiCommerciali(html);
  if (trovati.length) return { html: null, motivo: 'Documento trattenuto: contiene termini commerciali.', trattenuto: trovati };
  return { html };
}

// Elenco dei report che il medico può aprire: monitoraggio, validati.
export async function reportPerMedico(clientId) {
  const { data } = await supabase.from('generated_reports').select('id, report_type, created_at, validato_da, validato_il')
    .eq('client_id', clientId).in('report_type', REPORT_PER_MEDICO).not('validato_il', 'is', null).order('created_at', { ascending: false });
  return (data || []).map(r => ({ id: r.id, tipo: r.report_type, etichetta: ETICHETTE_REPORT[r.report_type], data: r.created_at, validato_il: r.validato_il }));
}

// Un report: lo stesso HTML del PDF consegnato all'azienda (buildReportHtml sul testo
// con la riga di validazione). Solo se dell'azienda, di monitoraggio e validato.
export async function reportHtmlPerMedico(clientId, reportId) {
  const { data: rec } = await supabase.from('generated_reports').select('*').eq('id', String(reportId || '')).maybeSingle();
  if (!rec || rec.client_id !== clientId || !REPORT_PER_MEDICO.includes(rec.report_type) || !rec.validato_il) return { html: null, motivo: 'Report non disponibile.' };
  const [{ buildReportHtml }, { testoConValidazione }, { getClientById }] = await Promise.all([import('./pdf'), import('./validazione'), import('./store')]);
  const client = await getClientById(clientId);
  const html = buildReportHtml({ client, report_type: rec.report_type, content_text: testoConValidazione(rec.content_text, rec), checkpoint: rec.checkpoint });
  const trovati = terminiCommerciali(html);
  if (trovati.length) return { html: null, motivo: 'Documento trattenuto: contiene termini commerciali.', trattenuto: trovati };
  return { html, tipo: rec.report_type };
}

// ─── Contributo alla riunione periodica (art. 35 D.Lgs. 81/08) ──────────────
// Copertina + Sintesi sanitaria (stessi blocchi e dati) + testi dei report validati
// convertiti con la stessa funzione del PDF dell'azienda. La copertina non aggiunge
// numeri. Controllato come ogni altro documento del medico.
export async function riunioneHtmlPerMedico(clientId) {
  const [{ datiPresentazione }, { blocchiSanitari, datiSanitariSintesi, STILE_SANITARIO }, { markdownToHtml }, { testoConValidazione }, { dataIt }] = await Promise.all([
    import('./presentazione-server'), import('./sintesi'), import('./pdf'), import('./validazione'), import('./date-it.mjs'),
  ]);
  const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const d = await datiPresentazione(clientId).catch(e => ({ errore: e.message }));
  const ds = d && !d.errore ? datiSanitariSintesi(d) : null;
  const { data: recs } = await supabase.from('generated_reports').select('report_type, content_text, created_at, validato_da, validato_il')
    .eq('client_id', clientId).in('report_type', REPORT_PER_MEDICO).not('validato_il', 'is', null).order('created_at', { ascending: true });
  const { data: cliente } = await supabase.from('clients').select('name').eq('id', clientId).maybeSingle();
  const oggi = dataIt(new Date(), { day: 'numeric', month: 'long', year: 'numeric' });
  const report = (recs || []).map(r => `<section class="doc"><div class="k">${esc(ETICHETTE_REPORT[r.report_type])} · ${esc(dataIt(r.created_at))}</div><div class="md">${markdownToHtml(testoConValidazione(r.content_text, r))}</div></section>`).join('');
  const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><style>${STILE_SANITARIO}
  .cop { border-bottom: 3px solid #16a34a; padding-bottom: 14px; margin-bottom: 18px; }
  .cop h1 { font-size: 20px; margin-bottom: 4px; } .cop .muted { font-size: 12px; }
  .nota { background: #f8fafc; border-left: 4px solid #16a34a; padding: 10px 14px; border-radius: 0 10px 10px 0; margin: 10px 0 18px; }
  .doc { page-break-before: always; } .doc .k { font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #16a34a; margin-bottom: 8px; }
  .md h2 { font-size: 13px; margin: 14px 0 6px; } .md h3 { font-size: 12px; margin: 10px 0 4px; } .md p { margin-bottom: 8px; } .md ul { margin: 0 0 8px 16px; }
</style></head><body>
  <div class="cop">
    <div class="brand">ES <span>Work</span></div>
    <h1>Contributo del programma ES Work alla riunione periodica</h1>
    <div class="muted">art. 35 D.Lgs. 81/08 · ${esc(cliente ? cliente.name : '')} · ${esc(oggi)}</div>
  </div>
  <div class="nota">Dati aggregati del programma: nessun dato individuale. I gruppi con meno di ${K_ANON} persone non sono mostrati. Il documento riporta la sintesi del check-up e i report di monitoraggio consegnati all'azienda.</div>
  ${ds ? blocchiSanitari(ds) : '<div class="muted">Sintesi del check-up non disponibile.</div>'}
  ${report || '<div class="muted" style="margin-top:12px">Nessun report di monitoraggio consegnato finora.</div>'}
</body></html>`;
  const trovati = terminiCommerciali(html);
  if (trovati.length) return { html: null, motivo: 'Documento trattenuto: contiene termini commerciali.', trattenuto: trovati };
  return { html, nomeFile: `riunione_art35_${clientId}_${Date.now()}.pdf` };
}
