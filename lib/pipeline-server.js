// Pipeline — scritture lato server (service_role). La regola sta in lib/pipeline.js.
import supabase from './db';
import { avanzamento, normalizza } from './pipeline';
import { oggiRoma } from './checkup';

// Colonne v55 (promemoria a metà validità): se la migration non c'è ancora si salva il
// resto, senza errori — il promemoria parte quando la v55 è applicata.
export const V55 = ['offerta_aperta_il', 'offerta_sollecito_at'];
const colonnaMancante = e => !!e && (e.code === 'PGRST204' || e.code === '42703');

export async function aggiornaClienteTollerante(id, campi) {
  let r = await supabase.from('clients').update(campi).eq('id', id).select().single();
  if (r.error && colonnaMancante(r.error) && V55.some(k => k in campi)) {
    const senza = { ...campi };
    V55.forEach(k => delete senza[k]);
    if (!Object.keys(senza).length) return { data: null, v55Mancante: true }; // non resta nulla da salvare
    r = await supabase.from('clients').update(senza).eq('id', id).select().single();
    if (!r.error) return { data: r.data, v55Mancante: true };
  }
  if (r.error) throw r.error;
  return { data: r.data, v55Mancante: false };
}

// Porta l'azienda allo stato `target` SOLO se è un passo avanti. Non tocca la data
// dell'ultimo contatto (quella la aggiorna Enrico spostando a mano). Non fatale.
export async function avanzaPipeline(client_id, target) {
  try {
    const { data } = await supabase.from('clients').select('pipeline_stage').eq('id', client_id).maybeSingle();
    if (!data) return null;
    const nuovo = avanzamento(data.pipeline_stage, target);
    if (!nuovo) return null;
    await supabase.from('clients').update({ pipeline_stage: nuovo }).eq('id', client_id);
    return nuovo;
  } catch (_) { return null; }
}

// "Invia offerta via email" dalla pagina Offerta: porta l'azienda in "Offerta aperta"
// (solo in avanti) con la scadenza scelta; se è già aperta aggiorna solo la scadenza.
export async function registraOffertaInviata(client_id, scadeIl) {
  const { data } = await supabase.from('clients').select('pipeline_stage').eq('id', client_id).maybeSingle();
  if (!data) return { trovata: false };
  const attuale = normalizza(data.pipeline_stage);
  let campi = null;
  if (attuale === 'offer_open') campi = { offerta_scade_il: scadeIl };
  else if (avanzamento(attuale, 'offer_open')) campi = { pipeline_stage: 'offer_open', offerta_scade_il: scadeIl, offerta_aperta_il: oggiRoma(), offerta_sollecito_at: null };
  if (!campi) return { trovata: true, spostata: false, stage: attuale };
  const { data: c, v55Mancante } = await aggiornaClienteTollerante(client_id, campi);
  return { trovata: true, spostata: attuale !== 'offer_open', stage: normalizza(c.pipeline_stage), offerta_scade_il: c.offerta_scade_il ?? null, v55Mancante };
}
