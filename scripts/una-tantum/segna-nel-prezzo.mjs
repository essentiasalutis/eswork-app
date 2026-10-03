// Una tantum, dopo v84 e v85 (Enrico, 4/10): mette il segno «nel prezzo» sulle persone delle
// aziende che hanno già un Report di Attivazione. Da qui in poi lo scrive la generazione del
// Report (prima della firma), con origine 'report'. I segni di questo script restano
// riconoscibili: origine 'ricostruito_livello' o 'ricostruito_tracce', con la data.
//
//  · «livello» — aziende senza check-up annuale né rivalutazioni: il livello calcolato è
//    ancora quello del check-up iniziale (Weisoft, Meccanica);
//  · «tracce» — aziende dove il livello è stato riscritto (Officine demo), persona per persona:
//      L1 = richiesta di pre-validazione nata dal check-up (waitlist 'self_declaration',
//           prima del primo Report);
//      L2 = prevenzione iniziata nel primo anno (nell'anno spetta solo a chi era L2 al check-up);
//      chi non è mai stato toccato (nessuna rivalutazione, ciclo, pre-validazione o
//           richiesta) ha ancora il livello del check-up iniziale;
//      gli altri restano senza segno.
// Mai i neoassunti. Uso: node --import ./scripts/demo/risolutore.mjs scripts/una-tantum/segna-nel-prezzo.mjs [--scrivi]
// Senza --scrivi è un'anteprima: non scrive niente.
import fs from 'node:fs';
for (const r of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = r.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, ''); }
const { createClient } = await import('@supabase/supabase-js');
const { computeLevel } = await import('../../lib/scoring.js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const scrivi = process.argv.includes('--scrivi');

const v84 = await sb.from('patients').select('nel_prezzo').limit(1);
if (v84.error) { console.error('Manca la v84:', v84.error.message); process.exit(1); }
const v85 = await sb.from('patients').select('nel_prezzo_origine, nel_prezzo_il').limit(1);
if (scrivi && v85.error) { console.error('Manca la v85 (origine del segno): senza, i segni ricostruiti non sarebbero riconoscibili. Non scrivo.'); process.exit(1); }

const { data: reports } = await sb.from('generated_reports').select('client_id, created_at, quote_compliance').eq('report_type', 'activation').order('created_at');
const primo = {}, ultimo = {};
for (const r of reports || []) { if (!primo[r.client_id]) primo[r.client_id] = r; ultimo[r.client_id] = r; }

for (const clientId of Object.keys(primo)) {
  const { data: client } = await sb.from('clients').select('name, data_avvio_programma').eq('id', clientId).maybeSingle();
  if (!client) continue;
  const reportIl = primo[clientId].created_at;
  const q = ultimo[clientId].quote_compliance || {};
  const [{ data: pazienti }, { data: rv }, { data: cicli }, { data: pv }, { data: wl }, { data: ass }] = await Promise.all([
    sb.from('patients').select('id, computed_level, neoassunto').eq('client_id', clientId),
    sb.from('reassessments_t12').select('patient_id').eq('client_id', clientId),
    sb.from('treatment_cycles').select('patient_id, cycle_type, started_at').eq('client_id', clientId),
    sb.from('pre_validations').select('patient_id').eq('client_id', clientId),
    sb.from('waitlist').select('patient_id, source, created_at').eq('client_id', clientId),
    sb.from('assessments').select('id, type, created_at').eq('client_id', clientId).order('created_at'),
  ]);
  const iniziale = (ass || []).find(a => a.type === 'initial') || (ass || [])[0];
  const checkup = { level1: 0, level2: 0, level3: 0 };
  if (iniziale) {
    const { data: resp } = await sb.from('responses').select('answers').eq('assessment_id', iniziale.id);
    for (const r of resp || []) checkup[computeLevel(r.answers)]++;
  }
  const modo = (rv || []).length > 0 ? 'tracce' : 'livello';
  const neo = new Set((pazienti || []).filter(p => p.neoassunto === true).map(p => p.id));
  const segno = {}, fonte = { richiesta: 0, prevenzione: 0, intatto: 0, livello: 0 };
  let senza = 0;
  if (modo === 'livello') {
    for (const p of pazienti || []) if (!neo.has(p.id) && ['level1', 'level2'].includes(p.computed_level)) { segno[p.id] = p.computed_level; fonte.livello++; }
  } else {
    const fineAnno1 = client.data_avvio_programma
      ? `${Number(client.data_avvio_programma.slice(0, 4)) + 1}${client.data_avvio_programma.slice(4)}` : null;
    const toccati = new Set([...(rv || []), ...(cicli || []), ...(pv || []), ...(wl || [])].map(x => x.patient_id));
    const richiestaL1 = new Set((wl || []).filter(w => w.source === 'self_declaration' && w.created_at <= reportIl).map(w => w.patient_id));
    const prevAnno1 = new Set((cicli || []).filter(c => c.cycle_type === 'prevention' && (!fineAnno1 || String(c.started_at) < fineAnno1)).map(c => c.patient_id));
    for (const p of pazienti || []) {
      if (neo.has(p.id)) continue;
      if (richiestaL1.has(p.id)) { segno[p.id] = 'level1'; fonte.richiesta++; }
      else if (prevAnno1.has(p.id)) { segno[p.id] = 'level2'; fonte.prevenzione++; }
      else if (!toccati.has(p.id) && ['level1', 'level2'].includes(p.computed_level)) { segno[p.id] = p.computed_level; fonte.intatto++; }
      else if (!toccati.has(p.id)) { /* L3 al check-up, mai toccato: nessun segno, giusto così */ }
      else senza++;
    }
  }
  const l1 = Object.values(segno).filter(v => v === 'level1').length;
  const l2 = Object.values(segno).filter(v => v === 'level2').length;
  console.log(`\n${client.name} (${clientId}) — modo «${modo}»`);
  console.log(`  segno L1: ${l1}   segno L2: ${l2}   (persone: ${(pazienti || []).length}, neoassunti esclusi: ${neo.size})`);
  console.log(`  check-up iniziale (dalle risposte): L1 ${checkup.level1}, L2 ${checkup.level2}, L3 ${checkup.level3}`);
  console.log(`  Report di Attivazione (ultimo): persone L1 ${q.persone_l1 ?? '—'}, L2 ${q.persone_l2 ?? '—'}`);
  if (modo === 'tracce') console.log(`  da dove: L1 dalla richiesta nata dal check-up ${fonte.richiesta} · L2 dalla prevenzione dell'anno 1 ${fonte.prevenzione} · mai toccati, livello del check-up ${fonte.intatto} · toccati senza traccia del livello iniziale (nessun segno) ${senza}`);
  if (!scrivi) continue;
  const origine = modo === 'tracce' ? 'ricostruito_tracce' : 'ricostruito_livello';
  const il = new Date().toISOString();
  const { error: e0 } = await sb.from('patients').update({ nel_prezzo: null, nel_prezzo_origine: null, nel_prezzo_il: null }).eq('client_id', clientId);
  if (e0) { console.error('  errore:', e0.message); continue; }
  let scritte = 0;
  for (const livello of ['level1', 'level2']) {
    const ids = Object.entries(segno).filter(([, v]) => v === livello).map(([id]) => id);
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await sb.from('patients').update({ nel_prezzo: livello, nel_prezzo_origine: origine, nel_prezzo_il: il }).in('id', ids.slice(i, i + 200)).select('id');
      if (error) console.error('  errore:', error.message); else scritte += (data || []).length;
    }
  }
  console.log(`  scritte ${scritte} righe, origine «${origine}», ${il}`);
}
