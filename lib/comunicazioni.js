// ─────────────────────────────────────────────────────────────────────────────
// Comunicazioni HR → Essentia Salutis — costanti e validazione (fonte unica per
// pagina HR, pagina admin e API). Modulo PURO: niente DB, usabile anche lato client.
//
// Disegno (deciso 2026-09-11):
//  - l'HR scrive: categoria + testo breve, dal suo link token-gated;
//  - Essentia Salutis risponde in modo STRUTTURATO (stato + eventuale data),
//    MAI con testo libero che l'HR rilegga dal link. Motivo: il link è un
//    segreto condiviso (inoltrabile, rubabile, lasciato su un PC comune). Oggi
//    chi lo possiede può solo SCRIVERE e leggere numeri k-anon; se diventasse un
//    canale di lettura di testo libero, un link finito nelle mani sbagliate
//    esporrebbe la corrispondenza fra ES e l'azienda. Stato + data danno all'HR
//    la sola cosa che gli serve ("l'hanno ricevuta? quando vengono?"); il resto
//    si dice a voce o per email, fuori dal link.
//  - l'HR rilegge categoria / data di invio / stato delle proprie richieste,
//    MAI il proprio testo, per la stessa ragione.
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORIE = {
  postazione_nuova: 'Postazione nuova — serve consulenza ergonomica',
  nuovo_ingresso: 'Nuovo ingresso',
  altro: 'Altro',
};

// Etichette brevi (liste, badge).
export const CATEGORIE_BREVI = {
  postazione_nuova: 'Postazione nuova',
  nuovo_ingresso: 'Nuovo ingresso',
  altro: 'Altro',
};

export const STATI = {
  ricevuta: 'Ricevuta',
  presa_in_carico: 'Presa in carico',
  programmata: 'Programmata',
  chiusa: 'Chiusa',
};

export const TESTO_MAX = 1000;

// Avviso sul testo libero, identico ovunque compaia.
export const AVVISO_PRIVACY = 'Non scrivere nomi di persone né informazioni sulla loro salute. '
  + 'Se un dipendente ha un problema di salute, lo gestisce direttamente con Essentia Salutis '
  + 'attraverso il proprio percorso personale.';

export function validaComunicazione({ categoria, testo } = {}) {
  if (!Object.prototype.hasOwnProperty.call(CATEGORIE, categoria)) return 'categoria non valida';
  const t = typeof testo === 'string' ? testo.trim() : '';
  if (!t) return 'testo mancante';
  if (t.length > TESTO_MAX) return 'testo troppo lungo';
  return null;
}

export function validaAggiornamento({ stato, data_programmata } = {}) {
  if (stato !== undefined && !Object.prototype.hasOwnProperty.call(STATI, stato)) return 'stato non valido';
  if (data_programmata !== undefined && data_programmata !== null && data_programmata !== ''
      && !/^\d{4}-\d{2}-\d{2}$/.test(String(data_programmata))) return 'data non valida';
  return null;
}
