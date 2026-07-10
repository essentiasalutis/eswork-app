// ─────────────────────────────────────────────────────────────────────────────
// Loader dei parametri pricing v2 (SOLO SERVER: importa il client service_role).
// Fonde gli override admin di pricing_settings (v38) sui default del codice
// (DEFAULTS_V2 in ./v2): il motore resta puro e riceve i parametri già risolti.
// I testi (argomentari, naming cliente-facing, testo evoluzione) restano in
// `texts` e NON entrano nei fattori numerici. Fail-safe: DB irraggiungibile o
// valore non numerico → default del codice (mai un calcolo con NaN).
// ─────────────────────────────────────────────────────────────────────────────
import supabase from '../db';
import { DEFAULTS_V2 } from './v2';

const NUMERIC_KEYS = new Set(Object.keys(DEFAULTS_V2));

// Nota di validazione in fondo a OGNI report (Attivazione + checkpoint), a schermo
// e nel PDF. Editabile da admin (pricing_settings, chiave 'nota_validazione_report').
// Default nel codice come rete di sicurezza (mai un report senza nota).
export const DEFAULT_NOTA_VALIDAZIONE = 'Questo report è stato elaborato con il supporto di strumenti di intelligenza artificiale e validato da un professionista osteopata di Essentia Salutis, che ne assume la responsabilità clinica.';

export async function getNotaValidazione() {
  try {
    const { data } = await supabase.from('pricing_settings').select('value').eq('version', 'v2').eq('key', 'nota_validazione_report').maybeSingle();
    return (data && data.value) || DEFAULT_NOTA_VALIDAZIONE;
  } catch { return DEFAULT_NOTA_VALIDAZIONE; }
}

// ─── Report Annuale T12 — sezione "L'andamento del programma" ─────────────────
// Testi PARAMETRICI inseriti VERBATIM nel report (mai frasati dall'AI): i {token}
// sono sostituiti in JS con i numeri. Default nel codice come rete fail-safe (mai
// una sezione senza testo) + override editabili da Listino v2 (pricing_settings v2).
// La logica di scelta del template (confronto A vs settore / B anno-su-anno, soglia
// coorte 70%, degrado k-anon) vive in generate-checkpoint-report.js. Letture ONESTE:
// se la prevalenza L1 sale il testo lo dice; il frame-rinnovo appare solo quando il
// vantaggio è misurato (coorte rappresentativa E prevalenza sotto l'atteso di settore).
export const ANDAMENTO_T12_DEFAULTS = {
  report_t12_andamento_titolo: `## L'andamento del programma`,
  report_t12_andamento_intro: `La salute muscolo-scheletrica della popolazione è stata rilevata con la stessa strumentazione a due momenti: all'avvio del programma ({t0N} questionari) e a dodici mesi ({t12N} questionari). Le due rilevazioni riguardano coorti in parte diverse: il confronto è quindi condotto sulle prevalenze — la quota di popolazione in ciascun livello — e non sui conteggi assoluti. La coorte ri-valutata a dodici mesi copre il {ratioPct}% di quella iniziale. I dati che seguono sono aggregati e non riferibili a singoli dipendenti.`,
  report_t12_andamento_a_vantaggio: `**Rispetto al settore.** La prevalenza di Livello 1 — dipendenti con dolore muscolo-scheletrico e impatto funzionale, quindi con necessità di trattamento — osservata {aPoint} è del {obsPct}%, a fronte di un valore medio atteso di settore del {midPct}% per un'azienda che non attua interventi dedicati. La popolazione si colloca {gapPts} punti percentuali al di sotto dell'atteso: un profilo di salute più favorevole del riferimento di settore.`,
  report_t12_andamento_a_pari_sopra: `**Rispetto al settore.** La prevalenza di Livello 1 — dipendenti con dolore muscolo-scheletrico e impatto funzionale — osservata {aPoint} è del {obsPct}%, a fronte di un valore medio atteso di settore del {midPct}%. Su questo indicatore la popolazione non presenta un vantaggio rispetto al riferimento di settore: è l'area prioritaria su cui concentrare il programma nell'anno successivo, a partire dai dipendenti che necessitano di trattamento.`,
  report_t12_andamento_b_riduzione: `**Andamento nei dodici mesi.** Sulla coorte ri-valutata — pari al {ratioPct}% delle persone esaminate all'avvio, quota sufficiente a rendere il confronto rappresentativo — la prevalenza di Livello 1 è passata dal {t0L1pct}% al {t12L1pct}%, con una riduzione di {deltaAbs} punti percentuali. È il risultato osservato al termine del primo anno: una quota inferiore di dipendenti con dolore e impatto funzionale rispetto all'avvio.`,
  report_t12_andamento_b_stabile: `**Andamento nei dodici mesi.** Sulla coorte ri-valutata — pari al {ratioPct}% delle persone esaminate all'avvio — la prevalenza di Livello 1 si è mantenuta stabile, dal {t0L1pct}% all'avvio al {t12L1pct}% a dodici mesi. Il mantenimento del quadro nell'arco dell'anno è coerente con l'obiettivo del programma, che punta a prevenire il deterioramento della salute muscolo-scheletrica nel tempo: è un esito, non un'assenza di risultato.`,
  report_t12_andamento_b_aumento: `**Andamento nei dodici mesi.** Sulla coorte ri-valutata — pari al {ratioPct}% delle persone esaminate all'avvio — la prevalenza di Livello 1 è aumentata, dal {t0L1pct}% al {t12L1pct}% a dodici mesi, con un incremento di {deltaAbs} punti percentuali. Il dato è riportato con trasparenza: nell'anno considerato la quota di dipendenti con dolore e impatto funzionale è cresciuta. È l'area prioritaria su cui concentrare trattamenti mirati e monitoraggio nel ciclo successivo.`,
  report_t12_andamento_b_coorte_parziale: `**Andamento nei dodici mesi (dato indicativo).** A dodici mesi è stato ri-valutato il {ratioPct}% delle persone esaminate all'avvio ({t12N} su {t0N}), una quota inferiore alla soglia del 70% che rende il confronto rappresentativo dell'intera popolazione. La variazione anno-su-anno va quindi letta come indicazione e non come risultato consolidato: sulla coorte disponibile la prevalenza di Livello 1 è del {t12L1pct}%, contro il {t0L1pct}% all'avvio. La lettura di riferimento resta il confronto con il valore atteso di settore riportato sopra.`,
  report_t12_andamento_degrado_kanon: `**Confronto non esprimibile in percentuale.** All'avvio sono stati raccolti {t0N} questionari e a dodici mesi {t12N}. Per almeno una delle due rilevazioni la numerosità è inferiore alla soglia minima di {kMin} persone: su gruppi così piccoli una prevalenza percentuale non può essere al tempo stesso rappresentativa e rispettosa dell'anonimato dei singoli dipendenti, e per questo non viene riportata. Non si tratta di un dato mancante, ma di una tutela prevista per le popolazioni di piccole dimensioni. Il programma prosegue con la stessa strumentazione e i confronti percentuali diventeranno disponibili al crescere delle persone valutate.`,
  report_t12_andamento_chiusura_rinnovo: `**In sintesi.** A dodici mesi la prevalenza di Livello 1 si mantiene al di sotto del valore atteso di settore ({t12L1pct}% contro {midPct}%), su una coorte di copertura adeguata. Il mantenimento di questo vantaggio di salute muscolo-scheletrica è l'esito che il programma è chiamato a produrre: concepito come presidio continuativo, è la continuità nel tempo a produrne il valore preventivo.`,
  report_t12_andamento_chiusura_consolidamento: `**In sintesi.** L'indicazione di quest'anno è un aumento della prevalenza di Livello 1, da leggere con trasparenza come area prioritaria di lavoro. Il programma dell'anno successivo va orientato a intercettare i dipendenti con dolore e impatto funzionale e a riportare la prevalenza verso e sotto il valore atteso di settore, rafforzando la continuità del monitoraggio e dei trattamenti.`,
  report_t12_andamento_chiusura_neutra: `**In sintesi.** I dati di quest'anno costituiscono la base di misura, verificabile e confrontabile, su cui impostare il lavoro dell'anno successivo. La continuità della stessa strumentazione consente di consolidare i risultati dove presenti e di intervenire sulle aree in cui la prevalenza di Livello 1 resta da ridurre, sempre nel rispetto dell'anonimato dei dipendenti.`,
};

