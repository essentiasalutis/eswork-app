// ─────────────────────────────────────────────────────────────────────────────
// PROVA DAL VIVO del ruolo medico competente (21/9). Sul server locale (next start,
// porta 3320) che usa la banca dati di produzione. Lavora SOLO su aziende demo e
// alla fine cancella ciò che ha creato. Restano, per scelta del registro (solo in
// aggiunta), le righe senza azienda del medico di prova (login, cambio password).
//
//   node --import ./scripts/demo/risolutore.mjs scripts/prove/medico-competente.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
process.env.SESSION_SECRET ||= env.SESSION_SECRET;
const { firma } = await import('../../lib/firma-sessione.js');
const { terminiCommerciali } = await import('../../lib/medico-competente.mjs');
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const B = 'http://localhost:3320', D = 'dmo_officine';
const { data: demo } = await db.from('clients').select('id').eq('is_demo', true);
const ALTRA = (demo || []).map(c => c.id).find(id => id !== D);
const exp = Date.now() + 3600e3;
const ADMIN = `esw_session=${firma('admin', { email: env.ADMIN_EMAIL, exp })}`;
const call = async (metodo, url, cookie, body) => { const r = await fetch(B + url, { method: metodo, redirect: 'manual', headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined }); let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch { } return { s: r.status, j, t, setCookie: r.headers.get('set-cookie') }; };
let falliti = 0;
const ok = (cond, msg) => { if (!cond) falliti++; console.log(`${cond ? '✓' : '✗ FALLITO'} ${msg}`); };
const REP = 'rep_prova_mc_' + Date.now();
let M = null;

