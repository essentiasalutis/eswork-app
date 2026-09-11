// ─────────────────────────────────────────────────────────────────────────────
// Check-up — accesso dati (server, service_role). La REGOLA sta in lib/checkup.js;
// qui solo le letture che servono a calcolarla e le scritture tolleranti a una
// migration v51 non ancora applicata (stesso schema di v50 in lib/org.js).
// ─────────────────────────────────────────────────────────────────────────────
import supabase from './db';
import { statoCheckup, sollecitoDovuto, giorniAllaChiusura, testoSollecito } from './checkup';

// "Contratto firmato" nel codice: pipeline 'signed' (o il vecchio 'active', vedi finance.js).
export function isFirmato(client) {
  return !!client && (client.pipeline_stage === 'signed' || client.pipeline_stage === 'active');
}

// Check-up CORRENTE = il più recente dell'azienda, qualunque sia lo stato.
export async function getCheckupCorrente(client_id) {
  const { data, error } = await supabase.from('assessments')
    .select('*').eq('client_id', client_id).order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  return (data && data[0]) || null;
}

// Report di Attivazione generato DOPO l'avvio di questo check-up: da lì l'analisi è
// congelata. Legato al check-up e non all'azienda: il Report dell'anno 1 non deve
// bloccare il check-up dell'anno 2 ("nuovo ciclo annuale").
export async function reportAttivazioneDopo(client_id, sinceIso) {
  if (!sinceIso) return false;
  const { data, error } = await supabase.from('generated_reports')
    .select('id').eq('client_id', client_id).eq('report_type', 'activation').gte('created_at', sinceIso).limit(1);
  if (error) throw error;
  return !!(data && data.length);
}

export async function statoCheckupCliente(client, { conGrazia = false, now = new Date() } = {}) {
  const assessment = await getCheckupCorrente(client.id);
  const reportDopo = assessment ? await reportAttivazioneDopo(client.id, assessment.created_at) : false;
  return { ...statoCheckup({ assessment, reportDopo, firmato: isFirmato(client), now, conGrazia }), assessment, reportDopo };
}

// Colonne di v51 (scadenza, chiusura a mano, solleciti). Se la migration non è
// ancora applicata PostgREST risponde PGRST204 / 42703: si riprova senza.
const V51 = ['chiude_il', 'chiuso_at', 'sollecito_meta_at', 'sollecito_finale_at'];
const colonnaMancante = (e) => !!e && (e.code === 'PGRST204' || e.code === '42703');

export async function scriviAssessmentTollerante(op, fields, id = null) {
  const run = (f) => (op === 'insert'
    ? supabase.from('assessments').insert(f).select().single()
    : supabase.from('assessments').update(f).eq('id', id).select().single());
  let { data, error } = await run(fields);
  let v51Mancante = false;
  if (colonnaMancante(error)) {
    v51Mancante = true;
    const ridotti = { ...fields };
    for (const k of V51) delete ridotti[k];
    if (Object.keys(ridotti).length === 0) return { data: null, v51Mancante };
    ({ data, error } = await run(ridotti));
  }
  if (error) throw error;
  return { data, v51Mancante };
}

// Numero di questionari arrivati in un check-up (per il tasso di risposta).
export async function contaRisposte(assessment_id) {
  const { count, error } = await supabase.from('responses')
    .select('id', { count: 'exact', head: true }).eq('assessment_id', assessment_id);
  if (error) throw error;
  return count || 0;
}

// Solleciti da fare OGGI (dashboard "Da sollecitare"): check-up aperti con scadenza,
// oltre metà finestra o negli ultimi 2 giorni, senza Report di Attivazione.
// L'invio lo fa Enrico dalla sua posta (mailto): nessuna email automatica verso il
// referente, che dipenderebbe dal dominio email non ancora verificato.
export async function getSollecitiCheckup({ baseUrl, now = new Date() } = {}) {
  let aperti;
  try {
    const r = await supabase.from('assessments')
      .select('id, client_id, status, created_at, chiude_il, sollecito_meta_at, sollecito_finale_at, clients(name, contact_name, contact_email, employees, assessment_share_code)')
      .eq('status', 'active').not('chiude_il', 'is', null);
    if (r.error) return []; // v51 non ancora applicata: nessun sollecito, nessun errore
    aperti = r.data || [];
  } catch (_) { return []; }
  const out = [];
  for (const a of aperti) {
    const tipo = sollecitoDovuto(a, now);
    if (!tipo) continue;
    if (await reportAttivazioneDopo(a.client_id, a.created_at).catch(() => true)) continue;
    const c = a.clients || {};
    const n = await contaRisposte(a.id).catch(() => 0);
    const dipendenti = parseInt(c.employees) || 0;
    const link = `${baseUrl}/q/c/${c.assessment_share_code}`;
    const { oggetto, corpo } = testoSollecito({ tipo, referente: c.contact_name, n, dipendenti, chiudeIl: a.chiude_il, link, firma: 'Enrico' });
    out.push({
      assessment_id: a.id, client_id: a.client_id, cliente: c.name || a.client_id,
      email: c.contact_email || '', n, dipendenti, chiude_il: a.chiude_il,
      giorni: giorniAllaChiusura(a.chiude_il, now), tipo, oggetto, corpo,
    });
  }
  return out.sort((x, y) => (x.giorni ?? 99) - (y.giorni ?? 99));
}
