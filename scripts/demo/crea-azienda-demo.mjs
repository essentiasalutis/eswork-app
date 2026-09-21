// ─────────────────────────────────────────────────────────────────────────────
// AZIENDA DEMO «Officine Demo S.p.A.» — un anno completo di programma, per le
// presentazioni. is_demo = true. Serve il server locale acceso sulla 3320 (Stima).
//
//   node --import ./scripts/demo/risolutore.mjs scripts/demo/crea-azienda-demo.mjs <comando>
//
// L'anno si costruisce a FASI: dopo ogni fase si genera il report di quel momento
// con il generatore vero IN PRODUZIONE (sessione admin nel browser: la chiave
// Anthropic locale è vuota), poi se ne riporta la data al giorno giusto. Così ogni
// report racconta solo ciò che era successo fino ad allora. Ordine obbligato:
//   fase1  → Report di Attivazione → data activation 2025-09-16
//   fase2  → Report T3             → data t3 2026-01-26
//   fase3  → Report T6             → data t6 2026-04-13
//   fase4  → Report Annuale        → data t12 2026-09-16
//   esempi (link dell'area personale) · pulisci (cancella tutto; fase1 lo fa da sé)
//
// I mini-check T3/T6 seguono la regola della piattaforma (lib/store.js,
// getPatientsForMinicheckInvite): solo a chi ha un primo ciclo, a 90/180 giorni
// dall'inizio. Per questo il T3 è a fine gennaio e il T6 a metà aprile.
//
// Scelte (17-18/9): avvio 22/09/2025; manifattura, 300 dipendenti, ~76% di
// risposta al check-up; check-up a 6 e 12 mesi compilati da tutti; nessuna riga
// nel registro legale dei consensi (solo in aggiunta, non si cancellerebbe).
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { rng, dipendenti as generaDipendenti, risposte } from './popolazione.mjs';
import { computeLevel, BODY_ZONES } from '../../lib/scoring.js';
import { PROTOCOLLO } from '../../lib/protocollo.mjs';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const BASE = 'http://localhost:3320';
const PRO = 'pro_1777478722429_z57rq';
// Identificativi: quelli della demo delle presentazioni, oppure (per le prove) quelli
// di un'azienda usa e getta passati da variabili d'ambiente.
const P = process.env.DEMO_PREFISSO || 'dmo';
const C = process.env.DEMO_CLIENT || 'dmo_officine';
const A = `${P}_checkup_t0`;
const NOME = process.env.DEMO_NOME || 'Officine Demo S.p.A.';
const CODICE = process.env.DEMO_CODICE || 'DMOOFF01';
const AVVIO = '2025-09-22';

// Sessione admin per le API locali (firmata come il server: chiave del ruolo admin,
// lib/firma-sessione.js, con il segreto LOCALE: vale solo qui).
process.env.SESSION_SECRET ||= env.SESSION_SECRET;
const { firma } = await import('../../lib/firma-sessione.js');
const cookieAdmin = `esw_session=${firma('admin', { email: env.ADMIN_EMAIL, exp: Date.now() + 6 * 3600e3 })}`;

