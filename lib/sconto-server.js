// ─────────────────────────────────────────────────────────────────────────────
// Prezzo applicato più basso del calcolato — lato server (regole in lib/sconto.mjs,
// garanzie in banca dati v75). Stesso schema dello sforamento (v63): lo stato vive
// sulla scheda dell'azienda, una alla volta; ogni gesto si aggiunge allo storico.
// Si decide fino al Report di Attivazione: dopo, il prezzo è fissato.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import supabase from './db';
import { valutaSconto } from './sconto.mjs';
import { datiOffertaDaCheckup } from './offerta-server';
import { isChainClosed } from './pricing/snapshot';

const MIGRATION = 'Serve la migration v75 (prezzo applicato): applicala in Supabase e riprova.';
const colonnaMancante = e => /column .* does not exist|Could not find the '.*' column/i.test((e && e.message) || '');

async function storicoAttuale(clientId) {
  const { data, error } = await supabase.from('clients').select('sconto_storico').eq('id', clientId).maybeSingle();
  if (error && colonnaMancante(error)) return { v75: false };
  return { v75: true, storico: (data && Array.isArray(data.sconto_storico)) ? data.sconto_storico : [] };
}

export async function registraSconto({ clientId, assessmentId, n, l1, l2, prezzo, motivo, conferma, admin }) {
  if (await isChainClosed(clientId)) return { ok: false, status: 409, errore: 'Il Report di Attivazione è già stato generato: il prezzo dell\'Anno 1 è fissato e non si modifica più.' };
  const d = await datiOffertaDaCheckup({ assessmentId, n, l1, l2 }).catch(() => null);
  if (d && d.errore) return { ok: false, status: 422, errore: d.errore };   // tariffe mancanti (21/9)
  if (!d || !d.calc || !d.client || d.client.id !== clientId) return { ok: false, status: 404, errore: 'Offerta non trovata per questa azienda.' };
  const v = valutaSconto({ prezzoBase: d.prezzoBase, prezzoScontato: Number(prezzo), costo: d.costoAnno1, sogliaPct: d.sogliaMargine, conferma: !!conferma, motivo });
  if (!v.ok) return { ok: false, status: 422, errore: v.messaggio, valutazione: v };
  const s = await storicoAttuale(clientId);
  if (!s.v75) return { ok: false, status: 409, errore: MIGRATION };
  const at = new Date().toISOString();
  const voce = { azione: 'registrato', at, chi: admin, prezzo: Number(prezzo), calcolato: d.prezzoBase, costo: d.costoAnno1, margine_pct: v.marginePct, conferma: !!conferma && v.sottoSoglia, rinnovo_pieno: d.rinnovoPieno, motivo: String(motivo).trim() };
  const { error } = await supabase.from('clients').update({
    sconto_prezzo_applicato: Number(prezzo), sconto_calcolato: d.prezzoBase, sconto_costo: d.costoAnno1,
    sconto_margine_pct: v.marginePct, sconto_rinnovo_pieno: d.rinnovoPieno, sconto_conferma_margine: !!conferma && v.sottoSoglia,
    sconto_motivo: String(motivo).trim(), sconto_at: at, sconto_storico: [...s.storico, voce],
  }).eq('id', clientId);
  if (error) return { ok: false, status: colonnaMancante(error) ? 409 : 500, errore: colonnaMancante(error) ? MIGRATION : `Prezzo applicato non registrato: ${error.message}` };
  return { ok: true, valutazione: v };
}

export async function revocaSconto({ clientId, admin }) {
  if (await isChainClosed(clientId)) return { ok: false, status: 409, errore: 'Il Report di Attivazione è già stato generato: il prezzo dell\'Anno 1 è fissato.' };
  const s = await storicoAttuale(clientId);
  if (!s.v75) return { ok: false, status: 409, errore: MIGRATION };
  const { error } = await supabase.from('clients').update({
    sconto_prezzo_applicato: null, sconto_calcolato: null, sconto_costo: null, sconto_margine_pct: null,
    sconto_rinnovo_pieno: null, sconto_conferma_margine: null, sconto_motivo: null, sconto_at: null,
    sconto_storico: [...s.storico, { azione: 'revocato', at: new Date().toISOString(), chi: admin }],
  }).eq('id', clientId);
  if (error) return { ok: false, status: 500, errore: error.message };
  return { ok: true };
}

// Avviso di revisione dei parametri della forbice: il TETTO porta il margine sotto la
// soglia. Non blocca nulla: registra la prova che la forbice del settore è bassa.
// Idempotente per (azienda, fonte, calcolato, massimo).
export async function registraRevisioneForbice({ d, fonte }) {
  const a = d && d.revisioneForbice;
  if (!a || !d.client) return false;
  const { error } = await supabase.from('forbice_revisioni').insert({
    id: `frv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    client_id: d.client.id, settore: d.client.sector === 1 ? 'manifattura' : 'servizi', dipendenti: parseInt(d.client.employees) || null,
    calcolato: Math.round(a.calcolato), massimo: Math.round(a.massimo), costo: Math.round(a.costo),
    margine_pct: a.marginePct, soglia_pct: a.sogliaPct, fonte,
  });
  return !error;
}
