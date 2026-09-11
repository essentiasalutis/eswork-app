// ─────────────────────────────────────────────────────────────────────────────
// Pipeline commerciale — FONTE UNICA degli stati (pipeline, Finance, dashboard,
// check-up). Modulo PURO, usabile anche lato client. Ordine e nomi decisi da Enrico
// (settembre 2026). Gli id restano quelli già nel database dove esistevano.
// ─────────────────────────────────────────────────────────────────────────────
import { isYmd, aggiungiGiorni } from './checkup';

// Percorso principale, nell'ordine.
export const STAGES = [
  { id: 'contacted',         label: 'Contattato',        color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  { id: 'meeting_scheduled', label: 'Colloquio fissato', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'stima_sent',        label: 'Stima inviata',     color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  { id: 'assessment_sent',   label: 'Check-up inviato',  color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'report_presented',  label: 'Report presentato', color: '#ca8a04', bg: '#fffbeb', border: '#fde68a' },
  { id: 'offer_open',        label: 'Offerta aperta',    color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  { id: 'signed',            label: 'Accettato',         color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
];

// Stati a lato del percorso. "No" e "Declinato" separati di proposito: dicono DOVE
// si perde il lead (alla qualifica o sull'offerta).
export const STAGES_LATERALI = [
  { id: 'not_now', label: 'Non ora',   color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' },
  { id: 'no',      label: 'No',        color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' },
  { id: 'lost',    label: 'Declinato', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
];

export const TUTTI = [...STAGES, ...STAGES_LATERALI];

// Valori vecchi ancora presenti nel database o nel codice (Finance usava 'active'/'closed',
// in produzione c'è un 'won'): si leggono come i nuovi, senza migrare nulla.
const LEGACY = { won: 'signed', active: 'signed', closed: 'lost', prospect: 'contacted' };
export function normalizza(stage) { return LEGACY[stage] || stage || 'contacted'; }

export function trovaStage(stage) {
  const id = normalizza(stage);
  return TUTTI.find(s => s.id === id) || STAGES[0];
}
export function etichetta(stage) { return trovaStage(stage).label; }

export function isFirmato(stage) { return normalizza(stage) === 'signed'; }
export function isChiuso(stage) { const s = normalizza(stage); return s === 'no' || s === 'lost'; }
// Aperto = ancora in trattativa (compreso "Non ora": è un lead in pausa, non perso).
export function isAperto(stage) { return !isFirmato(stage) && !isChiuso(stage); }

// Check-up "aperti non convertiti" (regola dei massimo 3, punto 11): aziende reali che
// hanno fatto o stanno facendo il check-up e non hanno ancora deciso. "Non ora" è in
// pausa e non conta; chi ha firmato (binario A prima del check-up) nemmeno.
export const STAGES_CHECKUP_APERTO = ['assessment_sent', 'report_presented', 'offer_open'];
export function checkupNonConvertiti(clients = []) {
  return clients.filter(c => !c.is_demo && STAGES_CHECKUP_APERTO.includes(normalizza(c.pipeline_stage)));
}

// Movimento automatico SOLO IN AVANTI (decisione Enrico): Stima impegnata → "Stima inviata",
// check-up avviato → "Check-up inviato". Da "Non ora" si riparte (il lead è tornato),
// da Accettato / No / Declinato mai.
export function avanzamento(corrente, target) {
  const c = normalizza(corrente);
  if (c === 'signed' || c === 'no' || c === 'lost') return null;
  const iT = STAGES.findIndex(s => s.id === target);
  if (iT < 0) return null;
  if (c === 'not_now') return target;
  const iC = STAGES.findIndex(s => s.id === c);
  return iT > iC ? target : null;
}

// Agenda "Questa settimana" (dashboard): ricontatti dei "Non ora" e offerte aperte con
// data entro `giorni` (quelle già passate restano in cima, in rosso), più i check-up
// ancora aperti che chiudono nella settimana. `checkups` arriva già filtrato (aperti,
// senza Report di Attivazione dopo). Date 'YYYY-MM-DD' Europa/Roma.
export function agendaSettimana({ clients = [], checkups = [], oggi, giorni = 7 }) {
  const limite = aggiungiGiorni(oggi, giorni);
  const out = [];
  for (const c of clients) {
    const s = normalizza(c.pipeline_stage);
    const base = { client_id: c.id, cliente: c.name, is_demo: !!c.is_demo, binario: c.binario || null };
    if (s === 'not_now' && isYmd(c.ricontatto_il) && c.ricontatto_il <= limite) out.push({ ...base, tipo: 'ricontatto', data: c.ricontatto_il, scaduto: c.ricontatto_il < oggi });
    if (s === 'offer_open' && isYmd(c.offerta_scade_il) && c.offerta_scade_il <= limite) out.push({ ...base, tipo: 'offerta', data: c.offerta_scade_il, scaduto: c.offerta_scade_il < oggi });
  }
  for (const a of checkups) {
    if (isYmd(a.chiude_il) && a.chiude_il >= oggi && a.chiude_il <= limite) out.push({ client_id: a.client_id, cliente: a.cliente, is_demo: !!a.is_demo, binario: a.binario || null, tipo: 'checkup', data: a.chiude_il, scaduto: false });
  }
  const peso = { ricontatto: 0, offerta: 1, checkup: 2 };
  return out.sort((x, y) => x.data.localeCompare(y.data) || peso[x.tipo] - peso[y.tipo]);
}