const r = rng(20250922 + Math.max(0, ['fase1', 'fase2', 'fase3', 'fase4'].indexOf(process.argv[2])) * 7919);   // un seme per fase
const pick = (arr) => arr[Math.floor(r() * arr.length)];
const tra = (a, b) => a + Math.floor(r() * (b - a + 1));
const hex = (n) => crypto.randomBytes(n).toString('hex');
let seq = 0;
const id = (p) => `${P}_${p}_${(++seq).toString(36)}`;
// Data e ora (Roma ≈ UTC+1/+2: 08:00Z = mattina) a partire da un giorno 'AAAA-MM-GG'.
const g = (giorno, ora = 8, min = 0) => new Date(`${giorno}T${String(ora).padStart(2, '0')}:${String(min).padStart(2, '0')}:00Z`).toISOString();
const piuGiorni = (giorno, n) => new Date(Date.parse(`${giorno}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const log = (...a) => console.log(...a);

async function ins(tabella, righe) {
  const arr = Array.isArray(righe) ? righe : [righe];
  for (let i = 0; i < arr.length; i += 400) {
    const { error } = await db.from(tabella).insert(arr.slice(i, i + 400));
    if (error) throw new Error(`${tabella}: ${error.message}`);
  }
  return arr;
}
async function upd(tabella, campi, col, val) {
  const { error } = await db.from(tabella).update(campi).eq(col, val);
  if (error) throw new Error(`${tabella} update: ${error.message}`);
}
async function api(metodo, percorso, corpo) {
  const res = await fetch(BASE + percorso, { method: metodo, headers: { 'Content-Type': 'application/json', Cookie: cookieAdmin }, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await res.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  if (!res.ok) throw new Error(`${metodo} ${percorso} → ${res.status} ${String(t).slice(0, 200)}`);
  return j;
}

// ─── Stato condiviso tra le fasi ─────────────────────────────────────────────
const S = { dip: [], persone: [], testi: {}, cicli: [], sessioniPerPaziente: {} };

const LONG = (d) => new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' });

// I report si generano IN PRODUZIONE (dove c'è la chiave dell'AI) dal browser con la
// sessione admin, tra una fase e l'altra. Qui si riporta l'ultimo report di quel tipo
// al giorno giusto, anche nel testo (il generatore scrive la data di oggi).
const TIPO_REPORT = { activation: 'activation', t3: 'checkpoint_t3', t6: 'checkpoint_t6', t12: 'checkpoint_t12' };
async function dataReport(tipo, giorno) {
  const oggi = LONG(new Date());
  const { data: rep, error } = await db.from('generated_reports').select('id, content_text, ai_status, created_at').eq('client_id', C).eq('report_type', TIPO_REPORT[tipo]).order('created_at', { ascending: false }).limit(1).single();
  if (error) throw new Error(`nessun report ${tipo}: generalo prima`);
  const testo = (rep.content_text || '').split(oggi).join(LONG(g(giorno)));
  await upd('generated_reports', { created_at: g(giorno, 9), content_text: testo }, 'id', rep.id);
  if (tipo === 'activation') {
    const { data: fm } = await db.from('first_meetings').select('id, stima_snapshot').eq('client_id', C).single();
    await upd('first_meetings', { stima_snapshot: { ...fm.stima_snapshot, frozen_at: g(giorno, 9) } }, 'id', fm.id);
  }
  log(`report ${tipo}: ${rep.ai_status}, riportato al ${giorno}`);
}

// Stato tra una fase e l'altra (le fasi girano in comandi separati).
const FILE_STATO = process.env.DEMO_STATO || path.join(os.tmpdir(), 'eswork-demo-stato.json');
function salva() { fs.writeFileSync(FILE_STATO, JSON.stringify({ S, seq })); }
function carica() { const j = JSON.parse(fs.readFileSync(FILE_STATO, 'utf8')); Object.assign(S, j.S); seq = j.seq; }

// ─── Sedute, cicli, documenti ─────────────────────────────────────────────────
function prossimoNumeroSeduta(pid) { S.sessioniPerPaziente[pid] = (S.sessioniPerPaziente[pid] || 0) + 1; return S.sessioniPerPaziente[pid]; }

async function firmaDocumenti(p, giorno) {
  const sig = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const base = { patient_id: p.pid, client_id: C, professional_id: PRO, signed_at: g(giorno, 8, 30), signature_image: sig, ip_hash: null, user_agent: 'demo', modalita: 'piattaforma', created_at: g(giorno, 8, 30), updated_at: g(giorno, 8, 30) };
  await ins('patient_documents', [
    { ...base, id: id('doc'), type: 'consent_treatment', status: 'signed', content_hash: S.testi.consenso.impronta, testo_legale_id: S.testi.consenso.id, versione: S.testi.consenso.versione },
    { ...base, id: id('doc'), type: 'privacy_extended', status: 'signed', content_hash: S.testi.informativa.impronta, testo_legale_id: S.testi.informativa.id, versione: S.testi.informativa.versione },
    { ...base, id: id('doc'), type: 'anamnesi', status: 'completed', form_data: { first_name: p.first, last_name: p.last, age: p.eta, gender: p.sesso, job_activity: p.area === 'reparto' ? pick(['operatore di linea', 'magazziniere', 'manutentore', 'saldatore', 'addetto montaggio']) : pick(['impiegata amministrativa', 'progettista', 'addetto acquisti', 'responsabile qualità']), sedentary: p.area === 'ufficio', pain_location: p.zona, pain_onset: pick(['graduale', 'dopo un sollevamento', 'da alcuni mesi']), nrs: p.nrs0, durata: pick(['1-3 mesi', '3-6 mesi', 'più di 6 mesi']) }, content_hash: hex(32) },
  ]);
  p.documenti = true;
}

// Un ciclo: 4 sedute a distanza fissa, NRS in discesa; chiusura con PGIC (1..5).
async function ciclo(p, { tipo = 'treatment', numero = 1, inizio, passoGiorni = 7, sedute = PROTOCOLLO.sedute_per_ciclo, chiudi = true, pgic = null, fino = null }) {
  const cid = id('cyc');
  const pianificate = tipo === 'prevention' ? PROTOCOLLO.sessioni_prevenzione_l2 : PROTOCOLLO.sedute_per_ciclo;
  const date = Array.from({ length: pianificate }, (_, k) => piuGiorni(inizio, k * passoGiorni));
  const fatte = date.filter(d => !fino || d <= fino).slice(0, sedute);
  let nrs = tipo === 'prevention' ? tra(2, 4) : tra(6, 8);
  const righe = fatte.map((d, k) => {
    const pre = Math.max(0, nrs - (k > 0 ? tra(0, 1) : 0));
    const post = Math.max(0, pre - (tipo === 'prevention' ? tra(0, 1) : tra(1, 3)));
    nrs = post + tra(0, 1);
    return { id: id('ses'), patient_id: p.pid, professional_id: PRO, client_id: C, cycle_id: cid, date: g(d, 9, 30), session_number: prossimoNumeroSeduta(p.pid), nrs_pre: pre, nrs_post: post, treatment_notes: tipo === 'prevention' ? 'Sessione di prevenzione: esercizi posturali e indicazioni sulla postazione.' : pick(['Trattamento osteopatico del distretto lombare, mobilizzazioni.', 'Trattamento cervico-dorsale, tecniche miofasciali.', 'Lavoro sulla spalla e sul cingolo scapolare.', 'Riequilibrio lombo-pelvico, esercizi da proseguire a casa.']), next_session_notes: k < pianificate - 1 ? 'Verificare la risposta al trattamento.' : null, closed_at: g(d, 10), created_at: g(d, 9, 30) };
  });
  const completo = fatte.length === pianificate;
  const chiusura = completo && chiudi ? piuGiorni(fatte[fatte.length - 1], 5) : null;
  const chiusoIl = chiusura && (!fino || chiusura <= fino) ? chiusura : null;   // mai chiuso dopo la data della fase
  const pg = chiusoIl ? (pgic ?? (r() < 0.8 ? tra(4, 5) : r() < 0.7 ? 3 : 2)) : null;
  await ins('treatment_cycles', { id: cid, patient_id: p.pid, client_id: C, professional_id: PRO, cycle_number: numero, cycle_type: tipo, sessions_planned: pianificate, sessions_completed: fatte.length, status: chiusoIl ? 'closed' : completo ? 'pending_pgic' : 'active', outcome: chiusoIl ? (pg >= 4 ? 'improved' : 'no_improvement') : null, pgic: pg, started_at: g(inizio, 9), closed_at: chiusoIl ? g(chiusoIl, 18) : null, created_at: g(inizio, 9), updated_at: g(chiusoIl || fatte[fatte.length - 1] || inizio, 18) });
  if (righe.length) await ins('sessions', righe);
  const campi = { current_cycle: numero, updated_at: g(chiusoIl || inizio, 18) };
  if (chiusoIl && tipo === 'treatment') {
    if (pg >= 4) Object.assign(campi, { level: 'level2', computed_level: 'level2', level_status: 'active', last_cycle_end_date: chiusoIl });
    else Object.assign(campi, { level_status: 'opted_out', last_cycle_end_date: chiusoIl });
  }
  await upd('patients', campi, 'id', p.pid);
  if (chiusoIl && tipo === 'treatment') { p.livello = pg >= 4 ? 'level2' : p.livello; p.uscito = pg < 4; p.fineCiclo = chiusoIl; }
  S.cicli.push({ cid, pid: p.pid, tipo, numero, inizio, passoGiorni, chiudi, chiusoIl, completo });
  return { cid, chiusoIl, pg };
}

// I cicli rimasti aperti alla fine di una fase proseguono nella fase successiva con
// le STESSE date: si rifanno fino alla nuova data (sedute già esistenti identiche).
async function riprendiCicliAperti(fino) {
  const aperti = S.cicli.filter(c => !c.chiusoIl);
  for (const c of aperti) {
    const p = S.persone.find(x => x.pid === c.pid);
    await db.from('sessions').delete().eq('cycle_id', c.cid);
    await db.from('treatment_cycles').delete().eq('id', c.cid);
    S.cicli = S.cicli.filter(x => x.cid !== c.cid);
    const { count } = await db.from('sessions').select('id', { count: 'exact', head: true }).eq('patient_id', c.pid);
    S.sessioniPerPaziente[c.pid] = count || 0;
    const nuovo = await ciclo(p, { tipo: c.tipo, numero: c.numero, inizio: c.inizio, passoGiorni: c.passoGiorni, chiudi: true, fino });
    if (c.tipo === 'prevention') p.prevCiclo = nuovo;
  }
  log(`   cicli ripresi: ${aperti.length}`);
}

async function prevalida(p, giorno, esito = 'l1_confirmed') {
  await ins('pre_validations', { id: id('pv'), patient_id: p.pid, professional_id: PRO, client_id: C, duration_minutes: PROTOCOLLO.durata_prevalidazione_min, nrs_during_call: tra(5, 8), pain_zone: p.zona, symptom_duration_months: tra(1, 12), clinical_notes: esito === 'l1_confirmed' ? 'Quadro compatibile con presa in carico: dolore con limitazione funzionale.' : 'Dolore presente senza limitazione rilevante: indicazioni di prevenzione.', outcome: esito, created_at: g(giorno, 14) });
  const campi = { assigned_professional_id: PRO, updated_at: g(giorno, 14) };
  if (esito === 'l1_confirmed') Object.assign(campi, { level: 'level1', computed_level: 'level1', level_status: 'active' });
  if (esito === 'reclassified_l2') Object.assign(campi, { level: 'level2', computed_level: 'level2', level_status: 'active' });
  await upd('patients', campi, 'id', p.pid);
  await db.from('waitlist').update({ status: 'assigned', updated_at: g(giorno, 14), assigned_professional_id: PRO }).eq('patient_id', p.pid).eq('status', 'pending');
  p.livello = esito === 'l1_confirmed' ? 'level1' : esito === 'reclassified_l2' ? 'level2' : p.livello;
  p.assegnato = true;
}

// NMQ per le rivalutazioni (formato dell'app: chiavi per zona con pain_7days/pain_12m/functional_impact).
const CHIAVI_ZONA = ['collo', 'spalle', 'schiena_alta', 'schiena_bassa', 'braccia', 'polsi', 'anche', 'ginocchia', 'caviglie'];
function nmqRivalutazione(livello, area) {
  const a = risposte(livello, r, area);
  return Object.fromEntries(BODY_ZONES.map((_, zi) => [CHIAVI_ZONA[zi], { pain_12m: a[`nmq_${zi}_0`] === 1, functional_impact: a[`nmq_${zi}_1`] === 1, pain_7days: a[`nmq_${zi}_2`] === 1 }]));
}

// ═══ FASE 1 — colloquio, Stima, check-up, offerta, firma, Report di Attivazione ═══
async function fase1() {
  log('FASE 1 — fino alla firma (luglio–settembre 2025)');
  const { data: tc } = await db.from('testi_legali').select('id,versione,impronta').eq('codice', 'consenso_trattamento').eq('stato', 'in_vigore').single();
  const { data: ti } = await db.from('testi_legali').select('id,versione,impronta').eq('codice', 'informativa_estesa').eq('stato', 'in_vigore').single();
  S.testi = { consenso: tc, informativa: ti };

  await ins('clients', { id: C, name: NOME, sector: 1, employees: 300, contact_name: 'Laura Ferri', contact_email: 'l.ferri@officinedemo.example', contact_phone: '011 000 0000', source: 'passaparola', pipeline_stage: 'meeting_scheduled', created_at: g('2025-07-10'), pricing_version: 'v2', tipo_prodotto: 'programma_completo', is_demo: true, capienza_gruppo: 25, assessment_share_code: CODICE, hr_ingressi_token: hex(24) });
  await ins('first_meetings', { id: id('fm'), client_id: C, employees: 300, sector: 1, max_people_training: 25, num_locations: 2, absence_days: 2100, turnover: 12, remote_work: 'no', work_shifts: 'due turni', internal_contact: 'Laura Ferri (HR)', motivation: 'Ridurre le assenze legate al mal di schiena in produzione', created_at: g('2025-07-10', 10), updated_at: g('2025-07-10', 11),
    data: { step1: { nome: NOME, ref_nome: 'Laura Ferri', ref_ruolo: 'Responsabile HR', ref_email: 'l.ferri@officinedemo.example', ref_tel: '011 000 0000', work_desc: 'Lavorazioni meccaniche, montaggio e magazzino su due turni; uffici tecnici e amministrativi.', sector: 'manufacturing', disturbi: ['Mal di schiena', 'Cervicale', 'Spalle', 'Dolori da movimentazione'], disturbi_altro: '', prev_fatta: 'no', prev_note: '', assenteismo: 'alto', absence_days: 2100, absence_days_msk: 700, premio_inail: 48000, note: 'Molte richieste dal reparto montaggio.' },
      step2: { sedi: [{ nome: 'Stabilimento', employees: 200 }, { nome: 'Uffici', employees: 100 }], capienza: 25, training_mode: 'per_sede', fatturato: 'high', hr_maturity: 'medium', tier_override: null, tier: null, ergonomia_ufficio: 100, ergonomia_ufficio_auto: true, ergonomia_addetti: 40, ergonomia_postazioni: 6 },
      step3: { spazio: 'sala riunioni piano terra', spazio_note: '', fasce: ['Mattina', 'Prima/dopo turno'], mc: 'si', mc_nome: 'Dott. Medico Competente', mc_contatti: '', esg: 'si', refop_nome: 'Marco Villa', refop_ruolo: 'Capo reparto', refop_contatti: '' },
      params: { l2_mult: 2, vat_exempt: true } } });
  // Stima consegnata: il generatore vero scrive la forbice (snapshot) e porta la pipeline a «Stima inviata».
  await api('POST', '/api/stima', { clientId: C, name: NOME, contact_name: 'Laura Ferri', sector: 'manufacturing', employees: 300, groups: 12, vatExempt: true, l2Mult: 2, store: true, ergonomiaUfficio: 100, ergonomiaAddetti: 40, ergonomiaPostazioni: 6 });
  const { data: fm } = await db.from('first_meetings').select('id, stima_snapshot').eq('client_id', C).single();
  await upd('first_meetings', { stima_snapshot: { ...fm.stima_snapshot, at: g('2025-07-17', 10) } }, 'id', fm.id);
  log(`   Stima: forbice ${fm.stima_snapshot.forchetta.min.price_y1} – ${fm.stima_snapshot.forchetta.max.price_y1} €`);

  // Anagrafica: 300 in forza prima dell'avvio.
  S.dip = generaDipendenti(300, r).map(d => ({ ...d, did: id('dip'), ingresso: `${tra(2006, 2024)}-${String(tra(1, 12)).padStart(2, '0')}-${String(tra(1, 28)).padStart(2, '0')}` }));
  await ins('org_dipendente', S.dip.map(d => ({ id: d.did, client_id: C, nome: d.nome, matricola: d.matricola, data_ingresso: d.ingresso, attivo: true, straordinario: false, inserito_da: 'admin', area: d.area, created_at: g('2025-09-15') })));

  // Check-up: 25/8 – 7/9, 228 risposte (76%).
  await ins('assessments', { id: A, client_id: C, type: 'initial', status: 'closed', share_code: process.env.DEMO_CODICE_T0 || 'DMOT0Q01', created_at: g('2025-08-25', 6), chiude_il: '2025-09-07', chiuso_at: g('2025-09-07', 21, 59) });
  const rispondenti = [...S.dip].sort(() => r() - 0.5).slice(0, 228);
  const livelli = [...Array(39).fill('level1'), ...Array(78).fill('level2'), ...Array(111).fill('level3')].sort(() => r() - 0.5);
  const resp = [], paz = [], cons = [], attesa = [];
  rispondenti.forEach((d, k) => {
    const livello = livelli[k];
    const a = risposte(livello, r, d.area);
    if (computeLevel(a) !== livello) throw new Error('livello incoerente');
    const giorno = piuGiorni('2025-08-25', tra(0, 13));
    const quando = g(giorno, tra(6, 17), tra(0, 59));
    const contatto = r() < (livello === 'level1' ? 0.85 : livello === 'level2' ? 0.7 : 0.55);
    const pid = id('pat');
    const zi = BODY_ZONES.findIndex((_, i) => a[`nmq_${i}_2`] === 1);
    const p = { ...d, pid, livello, contatto, quando, zona: zi >= 0 ? BODY_ZONES[zi] : null, nrs0: tra(5, 8), token: hex(24) };
    S.persone.push(p);
    resp.push({ id: id('resp'), assessment_id: A, answers: a, submitted_at: quando });
    paz.push({ id: pid, client_id: C, first_name: contatto ? d.first : 'Nome non indicato', last_name: contatto ? d.last : '', email: contatto ? `${d.first}.${d.last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@officinedemo.example' : null, phone: contatto ? `333 ${tra(100, 999)} ${tra(1000, 9999)}` : null, location: d.area === 'reparto' ? 'Stabilimento' : 'Uffici', age: d.eta, gender: d.sesso, level: livello, computed_level: livello, level_status: livello === 'level1' ? 'pending' : 'active', prevention_eligible: livello === 'level2', care_token: p.token, self_declared: true, wants_to_be_contacted: contatto, assessment_completed_at: quando, current_cycle: 0, created_at: quando, updated_at: quando });
    cons.push({ id: id('ac'), assessment_id: A, patient_id: pid, consent_privacy_at: quando, consent_health_at: quando, informativa_version: '2025-08-01', created_at: quando });
    if (contatto && livello === 'level1') attesa.push({ id: id('wl'), patient_id: pid, client_id: C, score: 100, source: 'self_declaration', status: 'pending', created_at: quando, updated_at: quando });
  });
  await ins('responses', resp); await ins('patients', paz); await ins('assessment_consents', cons); await ins('waitlist', attesa);
  log(`   check-up: ${resp.length} risposte, ${attesa.length} Livello 1 in coda di pre-validazione`);

  // Offerta, firma, avvio. Capacità: L1 del check-up.
  await upd('clients', { pipeline_stage: 'signed', contracted_l1: 39, offerta_aperta_il: '2025-09-09', offerta_scade_il: '2025-09-19', secondo_incontro_il: '2025-09-09', contract_start_date: AVVIO, data_avvio_programma: AVVIO, last_contact_date: '2025-09-12' }, 'id', C);
  await ins('professional_assignments', { id: id('pa'), professional_id: PRO, client_id: C, active: true, created_at: g('2025-09-15') });
}

