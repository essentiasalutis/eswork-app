// ─────────────────────────────────────────────────────────────────────────────
// Azienda demo permanente (v78) — lato server. Per i convegni: la sala compila il
// check-up da un QR, si mostra dal vivo il report di Attivazione, poi si azzera.
// L'azzeramento ha tre controlli: la pagina chiede di scrivere il nome dell'azienda,
// qui si verifica che sia la demo permanente, e la funzione della banca dati
// (azzera_demo_permanente) si rifiuta per qualunque altra azienda.
// ─────────────────────────────────────────────────────────────────────────────
import supabase from './db';

const MIGRATION = 'Serve la migration v78 (azienda demo permanente): applicala in Supabase e riprova.';
const colonnaMancante = e => /column .* does not exist|demo_permanente/i.test((e && e.message) || '');
const SETTORI = { services: 2, manufacturing: 1 };

export async function getDemo() {
  const { data: client, error } = await supabase.from('clients').select('*').eq('demo_permanente', true).maybeSingle();
  if (error) return { errore: colonnaMancante(error) ? MIGRATION : error.message };
  if (!client) return { errore: MIGRATION };
  const [{ data: scheda }, { data: checkup }, { data: report }] = await Promise.all([
    supabase.from('first_meetings').select('id, data').eq('client_id', client.id).maybeSingle(),
    supabase.from('assessments').select('id, status, created_at, chiude_il').eq('client_id', client.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('generated_reports').select('id, report_type, created_at, pdf_url, ai_status').eq('client_id', client.id).order('created_at', { ascending: false }),
  ]);
  const risposte = checkup
    ? (await supabase.from('responses').select('id', { count: 'exact', head: true }).eq('assessment_id', checkup.id)).count || 0
    : 0;
  const settore = (scheda && scheda.data && scheda.data.step1 && scheda.data.step1.sector) || (client.sector === 1 ? 'manufacturing' : 'services');
  return {
    client: { id: client.id, name: client.name, employees: client.employees, share_code: client.assessment_share_code, mostraPrezzo: client.demo_mostra_prezzo !== false },
    settore, risposte,
    checkup: checkup || null,
    report: report || [],
  };
}

// Nome, popolazione e settore dell'evento: anagrafica e scheda del colloquio insieme,
// perché dicano la stessa cosa (la scheda alimenta la parte economica del report).
export async function aggiornaDemo({ nome, dipendenti, settore }) {
  const d = await getDemo();
  if (d.errore) return { ok: false, status: 409, errore: d.errore };
  const n = parseInt(dipendenti, 10);
  const nomeOk = String(nome || '').trim();
  if (nomeOk.length < 2 || nomeOk.length > 80) return { ok: false, status: 422, errore: 'Scrivi il nome dell\'azienda (da 2 a 80 caratteri).' };
  if (!(n >= 1 && n <= 5000)) return { ok: false, status: 422, errore: 'La popolazione va da 1 a 5000 dipendenti.' };
  if (!(settore in SETTORI)) return { ok: false, status: 422, errore: 'Settore non valido.' };
  const { error: e1 } = await supabase.from('clients').update({ name: nomeOk, employees: n, sector: SETTORI[settore] }).eq('id', d.client.id);
  if (e1) return { ok: false, status: 500, errore: e1.message };
  const { data: fm } = await supabase.from('first_meetings').select('id, data').eq('client_id', d.client.id).maybeSingle();
  if (fm) {
    const data = fm.data || {};
    const s2 = data.step2 || {};
    // Ergonomia d'ufficio: stessa regola della pagina del colloquio in modalità
    // automatica (popolazione meno addetti di reparto). Senza, il report citava le
    // persone della popolazione precedente (camminata 21/9: 105 su 80 dipendenti).
    const ergoAuto = s2.ergonomia_ufficio_auto !== false;
    const nuovo = {
      ...data,
      step1: { ...(data.step1 || {}), nome: nomeOk, sector: settore },
      step2: {
        ...s2,
        sedi: [{ nome: 'Sede principale', employees: n }],
        ...(ergoAuto ? { ergonomia_ufficio: Math.max(0, n - (parseInt(s2.ergonomia_addetti, 10) || 0)) } : {}),
      },
    };
    // La Stima congelata della demo nasce dal primo report: con un evento nuovo non
    // vale più (come nell'azzeramento), il prossimo report la ricongela.
    const { error: e2 } = await supabase.from('first_meetings').update({ data: nuovo, employees: n, sector: SETTORI[settore], stima_snapshot: null, updated_at: new Date().toISOString() }).eq('id', fm.id);
    if (e2) return { ok: false, status: 500, errore: e2.message };
  }
  return { ok: true };
}

export async function impostaPrezzo(mostra) {
  const d = await getDemo();
  if (d.errore) return { ok: false, status: 409, errore: d.errore };
  const { error } = await supabase.from('clients').update({ demo_mostra_prezzo: !!mostra }).eq('id', d.client.id);
  return error ? { ok: false, status: 500, errore: error.message } : { ok: true };
}

// Azzeramento: la conferma è il nome dell'azienda scritto per intero.
export async function azzeraDemo({ conferma }) {
  const d = await getDemo();
  if (d.errore) return { ok: false, status: 409, errore: d.errore };
  if (String(conferma || '').trim() !== d.client.name) {
    return { ok: false, status: 422, errore: `Per confermare scrivi esattamente il nome dell'azienda: «${d.client.name}».` };
  }
  // PDF dei report nell'archivio: si cancellano prima (la banca dati non li raggiunge).
  const { data: doc } = await supabase.from('documents').select('file_url').eq('client_id', d.client.id);
  const url = [...(d.report || []).map(r => r.pdf_url), ...(doc || []).map(x => x.file_url)].filter(Boolean);
  let pdfNonCancellati = 0;
  if (url.length && process.env.BLOB_READ_WRITE_TOKEN) {
    try { const { del } = await import('@vercel/blob'); await del(url); }
    catch (e) { pdfNonCancellati = url.length; console.error('[demo] PDF non cancellati:', e.message); }
  } else if (url.length) pdfNonCancellati = url.length;
  const { data, error } = await supabase.rpc('azzera_demo_permanente', { p_client: d.client.id });
  if (error) return { ok: false, status: 500, errore: `Azzeramento non riuscito, niente è stato cancellato in banca dati: ${error.message}` };
  return { ok: true, esito: data, pdfNonCancellati };
}
