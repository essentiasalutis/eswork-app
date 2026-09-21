// Esiti della pre-validazione come si rileggono dopo: un solo elenco di parole per la
// cartella dell'osteopata e le due copie dei dati (lavoratore e amministratore).
export const ESITI_PREVALIDAZIONE = Object.freeze({
  l1_confirmed: 'Confermato Livello 1',
  reclassified_l2: 'Riclassificato Livello 2',
  reclassified_l3: 'Riclassificato Livello 3',
  needs_more_info: 'Necessita ulteriori informazioni',
});
export const esitoPrevalidazione = v => ESITI_PREVALIDAZIONE[v] || (v ? String(v) : '—');
