// ─────────────────────────────────────────────────────────────────────────────
// COPIA CARTACEA DEL CONSENSO (punto d) — regole pure (.mjs, testate).
//
// Decisioni di Enrico (17/9):
//   · la firma in piattaforma è la regola, la carta l'eccezione, con MOTIVO
//     obbligatorio (per vedere se l'eccezione sta diventando la regola);
//   · la copia vale solo con la versione dall'ARCHIVIO in vigore alla data della
//     firma, caricata entro 7 GIORNI dalla data dichiarata; altrimenti il
//     documento va rifatto;
//   · niente stato intermedio: la copia conta solo dopo che il server l'ha
//     accettata. Queste funzioni decidono se accettarla.
//
// Le date sono GIORNI ITALIANI (Europe/Rome): una firma di stamattina caricata
// dopo mezzanotte non deve risultare «del giorno prima».
// ─────────────────────────────────────────────────────────────────────────────

export const GIORNI_MAX = 7;
export const BYTE_MAX = 10 * 1024 * 1024;

// Documento in cartella → codice del testo nell'archivio (v64).
export const CODICE_PER_DOCUMENTO = {
  consent_treatment: 'consenso_trattamento',
  privacy_extended: 'informativa_estesa',
};

// Consenso registrato nel registro per ciascun documento (come la firma in cartella).
export const CONSENSO_PER_DOCUMENTO = {
  consent_treatment: 'trattamento',
  privacy_extended: 'informativa_estesa',
};

export const MOTIVI = {
  tablet_non_disponibile: 'Tablet non disponibile',
  connessione_assente: 'Connessione assente',
  preferenza_paziente: 'Preferenza del paziente',
  altro: 'Altro',
};

// Il giorno italiano di un istante, come 'AAAA-MM-GG'.
export function giornoRoma(istante) {
  const d = istante instanceof Date ? istante : new Date(istante);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const RE_GIORNO = /^\d{4}-\d{2}-\d{2}$/;
function giornoValido(s) {
  if (typeof s !== 'string' || !RE_GIORNO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Giorni di calendario da `da` ad `a` (entrambi 'AAAA-MM-GG').
export function giorniTra(da, a) {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86400000);
}

// La data dichiarata della firma: esiste, non è nel futuro, non è oltre i 7 giorni.
export function erroreDataFirma(dataFirma, adesso = new Date()) {
  if (!giornoValido(dataFirma)) return 'data_non_valida';
  const oggi = giornoRoma(adesso);
  const giorni = giorniTra(dataFirma, oggi);
  if (giorni < 0) return 'data_futura';
  if (giorni > GIORNI_MAX) return 'oltre_termine';
  return null;
}

// La versione indicata era in vigore il giorno della firma? Pubblicata entro quel
// giorno e non ritirata prima di quel giorno. Una bozza non è mai valida.
export function versioneInVigoreIl(riga, dataFirma) {
  if (!riga || !giornoValido(dataFirma)) return false;
  if (riga.stato === 'bozza' || !riga.pubblicato_il) return false;
  const pubblicata = giornoRoma(riga.pubblicato_il);
  if (!pubblicata || pubblicata > dataFirma) return false;
  if (riga.ritirato_il) {
    const ritirata = giornoRoma(riga.ritirato_il);
    if (!ritirata || ritirata < dataFirma) return false;
  }
  return true;
}

export function erroreMotivo(motivo, nota) {
  if (!Object.prototype.hasOwnProperty.call(MOTIVI, motivo)) return 'motivo_mancante';
  if (motivo === 'altro' && (typeof nota !== 'string' || nota.trim().length < 5)) return 'motivo_nota_mancante';
  return null;
}

// Il tipo del file si legge dai primi byte, non da ciò che dichiara il browser.
export function tipoDaiByte(buf) {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return { mime: 'application/pdf', ext: 'pdf' };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { mime: 'image/png', ext: 'png' };
  return null;
}

export const MESSAGGI = {
  documenti_mancanti: 'Indica almeno un documento firmato su carta.',
  documento_non_valido: 'Su carta si caricano solo il consenso al trattamento e l\'informativa estesa.',
  versione_sconosciuta: 'Senza la versione la copia non vale: fai rifirmare il documento, in piattaforma o stampando la versione in vigore.',
  versione_non_in_vigore: 'La versione indicata non era in vigore nel giorno della firma: la copia non vale, il documento va rifatto con la versione in vigore.',
  data_non_valida: 'Indica la data in cui il paziente ha firmato.',
  data_futura: 'La data della firma non può essere nel futuro.',
  oltre_termine: `Sono passati più di ${GIORNI_MAX} giorni dalla firma: la copia non si può più caricare, il documento va rifatto.`,
  motivo_mancante: 'Indica perché non si è firmato in piattaforma.',
  motivo_nota_mancante: 'Con «Altro» serve una breve spiegazione.',
  file_mancante: 'Il file non è arrivato: caricalo di nuovo.',
  file_troppo_grande: 'Il file supera i 10 MB.',
  file_tipo_non_ammesso: 'Il file non è un PDF, un JPG o un PNG.',
};
