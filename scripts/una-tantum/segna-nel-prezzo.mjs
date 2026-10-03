// Una tantum, dopo la v84 (Enrico, 4/10): mette il segno «nel prezzo» sulle persone delle
// aziende che hanno già un Report di Attivazione. Da qui in poi lo scrive la generazione
// del Report (prima della firma).
//
// Due modi, perché il livello calcolato non è sempre quello del check-up iniziale:
//  · «livello»: aziende senza check-up annuale né rivalutazioni → il livello calcolato è
//    ancora quello del check-up (Weisoft, Meccanica);
//  · «tracce»: aziende dove il check-up annuale ha riscritto il livello (Officine demo) →
//    L1 = chi aveva la richiesta di pre-validazione nata dal check-up (waitlist
//    'self_declaration', prima del Report); L2 = chi ha iniziato la prevenzione nel primo
//    anno (nell'anno la prevenzione spetta solo a chi era L2 al check-up).
// Mai i neoassunti. Uso: node scripts/una-tantum/segna-nel-prezzo.mjs [--scrivi]
// Senza --scrivi mostra soltanto cosa farebbe.
import fs from 'node:fs';
for (const r of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = r.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, ''); }
const { createClient } = await import('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const scrivi = process.argv.includes('--scrivi');

const prova = await sb.from('patients').select('nel_prezzo').limit(1);
if (prova.error) { console.error('Manca la v84 (colonna patients.nel_prezzo):', prova.error.message); process.exit(1); }

const { data: reports } = await sb.from('generated_reports').select('client_id, created_at').eq('report_type', 'activation').order('created_at');
const primoReport = {};
for (const r of reports || []) if (!primoReport[r.client_id]) primoReport[r.client_id] = r.created_at;

for (const [clientId, reportIl] of Object.entries(primoReport)) {
  const { data: client } = await sb.from('clients').select('name, data_avvio_programma').eq('id', clientId).maybeSingle();
  if (!client) continue;
  const { data: pazienti } = await sb.from('patients').select('id, computed_level, neoassunto, created_at').eq('client_id', clientId);
  const { count: rivalutazioni } = await sb.from('reassessments_t12').select('id', { count: 'exact', head: true }).eq('client_id', clientId);
  const modo = rivalutazioni > 0 ? 'tracce' : 'livello';
  const segno = {};
  const neo = new Set((pazienti || []).filter(p => p.neoassunto === true).map(p => p.id));
  if (modo === 'livello') {
    for (const p of pazienti || []) if (!neo.has(p.id) && ['level1', 'level2'].includes(p.computed_level)) segno[p.id] = p.computed_level;
  } else {
    const { data: wl } = await sb.from('waitlist').select('patient_id, created_at').eq('client_id', clientId).eq('source', 'self_declaration').lte('created_at', reportIl);
    for (const w of wl || []) if (!neo.has(w.patient_id)) segno[w.patient_id] = 'level1';
    const fineAnno1 = client.data_avvio_programma ? new Date(new Date(client.data_avvio_programma).setFullYear(new Date(client.data_avvio_programma).getFullYear() + 1)).toISOString() : null;
    let q = sb.from('treatment_cycles').select('patient_id, started_at').eq('client_id', clientId).eq('cycle_type', 'prevention');
    if (fineAnno1) q = q.lt('started_at', fineAnno1);
    const { data: prev } = await q;
    for (const c of prev || []) if (!neo.has(c.patient_id) && !segno[c.patient_id]) segno[c.patient_id] = 'level2';
  }
  const l1 = Object.values(segno).filter(v => v === 'level1').length;
  const l2 = Object.values(segno).filter(v => v === 'level2').length;
  console.log(`${client.name} (${clientId}) — modo ${modo}: L1 ${l1}, L2 ${l2} su ${(pazienti || []).length} persone`);
  if (!scrivi) continue;
  const { error: e0 } = await sb.from('patients').update({ nel_prezzo: null }).eq('client_id', clientId);
  if (e0) { console.error('  errore:', e0.message); continue; }
  for (const livello of ['level1', 'level2']) {
    const ids = Object.entries(segno).filter(([, v]) => v === livello).map(([id]) => id);
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await sb.from('patients').update({ nel_prezzo: livello }).in('id', ids.slice(i, i + 200));
      if (error) console.error('  errore:', error.message);
    }
  }
  console.log('  scritto.');
}
