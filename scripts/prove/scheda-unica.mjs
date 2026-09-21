// ─────────────────────────────────────────────────────────────────────────────
// PROVA DAL VIVO: una sola scheda del colloquio per azienda (v77, 21/9).
// Sul server locale (next start, porta 3320) con la banca dati di produzione.
// Crea un'azienda DEMO senza scheda, lancia N salvataggi del colloquio nello stesso
// istante (la corsa che a Industrie Lisa ha creato 15 schede), controlla che resti
// UNA scheda, poi cancella l'azienda di prova.
//
//   node --import ./scripts/demo/risolutore.mjs scripts/prove/scheda-unica.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
process.env.SESSION_SECRET ||= env.SESSION_SECRET;
const { firma } = await import('../../lib/firma-sessione.js');
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const ADMIN = `esw_session=${firma('admin', { email: env.ADMIN_EMAIL, exp: Date.now() + 3600e3 })}`;
const C = 'psk_prova_parallelo';
const N = 5;
let falliti = 0;
const ok = (cond, msg) => { if (!cond) falliti++; console.log(`${cond ? '✓' : '✗ FALLITO'} ${msg}`); };
const pulisci = async () => { await db.from('first_meetings').delete().eq('client_id', C); await db.from('clients').delete().eq('id', C); };

try {
  await pulisci();
  const { error } = await db.from('clients').insert({ id: C, name: 'Prova Salvataggi Paralleli', sector: 1, employees: 40, pipeline_stage: 'contacted', is_demo: true, pricing_version: 'v2', source: 'colloquio' });
  if (error) throw error;
  const salva = i => fetch(`http://localhost:3320/api/first-meeting/${C}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ADMIN },
    body: JSON.stringify({ data: { step1: { nome: 'Prova Salvataggi Paralleli', sector: 'manufacturing', note: `salvataggio ${i}` } }, employees: 40, sector: 1 }),
  }).then(r => r.status);
  const esiti = await Promise.all(Array.from({ length: N }, (_, i) => salva(i + 1)));
  ok(esiti.every(s => s === 200), `${N} salvataggi nello stesso istante: ${esiti.join(', ')}`);
  const { data } = await db.from('first_meetings').select('id, data').eq('client_id', C);
  ok(data.length === 1, `schede dopo la corsa: ${data.length}`);
  ok(data[0] && /^salvataggio \d$/.test(data[0].data.step1.note), `la scheda contiene uno dei salvataggi («${data[0] && data[0].data.step1.note}»)`);
  const { data: c } = await db.from('clients').select('sector').eq('id', C).single();
  ok(c.sector === 1, `settore dell'anagrafica invariato: ${c.sector}`);
} finally {
  await pulisci();
  const { count } = await db.from('clients').select('id', { count: 'exact', head: true }).eq('id', C);
  console.log(`pulizia: azienda di prova residua ${count}`);
}
console.log(falliti ? `\n${falliti} controlli FALLITI` : '\nTutti i controlli passati');
process.exit(falliti ? 1 : 0);
