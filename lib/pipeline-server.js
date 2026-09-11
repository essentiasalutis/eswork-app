// Pipeline — scritture lato server (service_role). La regola sta in lib/pipeline.js.
import supabase from './db';
import { avanzamento } from './pipeline';

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
