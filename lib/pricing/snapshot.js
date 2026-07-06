// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Stima→Report (pricing v2). Congela, al momento della Stima consegnata
// (store=true), i parametri di calcolo E la forbice promessa. Vive in
// first_meetings.stima_snapshot (colonna separata da `data`).
//
// REGOLE (confermate):
//  - lo snapshot si scrive/sovrascrive a OGNI Stima consegnata (store=true):
//    la promessa valida è l'ultima Stima;
//  - dal momento in cui esiste un Report di Attivazione la catena è CHIUSA:
//    lo snapshot è congelato e non più sovrascrivibile;
//  - lettura (Blocco B): snapshot → live → default; il flag quote_compliance
//    confronta il prezzo reale (parametri snapshottati) contro la forbice
//    persistita, mai contro una ricalcolata.
// Questo modulo copre SOLO scrittura + gate di freeze + resolver di lettura.
// ─────────────────────────────────────────────────────────────────────────────
import supabase from '../db';
import { generateId, getFirstMeeting, getGeneratedReportsByClient } from '../store';

// Compatta la forbice a ciò che serve a documento + flag (price_y1/pct/l1 + y2).
function trimScenario(s) {
  if (!s) return null;
  return { pct: s.pct, l1: s.l1, l2: s.l2, price_y1: s.price_y1, price_y2: s.price_y2 };
}
export function trimForchetta(fch) {
  if (!fch) return null;
  return { min: trimScenario(fch.min), avg: trimScenario(fch.avg), max: trimScenario(fch.max) };
}

// La catena è chiusa quando esiste (almeno) un Report di Attivazione.
export async function isChainClosed(client_id) {
  try {
    const reps = await getGeneratedReportsByClient(client_id);
    return (reps || []).some(r => r.report_type === 'activation');
  } catch { return false; }
}

export function buildStimaSnapshot({ pricingVersion, tipoProdotto, inputs, v2Params, forchetta, pacchettoPrice, at }) {
  return {
    at,
    pricing_version: pricingVersion || 'v2',
    tipo_prodotto: tipoProdotto || 'programma_completo',
    inputs: inputs || null,
    v2Params: v2Params || null,
    forchetta: trimForchetta(forchetta),
    pacchetto_price: pacchettoPrice != null ? pacchettoPrice : null,
    frozen_at: null,
  };
}

// Scrive/sovrascrive lo snapshot SOLO se la catena è aperta (nessun Report).
// Ritorna { written, frozen, snapshot }: se frozen, lo snapshot esistente resta.
export async function writeStimaSnapshotIfOpen(client_id, snapshot) {
  const fm = await getFirstMeeting(client_id);
  const existing = fm?.stima_snapshot || null;
  if (await isChainClosed(client_id)) {
    return { written: false, frozen: true, snapshot: existing };
  }
  if (fm) {
    const { error } = await supabase.from('first_meetings')
      .update({ stima_snapshot: snapshot, updated_at: new Date().toISOString() })
      .eq('client_id', client_id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('first_meetings')
      .insert({ id: generateId('fm'), client_id, stima_snapshot: snapshot, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  }
  return { written: true, frozen: false, snapshot };
}

// Resolver di lettura (usato da Blocco B in offer/report): ritorna lo snapshot
// congelato se presente, altrimenti null → il chiamante ricade sul path live.
export function getStimaSnapshot(firstMeeting) {
  return firstMeeting?.stima_snapshot || null;
}

// Timbra frozen_at alla generazione del Report (Blocco B lo chiamerà).
export async function freezeStimaSnapshot(client_id) {
  const fm = await getFirstMeeting(client_id);
  const snap = fm?.stima_snapshot;
  if (!snap || snap.frozen_at) return;
  await supabase.from('first_meetings')
    .update({ stima_snapshot: { ...snap, frozen_at: new Date().toISOString() }, updated_at: new Date().toISOString() })
    .eq('client_id', client_id);
}
