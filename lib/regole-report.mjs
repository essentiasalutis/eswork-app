// Regole tassative comuni ai report scritti dall'AI (Attivazione, T3, T6, Annuale).
// Una fonte sola: prima stavano solo nel report di Attivazione, e i report di
// monitoraggio hanno scritto «L1 rischio basso», «interventi fisioterapici» e
// confronti di settore inventati (demo del 18/9).
import { PROTOCOLLO } from './protocollo.mjs';

export const DEFINIZIONE_LIVELLI = `DEFINIZIONE DEI LIVELLI (tassativa — NON invertirla, NON reinterpretarla):
- Livello 1 = dolore in atto CON impatto funzionale. È il gruppo più critico, quello che necessita trattamento osteopatico individuale.
- Livello 2 = dolore in atto SENZA impatto funzionale. Prevenzione attiva.
- Livello 3 = nessun dolore in atto. Formazione collettiva su postura ed ergonomia.
NON esiste una scala "rischio basso/medio/alto": non usarla e non invertire l'ordine. Se citi una priorità, la priorità clinica è il Livello 1.`;

// Solo per i report di monitoraggio: il verso del cambiamento.
export const VERSO_DEI_LIVELLI = 'VERSO (tassativo): se la quota in Livello 1 scende, la situazione è MIGLIORATA; se la quota in Livello 3 sale, la situazione è MIGLIORATA. Il passaggio dal Livello 1 al 2 o al 3 è un miglioramento, mai un peggioramento.';

export const IDENTITA_PROFESSIONALE = 'IDENTITÀ PROFESSIONALE (tassativa): il servizio è OSTEOPATICO. Usa sempre "osteopata", "trattamento osteopatico", "sportello osteopatico". VIETATO "fisioterapista", "fisioterapico", "riabilitativo/riabilitazione" e ogni termine fisioterapico riferito al nostro servizio. VIETATO anche presentare il servizio come atto medico o come medicina del lavoro: mai "medicina osteopatica", "medico", "sanitario", "medicina del lavoro", "sorveglianza sanitaria" riferiti a noi. La sorveglianza sanitaria resta del Medico Competente aziendale; noi siamo un programma osteopatico di prevenzione e trattamento, distinto e complementare.';

export const NIENTE_RIFERIMENTI_INVENTATI = 'RIFERIMENTI (tassativo): usa SOLO i numeri forniti qui sopra. VIETATO inventare medie o valori di settore, soglie, "benchmark", obiettivi attesi o confronti che non ti sono stati dati (niente colonna "benchmark" nelle tabelle). VIETATO citare anni, decreti, articoli di legge o versioni di moduli che non ti sono stati forniti (per l\'OT23 scrivi solo "modello OT23 INAIL"). VIETATO inventare dettagli di erogazione non forniti: durate delle sedute, ore, tempi di ricontatto, cadenze, frequenze, servizi (per esempio sessioni o interventi di gruppo). VIETATO trasformare punti percentuali in numeri di persone o in quote («1 su 2»). VIETATO qualificare i numeri con paragoni che non ti sono stati dati: niente «in linea con», «superiore/inferiore alla media», «standard», «atteso», «eccellente», «significativo» riferiti ai risultati. I valori "n.d." non sono una criticità: non citarli fra le problematiche.';

// Cosa il programma prevede GIÀ. Senza questo l'AI raccomandava cose che esistono
// da contratto («anticipare il check-up a 6 mesi») o servizi che non vendiamo
// («interventi osteopatici di gruppo»). I numeri vengono dal protocollo.
export function programmaPrevisto(p = PROTOCOLLO) {
  return `COSA PREVEDE GIÀ IL PROGRAMMA (da contratto, ogni anno di programma):
- check-up a sei mesi e check-up annuale per TUTTI i dipendenti, con le stesse domande del check-up iniziale;
- mini-check a tre e a sei mesi dall'inizio del percorso, per chi è seguito dall'osteopata;
- percorso di trattamento individuale per il Livello 1: ${p.sedute_per_ciclo} sedute da ${p.durata_seduta_min} minuti, fino a ${p.cicli_trattamento_per_anno} percorsi a persona, preceduti da una pre-validazione clinica di ${p.durata_prevalidazione_min} minuti;
- prevenzione attiva individuale per il Livello 2: ${p.sessioni_prevenzione_l2} sessioni da ${p.durata_seduta_min} minuti;
- formazione collettiva su postura ed ergonomia aperta a TUTTI i dipendenti: ${p.formazione_moduli_primo_anno} moduli nel primo anno, ${p.formazione_moduli_anni_successivi} negli anni successivi, più la consulenza ergonomica delle postazioni;
- segnalazione di un disturbo nuovo dall'area personale del dipendente (${p.autosegnalazioni_per_anno} nell'anno), con ricontatto dell'osteopata.
RACCOMANDAZIONI (tassativo): scegli SOLO fra questi strumenti e presentale come continuità o uso mirato di ciò che è già previsto. VIETATO proporre servizi diversi (per esempio sessioni o interventi di gruppo, counseling), rilevazioni in più, frequenze o tempi diversi da quelli elencati.`;
}

// Sedute chiuse divise fra trattamento e prevenzione, dal tipo del loro ciclo.
// Una seduta il cui ciclo non si conosce NON si attribuisce a nessuno dei due: il
// 18/9 la query non portava cycle_id e tutte finivano nel trattamento, e l'AI ha
// scritto «0 sessioni di prevenzione, rallentamento operativo».
export function divisioneSedute(sessions, cicli, durataMin = PROTOCOLLO.durata_seduta_min) {
  const tipo = Object.fromEntries((cicli || []).map(c => [c.id, c.cycle_type || 'treatment']));
  const conta = { treatment: 0, prevention: 0, ignote: 0 };
  for (const s of sessions || []) {
    if (!s.closed_at) continue;
    const t = s.cycle_id ? tipo[s.cycle_id] : null;
    if (t === 'treatment' || t === 'prevention') conta[t]++; else conta.ignote++;
  }
  const ore = n => Math.round(n * durataMin / 60);
  return { trattamento: conta.treatment, prevenzione: conta.prevention, ignote: conta.ignote, ore, divisibile: conta.ignote === 0 };
}

// Formazione ed ergonomia già erogate (dato organizzativo, solo conteggi). Senza
// questa riga l'AI raccomandava di «avviare la formazione» anche a moduli già fatti.
export function rigaFormazione(sessioni) {
  const erogate = (sessioni || []).filter(s => s.stato === 'erogata');
  const formazione = erogate.filter(s => s.tipo !== 'ergonomia').length;
  const ergonomia = erogate.filter(s => s.tipo === 'ergonomia').length;
  return `- Formazione collettiva: ${formazione} sessioni di formazione già erogate, ${ergonomia} interventi di ergonomia già fatti${formazione > 0 ? ' (la formazione è GIÀ attiva: non proporre di avviarla, al più di proseguirla)' : ' (nessuna sessione ancora erogata)'}`;
}