// ═══ FASE 2 — primi tre mesi (fino alla T3, 22/12/2025) ═══
// Confini delle fasi = giorno prima di ciascun report (T3 26/1, T6 13/4, T12 16/9).
const FINE2 = '2026-01-25', FINE3 = '2026-04-12', FINE4 = '2026-09-17';

async function fase2() {
  log('FASE 2 — primi tre mesi');
  const l1 = S.persone.filter(p => p.livello === 'level1' && p.contatto);
  // Pre-validazioni: la maggior parte confermata, alcune riclassificate, due da rivedere.
  let k = 0;
  for (const p of l1) {
    const giorno = piuGiorni('2025-09-29', Math.floor(k++ / 2));
    const esito = k === 5 || k === 11 || k === 19 ? 'reclassified_l2' : k === 8 || k === 23 ? 'needs_more_info' : 'l1_confirmed';
    await prevalida(p, giorno, esito);
    p.esitoPv = esito;
  }
  // Cicli di trattamento (ottobre–dicembre): documenti firmati prima della prima seduta.
  const confermati = l1.filter(p => p.esitoPv === 'l1_confirmed');
  let j = 0;
  for (const p of confermati) {
    const inizio = piuGiorni('2025-10-06', Math.floor(j++ / 3) * 7);
    await firmaDocumenti(p, inizio);
    await ciclo(p, { inizio, fino: FINE2 });
  }
  // Prevenzione L2 (dal 3/11), aperta a chi ha il diritto e ha lasciato il contatto.
  const l2 = S.persone.filter(p => p.livello === 'level2' && p.contatto && p.prevention_eligible !== false && !p.esitoPv);
  S.prevenzione = l2.slice(0, Math.round(l2.length * 0.8));
  let m = 0;
  for (const p of S.prevenzione.slice(0, 30)) {
    const inizio = piuGiorni('2025-11-03', (m++ % 10) * 4);
    await upd('patients', { assigned_professional_id: PRO }, 'id', p.pid); p.assegnato = true;
    await firmaDocumenti(p, inizio);
    p.prevCiclo = await ciclo(p, { tipo: 'prevention', inizio, passoGiorni: 42, fino: FINE2 });
  }
  // Formazione: primo modulo per i 12 gruppi (13/10 – 5/12).
  S.gruppi = 'ABCDEFGHIJKL'.split('');
  S.dip.forEach((d, i) => { d.gruppo = S.gruppi[i % 12]; });
  await sessioniModulo(1, '2025-10-13', 5);
  // Nuovi ingressi (inseriti dall'HR) e comunicazioni.
  S.nuovi = [];
  await nuoviIngressi(['2025-10-20', '2025-11-03', '2025-11-17', '2025-12-01'], 'hr');
  await ins('org_comunicazione', [
    { id: id('com'), client_id: C, categoria: 'nuovo_ingresso', testo: 'Dal 3 novembre entrano due nuovi addetti al montaggio: chiediamo di includerli nella formazione.', stato: 'chiusa', letta_at: g('2025-10-28', 9), aggiornata_at: g('2025-10-30', 9), created_at: g('2025-10-27', 15) },
    { id: id('com'), client_id: C, categoria: 'altro', testo: 'Possiamo spostare lo sportello del 18/12 al giorno successivo per l\'inventario?', stato: 'chiusa', letta_at: g('2025-12-10', 9), aggiornata_at: g('2025-12-10', 10), created_at: g('2025-12-09', 16) },
  ]);
  // Auto-segnalazioni del trimestre.
  await autosegnalazioni([['2025-10-22', 'Dolore al polso destro dopo cambio linea', true, false], ['2025-11-19', 'Lombalgia dopo movimentazione pallet', true, true], ['2025-12-04', 'Rigidità cervicale al mattino', false, false]], FINE2);
  await miniCheck('t3', FINE2);
}