try {
  const { data: reale } = await db.from('clients').select('id').eq('is_demo', false).limit(1);
  console.log('— Preparazione (amministratore)');
  const pw = 'prova-medico-' + Math.random().toString(36).slice(2, 10);
  const cr = await call('POST', '/api/admin/medici-competenti', ADMIN, { azione: 'crea', nome: 'Dott.ssa Prova Medico', email: `mc.prova.${Date.now()}@example.invalid`, password: pw });
  ok(cr.s === 200, `creazione medico di prova (${cr.s})`); M = cr.j.medico;
  const ar = await call('POST', '/api/admin/medici-competenti', ADMIN, { azione: 'assegna', medicoId: M.id, clientId: reale[0].id });
  ok(ar.s === 409 && /informativa del check-up in vigore non prevede/.test(ar.j.error) && ['informativa', 'accordo', 'dichiarazione_presidi'].every(x => ar.j.mancanti.includes(x)), `azienda REALE con l'informativa attuale: rifiutata — «${(ar.j.error || '').slice(0, 100)}…»`);
  ok((await call('POST', '/api/admin/medici-competenti', ADMIN, { azione: 'assegna', medicoId: M.id, clientId: D })).s === 200, 'assegnazione alla demo');
  for (const [tipo, nome] of [['reparto', 'Linea confezionamento'], ['reparto', 'Magazzino'], ['mansione', 'Carrellisti']]) await call('POST', '/api/admin/medici-competenti/reparti', ADMIN, { azione: 'crea', clientId: D, tipo, nome });
  await call('POST', '/api/admin/medici-competenti/reparti', ADMIN, { azione: 'crea', clientId: ALTRA, tipo: 'reparto', nome: 'Sportello' });
  const { data: repD } = await db.from('mc_reparti').select('id, nome').eq('client_id', D);
  const { data: repA } = await db.from('mc_reparti').select('id').eq('client_id', ALTRA);
  const { data: t12 } = await db.from('generated_reports').select('*').eq('client_id', D).eq('report_type', 'checkpoint_t12').order('created_at', { ascending: false }).limit(1).single();
  await db.from('generated_reports').insert({ ...t12, id: REP, validato_da: 'Dott. Enrico Maiolo, osteopata, responsabile clinico del programma', validato_il: new Date().toISOString(), validazioni: [] });
  const { data: nonValidato } = await db.from('generated_reports').select('id').eq('client_id', D).eq('report_type', 'checkpoint_t3').is('validato_il', null).limit(1).single();
  const { data: attivazione } = await db.from('generated_reports').select('id').eq('client_id', D).eq('report_type', 'activation').limit(1).single();

  console.log('— Accesso del medico');
  const lg = await call('POST', '/api/mc/auth/login', '', { email: M.email, password: pw });
  const MC = (lg.setCookie || '').split(';')[0];
  ok(lg.s === 200 && lg.j.cambioPassword === true && MC.startsWith('esw_mc_session='), 'login con la password iniziale: chiede il cambio');
  ok((await call('GET', '/api/mc/aziende', MC)).s === 403, 'prima del cambio password: dati non accessibili (403)');
  ok((await call('POST', '/api/mc/auth/login', '', { email: M.email, password: 'sbagliata-123' })).s === 401, 'password sbagliata: 401');
  ok((await call('POST', '/api/mc/auth/cambio-password', MC, { password: pw + '-nuova' })).s === 200, 'cambio password');
  const az = await call('GET', '/api/mc/aziende', MC);
  ok(az.s === 200 && az.j.aziende.length === 1 && az.j.aziende[0].clientId === D, `elenco aziende: solo quella assegnata (${az.j.aziende.map(a => a.nome).join(', ')})`);

  console.log('— A. Stessi dati dell\'azienda, niente commerciale');
  const sMc = await call('GET', `/api/mc/${D}/sintesi`, MC);
  const sAz = await call('POST', `/api/clients/${D}/sintesi`, ADMIN);
  const taglia = (h, fine) => h.slice(h.indexOf('<h2>La fotografia</h2>'), h.indexOf(fine)).trim();
  const bloccoAz = taglia(sAz.j.html, '<h2>Il vostro programma nel primo anno</h2>'), bloccoMc = taglia(sMc.j.html, '<div class="foot">');
  ok(bloccoAz.length > 200 && bloccoAz === bloccoMc, `Sintesi: blocchi sanitari identici a quelli dell'azienda, carattere per carattere (${bloccoMc.length} caratteri)`);
  ok(terminiCommerciali(sAz.j.html).length > 0, `controllo della prova: nella Sintesi dell'azienda i termini commerciali ci sono (${terminiCommerciali(sAz.j.html).join(', ')})`);
  ok(terminiCommerciali(sMc.j.html).length === 0, 'Sintesi del medico: zero termini commerciali');
  const rl = await call('GET', `/api/mc/${D}/report`, MC);
  ok(rl.j.report.length === 1 && rl.j.report[0].id === REP, `elenco report: solo quelli validati (${rl.j.report.map(r => r.etichetta).join(', ')})`);
  const rh = await call('GET', `/api/mc/${D}/report/${REP}`, MC);
  const { buildReportHtml } = await import('../../lib/pdf.js'); const { testoConValidazione } = await import('../../lib/validazione.js');
  const { data: cl } = await db.from('clients').select('*').eq('id', D).single();
  const { data: recRep } = await db.from('generated_reports').select('*').eq('id', REP).single();
  const pdfAzienda = buildReportHtml({ client: cl, report_type: recRep.report_type, content_text: testoConValidazione(recRep.content_text, recRep), checkpoint: recRep.checkpoint });
  ok(rh.s === 200 && rh.j.html === pdfAzienda, 'report: lo stesso HTML del PDF consegnato all\'azienda');
  ok(terminiCommerciali(rh.j.html).length === 0, 'report del medico: zero termini commerciali');
  const ri = await call('POST', `/api/mc/${D}/riunione`, MC);
  ok(ri.s === 200 && ri.j.html.includes('art. 35 D.Lgs. 81/08') && ri.j.html.includes(bloccoMc), 'documento per la riunione: copertina + gli stessi blocchi sanitari');
  ok(terminiCommerciali(ri.j.html).length === 0, 'documento per la riunione: zero termini commerciali');

  console.log('— B. Indicazioni');
  const rep = repD.find(r => r.nome === 'Magazzino').id;
  const { data: paz } = await db.from('patients').select('last_name').eq('client_id', D).neq('last_name', 'Nome non indicato').limit(1).single();
  const conCognome = await call('POST', `/api/mc/${D}/indicazioni`, MC, { reparto_id: rep, testo: `movimentazione pesante, lo riferisce ${paz.last_name.toLowerCase()} spesso` });
  ok(conCognome.s === 400 && !new RegExp(paz.last_name, 'i').test(conCognome.j.error), `con un cognome dell'anagrafica: rifiutata, senza ripeterlo`);
  ok((await call('POST', `/api/mc/${D}/indicazioni`, MC, { reparto_id: rep, testo: 'matricola 00457 con dolore' })).s === 400, 'con una matricola: rifiutata');
  ok((await call('POST', `/api/mc/${D}/indicazioni`, MC, { reparto_id: rep, testo: 'come dice Mario Bianchi' })).s === 400, 'con «Nome Cognome»: rifiutata');
  ok((await call('POST', `/api/mc/${D}/indicazioni`, MC, { reparto_id: repA[0].id, testo: 'x' })).s === 400, 'con il reparto di un\'altra azienda: rifiutata');
  const buona = await call('POST', `/api/mc/${D}/indicazioni`, MC, { reparto_id: rep, testo: 'Sollevamenti ripetuti da terra, pallet senza sponde' });
  ok(buona.s === 200 && buona.j.mie.length === 1, 'reparto dall\'elenco + nota breve: registrata');
  const { data: indRow } = await db.from('mc_indicazioni').select('id').eq('medico_id', M.id).single();
  ok((await call('POST', '/api/admin/medici-competenti/indicazioni', ADMIN, { azione: 'non_utilizzabile', id: indRow.id, motivo: 'Prova della marcatura' })).s === 200, 'coordinamento: marcata «non utilizzabile»');
  const adm = await call('GET', `/api/admin/medici-competenti/indicazioni?clientId=${D}`, ADMIN);
  ok(adm.j.indicazioni[0].non_utilizzabile_motivo === 'Prova della marcatura' && adm.j.indicazioni[0].testo.startsWith('Sollevamenti'), 'la marcatura resta visibile e il testo non si perde');
  const mie = await call('GET', `/api/mc/${D}/indicazioni`, MC);
  ok(!('non_utilizzabile_motivo' in mie.j.mie[0]), 'il medico vede le sue indicazioni, non la valutazione interna');

  console.log('— Prove avversariali con la sessione del medico');
  const { data: pz } = await db.from('patients').select('id').eq('client_id', D).not('assigned_professional_id', 'is', null).limit(1).single();
  const tentativi = [
    [`/api/pro/patients/${pz.id}`, 'cartella clinica'], [`/api/pro/patients/${pz.id}/anamnesi`, 'anamnesi'],
    [`/api/pro/patients/${pz.id}/sessions`, 'sedute e note di trattamento'], [`/api/pro/patients/documents?patientId=${pz.id}`, 'documenti firmati'],
    ['/api/pro/dashboard', 'elenco pazienti dell\'osteopata'], [`/api/clients/${D}/patients`, 'elenco pazienti dell\'azienda'],
    [`/dashboard/${D}`, 'scheda azienda'], [`/dashboard/patients/${pz.id}/export`, 'esportazione cartella'],
    [`/dashboard/dipendenti/${D}`, 'anagrafica dipendenti'], [`/api/org/${D}/export`, 'esportazione anagrafica'],
    ['/api/admin/medici-competenti', 'gestione medici (admin)'],
    [`/api/mc/${ALTRA}/sintesi`, 'Sintesi di un\'azienda NON assegnata'], [`/api/mc/${ALTRA}/report`, 'report di un\'azienda NON assegnata'],
    [`/api/mc/${ALTRA}/indicazioni`, 'reparti di un\'azienda NON assegnata'], [`/mc/${ALTRA}`, 'pagina di un\'azienda NON assegnata'],
    [`/api/mc/${D}/report/${nonValidato.id}`, 'report NON validato'], [`/api/mc/${D}/report/${attivazione.id}`, 'report di Attivazione (prezzo)'],
    [`/api/mc/..%2F..%2Fapi%2Fclients/sintesi`, 'identificativo manipolato'],
  ];
  for (const [u, cosa] of tentativi) { const r = await call('GET', u, MC); ok([401, 403, 404, 307, 308].includes(r.s), `${cosa}: rifiutato (${r.s})`); }
  const valore = MC.split('=').slice(1).join('=');
  ok((await call('GET', `/api/clients/${D}/patients`, `esw_session=${valore}`)).s === 401, 'sessione del medico nel cookie dell\'amministratore: 401');
  ok((await call('GET', `/api/pro/patients/${pz.id}`, `esw_pro_session=${valore}`)).s === 401, 'sessione del medico nel cookie dell\'osteopata: 401');
  ok((await call('GET', '/api/mc/aziende', `esw_mc_session=${firma('professional', { medicoId: M.id, exp })}`)).s === 401, 'sessione con la chiave degli osteopati usata come medico: 401');
  ok((await call('GET', '/api/mc/aziende', `esw_mc_session=${firma('medico_competente', { medicoId: 'mc_inesistente', exp })}`)).s === 401, 'sessione per un medico inesistente: 401');

  console.log('— Revoca e disattivazione a metà sessione');
  const { data: rel } = await db.from('medico_aziende').select('id').eq('medico_id', M.id).is('revocato_il', null).single();
  await call('POST', '/api/admin/medici-competenti', ADMIN, { azione: 'revoca', relazioneId: rel.id });
  ok((await call('GET', `/api/mc/${D}/sintesi`, MC)).s === 404, 'dopo la revoca, stessa sessione: Sintesi 404');
  ok((await call('GET', '/api/mc/aziende', MC)).j.aziende.length === 0, 'dopo la revoca: nessuna azienda');
  await call('POST', '/api/admin/medici-competenti', ADMIN, { azione: 'disattiva', medicoId: M.id });
  ok((await call('GET', '/api/mc/aziende', MC)).s === 401, 'medico disattivato, stessa sessione: 401');

  console.log('— Registro');
  const { data: log } = await db.from('mc_accessi').select('azione, esito').eq('medico_id', M.id);
  const rif = log.filter(l => l.esito === 'rifiutato').length;
  ok(['sintesi', 'report', 'riunione_art35', 'indicazione'].every(a => log.some(l => l.azione === a)) && rif >= 5, `registro: ${log.length} righe, di cui ${rif} rifiutate`);
} finally {
  // Pulizia: solo righe delle aziende demo (le uniche cancellabili) e i dati di prova.
  const idDemo = (demo || []).map(c => c.id);
  for (const t of ['mc_accessi', 'mc_indicazioni', 'medico_aziende', 'mc_reparti']) await db.from(t).delete().in('client_id', idDemo);
  if (M) await db.from('medici_competenti').delete().eq('id', M.id);
  await db.from('generated_reports').delete().eq('id', REP);
  const { data: resto } = await db.from('mc_accessi').select('id').eq('medico_id', M ? M.id : '-');
  console.log(`— Pulizia fatta. Restano ${resto ? resto.length : 0} righe senza azienda nel registro del medico di prova (solo in aggiunta).`);
  console.log(falliti ? `\n${falliti} PROVE FALLITE` : '\nTutte le prove passate.');
}
