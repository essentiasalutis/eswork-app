// Azienda demo permanente per i convegni (v78, Enrico 21/9) e limite del check-up.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FASCIA_DEMO, CONTATTI_DEMO, FINE_DEMO } from '../lib/demo.mjs';
import { VOCI_PROGRAMMA } from '../lib/programma.js';
import { LIMITE_CHECKUP } from '../lib/limite-checkup.js';

const src = f => fs.readFileSync(f, 'utf8');

test('i testi di Enrico, parola per parola', () => {
  assert.equal(FASCIA_DEMO, 'Modalità dimostrativa: le tue risposte sono anonime e verranno cancellate al termine della presentazione.');
  assert.equal(CONTATTI_DEMO, 'In un programma reale qui inseriresti nome, email e telefono, per essere ricontattato. In questa dimostrazione non servono.');
  assert.equal(FINE_DEMO, 'Le tue risposte sono state registrate. Tra poco le vedremo insieme a quelle della sala, nel report. In questa dimostrazione nessuno ti contatterà e le tue risposte saranno cancellate al termine della presentazione.');
});

test('demo: nessun livello individuale, né a schermo né nella risposta del server', () => {
  const pagina = src('pages/q/c/[client_code].js');
  const fine = pagina.slice(pagina.indexOf('function CompletionDemo'), pagina.indexOf('function CompletionScreen'));
  assert.ok(fine.length > 0 && !/[Ll]ivello|level/.test(fine), 'la schermata finale della demo non parla di livelli');
  assert.match(src('pages/api/self-declare/[client_code].js'), /level: demo \? null : computed_level/);
});

test('voce 12: si promettono i dati degli interventi, non un dossier OT23 che non esiste', () => {
  const v = VOCI_PROGRAMMA.find(x => x.n === 12);
  assert.match(v.cliente, /^Dati e documentazione degli interventi erogati, utilizzabili per la domanda OT23/);
  const testi = ['lib/programma.js', 'lib/leve.js', 'lib/pricing/v1.js', 'pages/dashboard/offer.js'].map(src).join('\n');
  assert.ok(!/Dossier con la documentazione necessaria|documentazione INAIL OT23|La documentazione è prodotta da noi|Documentazione OT23 INAIL/.test(testi));
});

test('limite del check-up: 100 in 10 minuti per le aziende, 300 per la demo', () => {
  assert.deepEqual({ ...LIMITE_CHECKUP }, { azienda: 100, demo: 300, finestraMs: 600000 });
  assert.match(src('pages/api/self-declare/[client_code].js'), /limiteCheckup\(req, \{ fase: 'invio'/);
  assert.match(src('pages/api/consensi/sessione.js'), /limiteCheckup\(req, \{ fase: 'consensi'/);
});

test('demo anonima per costruzione: lo decide il server, non il browser', () => {
  const invio = src('pages/api/self-declare/[client_code].js');
  assert.match(invio, /const demo = !!client\.demo_permanente;/);
  assert.match(invio, /const contatto = !!wants_to_be_contacted && !demo;/);
  assert.match(invio, /ip_hash: demo \? null/);
  assert.ok(!/if \(wants_to_be_contacted && computed_level/.test(invio), 'lista d\'attesa solo con contatto deciso dal server');
  assert.match(invio, /\(r\.canale === 'checkup_demo'\) !== demo/, 'consensi della demo solo per la demo');
  const consensi = src('pages/api/consensi/sessione.js');
  assert.match(consensi, /ipHash: demo \? null/);
  assert.match(consensi, /userAgent: demo \? null/);
  assert.ok(!/b\.canale === 'checkup_demo'/.test(consensi), 'il canale della demo non si sceglie dal browser');
});

test('la fascia su benvenuto, consensi e fine; contatti disattivati', () => {
  const pagina = src('pages/q/c/[client_code].js');
  assert.match(pagina, /\{demo && <FasciaDemo \/>\}/);
  assert.match(pagina, /fascia=\{demo \? <FasciaDemo \/> : null\}/);
  assert.match(pagina, /<fieldset disabled=\{demo\}/);
  assert.match(pagina, /demo: !!client\.demo_permanente/);
});

test('interruttore della parte economica: solo per la demo permanente', () => {
  const gen = src('pages/api/clients/[id]/generate-activation-report.js');
  assert.match(gen, /const senzaPrezzo = !!client\.demo_permanente && client\.demo_mostra_prezzo === false;/);
  // Senza parte economica il report non deve annunciarla (camminata 21/9).
  assert.match(gen, /\$\{quoteBlock \? 'il piano operativo e l\\'investimento sono riportati' : 'il piano operativo è riportato'\} di seguito/);
  assert.match(gen, /\$\{senzaPrezzo \? '\\nPARTE ECONOMICA: in questo report NON c/);
});

test('QR generato in casa: nessun servizio esterno', () => {
  const file = [];
  const giro = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = `${d}/${f.name}`; f.isDirectory() ? giro(p) : /\.(m?js|jsx)$/.test(f.name) && file.push(p); } };
  giro('pages'); giro('components'); giro('lib');
  assert.deepEqual(file.filter(f => /https:\/\/api\.qrserver\.com/.test(src(f))), []);
});

test('elenchi di conformità, ri-stratificazioni, conservazione e registro: senza la demo', () => {
  const store = src('lib/store.js');
  for (const fn of ['getAllPatients', 'getAllRestratAlerts', 'getRetentionReview', 'getAccessLogs']) {
    const corpo = store.slice(store.indexOf(`export async function ${fn}`), store.indexOf('\n}\n', store.indexOf(`export async function ${fn}`)));
    assert.match(corpo, /idDemoPermanente\(\)/, fn);
  }
});

test('v78: l\'azzeramento si rifiuta per ogni altra azienda, in banca dati', () => {
  const sql = src('supabase-schema-v78-demo-permanente.sql');
  assert.match(sql, /IF NOT public\.demo_e_permanente\(p_client\) THEN\s+RAISE EXCEPTION/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.azzera_demo_permanente\(TEXT\) FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_demo_permanente/);
});

test('evento nuovo: ergonomia d\'ufficio ricalcolata e Stima congelata della demo tolta', () => {
  const s = src('lib/demo-permanente-server.js');
  assert.match(s, /ergonomia_ufficio: Math\.max\(0, n - \(parseInt\(s2\.ergonomia_addetti, 10\) \|\| 0\)\)/);
  assert.match(s, /stima_snapshot: null/);
});