async function sessioniModulo(modulo, primoGiorno, passo) {
  const sess = S.gruppi.map((gr, i) => ({ id: id('sf'), client_id: C, tipo: 'base', origine: 'base_anno1', anno_programma: 1, gruppo: gr, data_pianificata: piuGiorni(primoGiorno, i * passo), data_erogazione: piuGiorni(primoGiorno, i * passo), stato: 'erogata', a_consumo: false, importo_dovuto: null, note: `Modulo ${modulo}`, created_at: g(primoGiorno, 7) }));
  await ins('org_sessione_formativa', sess);
  const part = [];
  for (const d of S.dip) {
    const s = sess.find(x => x.gruppo === d.gruppo);
    const presente = r() < 0.93;
    part.push({ id: id('pf'), dipendente_id: d.did, sessione_formativa_id: s.id, tipo: 'base', stato: presente ? 'svolta' : 'da_recuperare', data_svolgimento: presente ? s.data_erogazione : null, origine: 'spunta_sessione', created_at: g(s.data_erogazione, 12) });
  }
  await ins('org_partecipazione_formativa', part);
}

async function nuoviIngressi(giorni, da) {
  const nuovi = generaDipendenti(giorni.length, r).map((d, i) => ({ ...d, did: id('dip'), ingresso: giorni[i], matricola: `M${2000 + S.nuovi.length + i}` }));
  await ins('org_dipendente', nuovi.map(d => ({ id: d.did, client_id: C, nome: d.nome, matricola: d.matricola, data_ingresso: d.ingresso, attivo: true, straordinario: false, inserito_da: da, area: d.area, created_at: g(d.ingresso, 9) })));
  S.nuovi.push(...nuovi);
}

