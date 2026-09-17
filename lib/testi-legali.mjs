// ─────────────────────────────────────────────────────────────────────────────
// TESTI LEGALI — regole pure (.mjs, testate). Nessun import, nessun DB.
//
// Decisione di Enrico (17/9): il testo legale vive in UN SOLO posto — l'archivio
// `testi_legali` in banca dati, immutabile. Il codice non ne tiene copia. Fra
// cinque anni si deve poter ricostruire esattamente cosa ha letto una persona,
// senza dipendere da git.
//
// Questo modulo definisce la FORMA CANONICA di un testo: la serializzazione fissa
// da cui si calcola l'impronta SHA-256. La stessa funzione genera il testo
// canonico al momento della pubblicazione e lo ricontrolla a ogni lettura: se il
// contenuto strutturato e l'impronta non tornano, il testo non si serve.
// ─────────────────────────────────────────────────────────────────────────────

// Documenti che l'archivio conosce. `titolare` è la ragione giuridica per cui due
// informative restano due: quella del check-up la rende Essentia Salutis, quella
// estesa della prima seduta il professionista, titolare della documentazione clinica.
export const DOCUMENTI = {
  informativa_checkup:  { titolare: 'essentia_salutis', consensi: ['privacy', 'salute'] },
  consenso_trattamento: { titolare: 'professionista',   consensi: ['trattamento'] },
  informativa_estesa:   { titolare: 'professionista',   consensi: ['informativa_estesa'] },
};

// Quanto a lungo una versione appena ritirata resta accettabile: chi stava
// leggendo quando è uscita la nuova ha letto QUELLA, e va registrata così.
export const TOLLERANZA_RITIRO_MIN = 60;

const norm = (t) => String(t == null ? '' : t).normalize('NFC').replace(/\r\n?/g, '\n');

// Forma canonica. Ordine e separatori FISSI: cambiarli cambia tutte le impronte,
// quindi questa funzione non si tocca mai (se servisse, una seconda funzione con
// un numero di schema, mai una modifica a questa).
export function testoCanonico(contenuto) {
  const c = contenuto || {};
  const righe = [];
  righe.push(`# ${norm(c.titolo)}`);
  if (c.sottotitolo) righe.push(norm(c.sottotitolo));
  if (c.riferimento) righe.push(norm(c.riferimento));
  for (const s of c.sezioni || []) {
    righe.push('');
    righe.push(`## ${norm(s.titolo)}`);
    righe.push(norm(s.testo));
  }
  const consensi = c.consensi || {};
  const chiavi = Object.keys(consensi).sort();
  if (chiavi.length) {
    righe.push('');
    righe.push('## Consensi');
    for (const k of chiavi) righe.push(`[${k}] ${norm(consensi[k])}`);
  }
  if (c.dichiarazione_firma) {
    righe.push('');
    righe.push('## Firma');
    righe.push(norm(c.dichiarazione_firma));
  }
  return righe.join('\n');
}

// Una versione si può registrare se è in vigore, oppure ritirata da meno della
// tolleranza. Tutto il resto si rifiuta: il server non registra mai una versione
// che non ha servito lui.
export function versioneAccettabile(riga, adesso = new Date(), tolleranzaMin = TOLLERANZA_RITIRO_MIN) {
  if (!riga) return false;
  if (riga.stato === 'in_vigore') return true;
  if (riga.stato === 'ritirata' && riga.ritirato_il) {
    return (adesso.getTime() - new Date(riga.ritirato_il).getTime()) <= tolleranzaMin * 60000;
  }
  return false;
}

// I consensi obbligatori di un documento: ciascuno deve arrivare come `true`
// esplicito. Un valore assente, una stringa, un 1: rifiutati.
export function consensiMancanti(documento, valori = {}) {
  const d = DOCUMENTI[documento];
  if (!d) return ['documento_sconosciuto'];
  return d.consensi.filter(k => valori[k] !== true);
}
