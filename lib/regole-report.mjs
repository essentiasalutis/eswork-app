// Regole tassative comuni ai report scritti dall'AI (Attivazione, T3, T6, Annuale).
// Una fonte sola: prima stavano solo nel report di Attivazione, e i report di
// monitoraggio hanno scritto «L1 rischio basso», «interventi fisioterapici» e
// confronti di settore inventati (demo del 18/9).

export const DEFINIZIONE_LIVELLI = `DEFINIZIONE DEI LIVELLI (tassativa — NON invertirla, NON reinterpretarla):
- Livello 1 = dolore in atto CON impatto funzionale. È il gruppo più critico, quello che necessita trattamento osteopatico individuale.
- Livello 2 = dolore in atto SENZA impatto funzionale. Prevenzione attiva.
- Livello 3 = nessun dolore in atto. Formazione collettiva su postura ed ergonomia.
NON esiste una scala "rischio basso/medio/alto": non usarla e non invertire l'ordine. Se citi una priorità, la priorità clinica è il Livello 1.`;

// Solo per i report di monitoraggio: il verso del cambiamento.
export const VERSO_DEI_LIVELLI = 'VERSO (tassativo): se la quota in Livello 1 scende, la situazione è MIGLIORATA; se la quota in Livello 3 sale, la situazione è MIGLIORATA. Il passaggio dal Livello 1 al 2 o al 3 è un miglioramento, mai un peggioramento.';

export const IDENTITA_PROFESSIONALE = 'IDENTITÀ PROFESSIONALE (tassativa): il servizio è OSTEOPATICO. Usa sempre "osteopata", "trattamento osteopatico", "sportello osteopatico". VIETATO "fisioterapista", "fisioterapico", "riabilitativo/riabilitazione" e ogni termine fisioterapico riferito al nostro servizio. VIETATO anche presentare il servizio come atto medico o come medicina del lavoro: mai "medicina osteopatica", "medico", "sanitario", "medicina del lavoro", "sorveglianza sanitaria" riferiti a noi. La sorveglianza sanitaria resta del Medico Competente aziendale; noi siamo un programma osteopatico di prevenzione e trattamento, distinto e complementare.';

export const NIENTE_RIFERIMENTI_INVENTATI = 'RIFERIMENTI (tassativo): usa SOLO i numeri forniti qui sopra. VIETATO inventare medie o valori di settore, soglie, "benchmark", obiettivi attesi o confronti che non ti sono stati dati (niente colonna "benchmark" nelle tabelle). VIETATO citare anni, decreti, articoli di legge o versioni di moduli che non ti sono stati forniti (per l\'OT23 scrivi solo "modello OT23 INAIL"). VIETATO inventare dettagli di erogazione non forniti: durate delle sedute, ore, tempi di ricontatto, cadenze, frequenze, servizi (per esempio sessioni o interventi di gruppo). VIETATO trasformare punti percentuali in numeri di persone o in quote («1 su 2»). I valori "n.d." non sono una criticità: non citarli fra le problematiche.';