async function autosegnalazioni(elenco, fino) {
  const candidati = S.persone.filter(p => p.contatto && !p.assegnato && p.livello !== 'level1');
  for (const [giorno, disturbo, impatto, urgente] of elenco) {
    const p = candidati.shift();
    await ins('self_triggers', { id: id('st'), patient_id: p.pid, client_id: C, disturbance: disturbo, functional_impact: impatto, duration: pick(['1-4 settimane', 'Più di 1 mese']), urgent: urgente, note: null, status: 'closed', created_at: g(giorno, 11) });
    await ins('waitlist', { id: id('wl'), patient_id: p.pid, client_id: C, score: urgente ? 100 : 70, source: 'self_trigger', status: 'pending', notes: `Self-trigger${urgente ? ' URGENTE' : ''}: ${disturbo}`, created_at: g(giorno, 11), updated_at: g(giorno, 11) });
    await ins('restratification_alerts', { id: id('ra'), patient_id: p.pid, client_id: C, source: 'self_trigger', status: impatto ? 'confirmed_l1' : 'not_confirmed', form_data: { disturbance: disturbo, functional_impact: impatto }, notes: disturbo, created_at: g(giorno, 11), updated_at: g(piuGiorni(giorno, 3), 11) });
    p.segnalato = giorno;
    if (impatto) { p.zona = 'Schiena bassa (lombare)'; await prevalida(p, piuGiorni(giorno, 3), 'l1_confirmed'); p.daTrattare = piuGiorni(giorno, 7); }
    else { await prevalida(p, piuGiorni(giorno, 3), 'reclassified_l2'); }
  }
  for (const p of S.persone.filter(x => x.daTrattare && !x.trattatoDaSegnalazione)) {
    p.trattatoDaSegnalazione = true;
    await firmaDocumenti(p, p.daTrattare);
    await ciclo(p, { inizio: p.daTrattare, fino });
  }
}

