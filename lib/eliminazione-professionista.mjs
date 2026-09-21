// ─────────────────────────────────────────────────────────────────────────────
// ELIMINAZIONE DI UN PROFESSIONISTA — regola pura (.mjs, testata).
//
// Decisione di Enrico (21/9): si elimina solo chi non ha lasciato alcuna traccia
// nella piattaforma, in pratica un professionista creato per errore che non è mai
// entrato. Per tutti gli altri c'è solo «Disattiva», con il messaggio che dice
// perché. Nel dubbio si conserva: se un conteggio manca, l'eliminazione non parte.
//
// Fino al 21/9 l'eliminazione cancellava a mano le sedute e il registro degli
// accessi del professionista: le sedute sono documentazione clinica, il registro è
// la prova di chi ha visto cosa. Qui non si cancella nulla: si conta e basta.
//
// Una riga per ogni colonna della banca dati che punta a un professionista
// (verificate in produzione il 21/9, comprese quelle senza chiave esterna).
// ─────────────────────────────────────────────────────────────────────────────

export const TABELLE_TRACCE = [
  { tabella: 'sessions', colonna: 'professional_id', etichetta: 'sedute' },
  { tabella: 'access_logs', colonna: 'professional_id', etichetta: 'accessi registrati' },
  { tabella: 'treatment_cycles', colonna: 'professional_id', etichetta: 'cicli di trattamento o prevenzione' },
  { tabella: 'patients', colonna: 'assigned_professional_id', etichetta: 'pazienti presi in carico' },
  { tabella: 'patient_documents', colonna: 'professional_id', etichetta: 'documenti dei pazienti' },
  { tabella: 'pre_validations', colonna: 'professional_id', etichetta: 'pre-validazioni' },
  { tabella: 'acute_events', colonna: 'professional_id', etichetta: 'eventi acuti' },
  { tabella: 'waitlist', colonna: 'assigned_professional_id', etichetta: 'assegnazioni dalla lista d\'attesa' },
  { tabella: 'anamnesi_integrazioni', colonna: 'professional_id', etichetta: 'integrazioni dell\'anamnesi' },
  { tabella: 'copie_cartacee', colonna: 'professional_id', etichetta: 'copie firmate su carta' },
  { tabella: 'accordi_trattamento_file', colonna: 'professional_id', etichetta: 'accordi sul trattamento dei dati' },
  { tabella: 'pro_documents', colonna: 'professional_id', etichetta: 'documenti del professionista' },
  { tabella: 'pro_document_access_log', colonna: 'professional_id', etichetta: 'accessi ai documenti del professionista' },
  { tabella: 'email_log', colonna: 'professional_id', etichetta: 'email registrate' },
];

// conteggi: { [tabella]: numero } — un valore mancante o non numerico vale come traccia.
// Ritorna { eliminabile, elementi: [{ etichetta, n }] } con le sole voci presenti.
export function esitoTracce(conteggi) {
  const elementi = [];
  let dubbio = false;
  for (const { tabella, etichetta } of TABELLE_TRACCE) {
    const n = conteggi ? conteggi[tabella] : undefined;
    if (!Number.isInteger(n) || n < 0) { dubbio = true; continue; }
    if (n > 0) elementi.push({ etichetta, n });
  }
  return { eliminabile: !dubbio && elementi.length === 0, dubbio, elementi };
}

export function messaggioTracce(esito, { nome = 'Il professionista', attivo = true } = {}) {
  const dopo = attivo
    ? 'Si può solo disattivare: la disattivazione chiude subito l\'accesso e conserva tutto.'
    : 'È già disattivato: resta così, con i suoi dati conservati.';
  if (esito.dubbio) {
    return `Eliminazione non eseguita: non è stato possibile verificare le tracce di ${nome} nella piattaforma, e nel dubbio si conserva. ${dopo}`;
  }
  const cosa = esito.elementi.map(e => `${e.etichetta} (${e.n})`).join(', ');
  return `Eliminazione non eseguita: ${nome} ha lasciato traccia nella piattaforma — ${cosa}. Sedute e registro degli accessi si conservano. ${dopo}`;
}