// Merge override admin (pricing_settings v2) sui default del codice. Fail-safe:
// DB irraggiungibile o valore vuoto → default del codice (mai una sezione vuota).
export async function getAndamentoT12Texts() {
  const t = { ...ANDAMENTO_T12_DEFAULTS };
  try {
    const keys = Object.keys(ANDAMENTO_T12_DEFAULTS);
    const { data } = await supabase.from('pricing_settings').select('key,value').eq('version', 'v2').in('key', keys);
    for (const row of data || []) {
      if (row.value != null && String(row.value).trim() !== '') t[row.key] = row.value;
    }
  } catch (_) { /* fail-safe: default del codice */ }
  return t;
}

export async function getPricingSettingsV2() {
  const params = { ...DEFAULTS_V2 };
  const texts = {};
  try {
    const { data, error } = await supabase.from('pricing_settings').select('key,value').eq('version', 'v2');
    if (error) throw error;
    for (const row of data || []) {
      if (NUMERIC_KEYS.has(row.key)) {
        const v = Number(row.value);
        if (Number.isFinite(v)) params[row.key] = v;
      } else {
        texts[row.key] = row.value;
      }
    }
  } catch (_) { /* fail-safe: default del codice */ }
  return { params, texts };
}

export async function updatePricingSettingV2(key, value) {
  const { error } = await supabase
    .from('pricing_settings')
    .upsert({ version: 'v2', key, value: String(value), updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ─── Servizi & deliverable (tabella v38) ─────────────────────────────────────
export async function getServiziDeliverable({ soloAttivi = false, configurazione = null } = {}) {
  let q = supabase.from('servizi_deliverable').select('*').order('ordine').order('configurazione');
  if (soloAttivi) q = q.eq('attivo', true);
  if (configurazione) q = q.eq('configurazione', configurazione);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function updateServizioDeliverable(id, fields) {
  // whitelist: voce/configurazione sono strutturali, non si toccano da UI
  const patch = {};
  for (const k of ['valore_dichiarato', 'descrizione_argomentario', 'ordine', 'attivo']) {
    if (fields[k] !== undefined) patch[k] = fields[k];
  }
  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('servizi_deliverable').update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}