// Come la piattaforma (lib/store.js, getPatientsForMinicheckInvite): il mini-check va
// SOLO a chi ha avviato un primo ciclo, a 90 (T3) o 180 (T6) giorni dal suo inizio.
// Nella demo lo compilano tutti quelli a cui è dovuto entro la data della fase.
async function miniCheck(tipo, fino) {
  const giorni = tipo === 't6' ? 180 : 90;
  const cand = [];
  for (const c of S.cicli.filter(x => x.numero === 1)) {
    const p = S.persone.find(x => x.pid === c.pid);
    const dovuto = piuGiorni(c.inizio, giorni);
    if (!p || p.mc?.[tipo] || dovuto > fino) continue;
    (p.mc ||= {})[tipo] = true;
    const giorno = piuGiorni(dovuto, tra(0, 6));
    cand.push([p, giorno > fino ? fino : giorno]);
  }
  const righe = [], allerte = [];
  for (const [p, giorno] of cand) {
    const pgic = r() < 0.72 ? tra(4, 5) : r() < 0.75 ? 3 : tra(1, 2);
    const lim = r() < 0.12;
    const needs = pgic <= 2 || lim;
    const quando = g(giorno, tra(7, 19), tra(0, 59));
    righe.push({ id: id('mc'), patient_id: p.pid, client_id: C, check_type: tipo, pgic, nrs_current: Math.max(0, (p.livello === 'level3' ? tra(0, 2) : tra(1, 4)) + (needs ? 3 : 0)), has_limitations: lim, wants_contact: needs && r() < 0.8, free_text: needs ? 'Il dolore è tornato nelle ultime settimane.' : null, triage_outcome: needs ? 'needs_contact' : 'ok', created_at: quando });
    if (needs) { allerte.push({ id: id('ra'), patient_id: p.pid, client_id: C, source: 'checkpoint', status: 'pending', form_data: { pgic, has_limitations: lim, check_type: tipo }, notes: `Mini-check ${tipo.toUpperCase()}: da ricontattare`, created_at: quando, updated_at: quando }); p.allerta = tipo; p.allertaIl = giorno; }
  }
  if (righe.length) await ins('mini_checks', righe);
  if (allerte.length) await ins('restratification_alerts', allerte);
  log(`   mini-check ${tipo}: ${righe.length} (${allerte.length} da ricontattare)`);
}

// Nella demo la ri-fotografia a sei mesi e la rivalutazione annuale le compilano tutti.
async function rivalutazioni(checkpoint, primoGiorno, spostamento) {
  const cand = S.persone.filter(p => !p.rivalutato?.[checkpoint]);
  const righe = [];
  for (const p of cand) {
    // Dopo un anno di programma: chi era L1 ed è stato trattato scende; una parte dei L2 migliora.
    let nuovo = p.livello;
    if (p.livello === 'level1') nuovo = r() < spostamento.l1 ? 'level2' : 'level1';
    else if (p.livello === 'level2') nuovo = r() < spostamento.l2 ? 'level3' : r() < 0.06 ? 'level1' : 'level2';
    else nuovo = r() < spostamento.l3 ? 'level2' : 'level3';
    const nmq = nmqRivalutazione(nuovo, p.area);
    const lv = computeLevel(nmq);
    const quando = g(piuGiorni(primoGiorno, tra(0, 14)), tra(7, 19), tra(0, 59));
    righe.push({ id: id('rv'), patient_id: p.pid, client_id: C, nmq_data: nmq, pgic: nuovo === 'level1' ? tra(2, 3) : r() < 0.75 ? tra(4, 5) : 3, computed_level: lv, checkpoint, completed_at: quando, created_at: quando });
    (p.rivalutato ||= {})[checkpoint] = true;
    if (checkpoint === 't12') { await upd('patients', { level: lv, computed_level: lv, prevention_eligible: lv === 'level2', level_status: lv === 'level1' ? 'pending' : 'active', updated_at: quando }, 'id', p.pid); p.livello = lv; }
  }
  await ins('reassessments_t12', righe);
  log(`   rivalutazioni ${checkpoint}: ${righe.length}`);
}

// ═══ FASE 3 — fino alla T6 (24/03/2026) ═══
async function fase3() {
  log('FASE 3 — mesi 4-6');
  await riprendiCicliAperti(FINE3);
  // Le due pre-validazioni da rivedere: confermate a fine gennaio, ciclo a febbraio.
  for (const p of S.persone.filter(x => x.esitoPv === 'needs_more_info')) {
    await prevalida(p, '2026-01-28', 'l1_confirmed'); p.esitoPv = 'l1_confirmed';
    await firmaDocumenti(p, '2026-02-02');
    await ciclo(p, { inizio: '2026-02-02', fino: FINE3 });
  }
  // Ricadute dal mini-check T3: nuova pre-validazione e secondo ciclo (≥ 60 giorni dalla fine del primo).
  const ricadute = S.persone.filter(p => p.allerta === 't3' && p.fineCiclo && !p.uscito).slice(0, 4);
  for (const p of ricadute) {
    // Dopo l'allerta, dopo il report T3 e ad almeno 60 giorni dalla fine del primo ciclo.
    const pv = [piuGiorni(p.fineCiclo, PROTOCOLLO.giorni_tra_cicli + 4), piuGiorni(p.allertaIl, 7), '2026-01-27'].sort().pop();
    await prevalida(p, pv, 'l1_confirmed');
    await ciclo(p, { numero: 2, inizio: piuGiorni(pv, 5), fino: FINE3 });
  }
  // Prevenzione: altre persone partono a febbraio.
  let m = 0;
  for (const p of S.prevenzione.slice(30)) {
    const inizio = piuGiorni('2026-02-02', (m++ % 10) * 5);
    await upd('patients', { assigned_professional_id: PRO }, 'id', p.pid); p.assegnato = true;
    await firmaDocumenti(p, inizio);
    p.prevCiclo = await ciclo(p, { tipo: 'prevention', inizio, passoGiorni: 42, fino: FINE3 });
  }
  // Formazione: secondo modulo (2/2 – 18/3); intervento di ergonomia in reparto (febbraio).
  await sessioniModulo(2, '2026-02-02', 4);
  const erg = { id: id('sf'), client_id: C, tipo: 'ergonomia', origine: 'intervento_ergonomia', anno_programma: 1, gruppo: null, data_pianificata: '2026-02-17', data_erogazione: '2026-02-17', stato: 'erogata', a_consumo: false, note: 'Studio di 6 postazioni tipo e formazione degli addetti di reparto', created_at: g('2026-02-10') };
  await ins('org_sessione_formativa', erg);
  await ins('org_partecipazione_formativa', S.dip.filter(d => d.area === 'reparto').slice(0, 40).map(d => ({ id: id('pf'), dipendente_id: d.did, sessione_formativa_id: erg.id, tipo: 'ergonomia', stato: 'svolta', data_svolgimento: '2026-02-17', origine: 'intervento', created_at: g('2026-02-17', 16) })));
  await nuoviIngressi(['2026-02-02', '2026-02-16', '2026-03-02', '2026-03-09', '2026-03-23'], 'hr');
  // Cessazioni del semestre (turnover): gli attivi restano pari ai dipendenti dichiarati.
  for (const [k, giorno] of [[17, '2026-01-31'], [44, '2026-02-15'], [71, '2026-02-28'], [98, '2026-02-28'], [125, '2026-03-15'], [152, '2026-03-20']]) {
    await upd('org_dipendente', { attivo: false, data_cessazione: giorno }, 'id', S.dip[k].did);
  }
  await ins('org_comunicazione', { id: id('com'), client_id: C, categoria: 'postazione_nuova', testo: 'Nuova linea di confezionamento dal 1° marzo: serve una verifica ergonomica delle 3 postazioni.', stato: 'chiusa', data_programmata: '2026-03-10', letta_at: g('2026-02-20', 9), aggiornata_at: g('2026-03-10', 17), created_at: g('2026-02-19', 11) });
  await autosegnalazioni([['2026-01-27', 'Dolore alla spalla sinistra', true, false], ['2026-02-24', 'Fastidio lombare da seduto', false, false]], FINE3);
  await miniCheck('t3', FINE3);
  await miniCheck('t6', FINE3);
  await rivalutazioni('t6', '2026-03-09', { l1: 0.45, l2: 0.25, l3: 0.08 });
}

// ═══ FASE 4 — fino alla T12 (settembre 2026) ═══
async function fase4() {
  log('FASE 4 — mesi 7-12');
  await riprendiCicliAperti(FINE4);
  // Recupero dei nuovi ingressi (maggio): formazione concentrata a consumo.
  const daRecuperare = S.nuovi.slice(0, 9);
  const rec = { id: id('sf'), client_id: C, tipo: 'base_concentrata', origine: 'recupero_autonomo', anno_programma: 1, gruppo: 'R1', data_pianificata: '2026-05-14', data_erogazione: '2026-05-14', stato: 'erogata', a_consumo: true, importo_dovuto: 350, note: 'Recupero nuovi ingressi', created_at: g('2026-05-04') };
  await ins('org_sessione_formativa', rec);
  await ins('org_partecipazione_formativa', daRecuperare.map(d => ({ id: id('pf'), dipendente_id: d.did, sessione_formativa_id: rec.id, tipo: 'base_concentrata', stato: 'svolta', data_svolgimento: '2026-05-14', origine: 'spunta_sessione', created_at: g('2026-05-14', 16) })));
  await nuoviIngressi(['2026-06-08', '2026-07-06', '2026-07-20', '2026-09-01'], 'hr');
  for (const [k, giorno] of [[179, '2026-04-30'], [206, '2026-05-31'], [233, '2026-06-30'], [260, '2026-06-30'], [287, '2026-07-31'], [8, '2026-08-31'], [35, '2026-08-31']]) {
    await upd('org_dipendente', { attivo: false, data_cessazione: giorno }, 'id', S.dip[k].did);
  }
  await ins('org_comunicazione', [
    { id: id('com'), client_id: C, categoria: 'nuovo_ingresso', testo: 'A settembre entra un nuovo tecnico in ufficio acquisti.', stato: 'presa_in_carico', letta_at: g('2026-09-02', 9), aggiornata_at: g('2026-09-02', 10), created_at: g('2026-09-01', 14) },
    { id: id('com'), client_id: C, categoria: 'altro', testo: 'Per il rinnovo vorremmo parlare dei risultati dell\'anno con la direzione: disponibilità a fine settembre?', stato: 'ricevuta', created_at: g('2026-09-15', 16) },
  ]);
  await autosegnalazioni([['2026-05-20', 'Dolore al ginocchio salendo le scale', true, false], ['2026-09-10', 'Formicolio alla mano destra', true, true]], FINE4);
  // L'ultima segnalazione resta in coda: la pre-validazione non è ancora fatta.
  const ultima = S.persone.find(p => p.segnalato === '2026-09-10');
  await db.from('pre_validations').delete().eq('patient_id', ultima.pid).gte('created_at', g('2026-09-10'));
  await db.from('treatment_cycles').delete().eq('patient_id', ultima.pid).gte('started_at', g('2026-09-10'));
  await db.from('sessions').delete().eq('patient_id', ultima.pid).gte('date', g('2026-09-10'));
  await db.from('patient_documents').delete().eq('patient_id', ultima.pid);
  await upd('patients', { assigned_professional_id: null, level: 'level1', computed_level: 'level1', level_status: 'pending', current_cycle: 0 }, 'id', ultima.pid);
  await db.from('waitlist').update({ status: 'pending', assigned_professional_id: null }).eq('patient_id', ultima.pid);
  await db.from('restratification_alerts').update({ status: 'pending' }).eq('patient_id', ultima.pid).eq('source', 'self_trigger');
  await db.from('self_triggers').update({ status: 'pending' }).eq('patient_id', ultima.pid).gte('created_at', g('2026-09-10'));
  S.cicli = S.cicli.filter(c => c.pid !== ultima.pid || c.inizio < '2026-09-10');
  await miniCheck('t3', FINE4);
  await miniCheck('t6', FINE4);
  // T12: rivalutazione annuale di tutti, fine agosto – metà settembre.
  await rivalutazioni('t12', '2026-08-31', { l1: 0.6, l2: 0.3, l3: 0.07 });
}

async function pulisci() {
  const { data: paz } = await db.from('patients').select('id').eq('client_id', C);
  const ids = (paz || []).map(p => p.id);
  const { data: dips } = await db.from('org_dipendente').select('id').eq('client_id', C);
  const didi = (dips || []).map(d => d.id);
  for (let i = 0; i < didi.length; i += 200) await db.from('org_partecipazione_formativa').delete().in('dipendente_id', didi.slice(i, i + 200));
  for (const t of ['org_sessione_formativa', 'org_comunicazione', 'org_dipendente', 'sessions', 'treatment_cycles', 'mini_checks', 'pre_validations', 'self_triggers', 'waitlist', 'restratification_alerts', 'reassessments_t12', 'patient_documents', 'generated_reports', 'first_meetings', 'professional_assignments', 'forbice_revisioni']) {
    const { error } = await db.from(t).delete().eq('client_id', C);
    if (error && !(t === 'forbice_revisioni' && /Could not find the table/.test(error.message))) log('  ', t, error.message);   // senza v75 la tabella non c'è
  }
  for (let i = 0; i < ids.length; i += 200) { await db.from('assessment_consents').delete().in('patient_id', ids.slice(i, i + 200)); await db.from('access_logs').delete().in('patient_id', ids.slice(i, i + 200)); }
  await db.from('responses').delete().eq('assessment_id', A);
  await db.from('patients').delete().eq('client_id', C);
  await db.from('assessments').delete().eq('client_id', C);
  await db.from('clients').delete().eq('id', C);
  const { count } = await db.from('clients').select('id', { count: 'exact', head: true }).eq('id', C);
  log('pulizia: azienda demo residua', count);
}

const [cmd, arg1, arg2] = process.argv.slice(2);
const FASI = { fase1, fase2, fase3, fase4 };
try {
  if (cmd === 'pulisci') await pulisci();
  else if (cmd === 'fase1') { await pulisci(); await fase1(); salva(); }
  else if (FASI[cmd]) { carica(); await FASI[cmd](); salva(); }
  else if (cmd === 'data') await dataReport(arg1, arg2);
  else if (cmd === 'esempi') {
    carica();
    const trattato = S.persone.find(p => p.contatto && p.rivalutato?.t12 && S.cicli.some(c => c.pid === p.pid && c.tipo === 'treatment' && c.chiusoIl));
    const prev = S.persone.find(p => p.contatto && S.cicli.some(c => c.pid === p.pid && c.tipo === 'prevention' && c.chiusoIl));
    log(`dipendente trattato: ${trattato?.first} ${trattato?.last} → /employee/${trattato?.token}  · cartella /pro/patients/${trattato?.pid}`);
    log(`dipendente in prevenzione: ${prev?.first} ${prev?.last} → /employee/${prev?.token}  · cartella /pro/patients/${prev?.pid}`);
  } else log('comandi: fase1 | fase2 | fase3 | fase4 | data <activation|t3|t6|t12> <AAAA-MM-GG> | esempi | pulisci');
} catch (e) { console.error('ERRORE:', e.message); process.exit(1); }
