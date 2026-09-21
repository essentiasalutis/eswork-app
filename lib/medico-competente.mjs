// ─────────────────────────────────────────────────────────────────────────────
// MEDICO COMPETENTE — regole pure (.mjs, testate). Decisioni di Enrico (21/9).
//
// 1. Al medico competente non arriva NESSUN dato individuale, in nessuna forma e con
//    nessun consenso: firma l'idoneità, e non deve poter sapere chi ha aderito, chi è
//    in trattamento, chi ha rifiutato.
// 2. Il ruolo è opzionale e additivo: il programma funziona per intero senza.
//
// Lessico: il medico «indica», mai «segnala»; mai «predittivo».
// ─────────────────────────────────────────────────────────────────────────────

export const RUOLO_MC = 'medico_competente';
export const SEZIONE_INFORMATIVA = 'medico_competente';

export const PRESIDI = Object.freeze([
  'nessun compenso, in nessuna forma',
  'informazione e non prescrizione',
  'trasparenza verso il lavoratore',
  'nessuna partecipazione alle prestazioni',
]);

export const DOCUMENTI_MC = Object.freeze({
  accordo: 'Accordo con il medico competente',
  dichiarazione_presidi: 'Dichiarazione dei quattro presidi sul conflitto di interessi',
});

// L'informativa del check-up in vigore prevede l'accesso del medico ai soli aggregati:
// ha la sezione con l'identificativo fisso, e la sezione ha un testo.
export function informativaPrevedeMedico(contenuto) {
  const sezioni = contenuto && Array.isArray(contenuto.sezioni) ? contenuto.sezioni : [];
  return sezioni.some(s => s && s.id === SEZIONE_INFORMATIVA && typeof s.testo === 'string' && s.testo.trim().length > 0);
}

// Requisiti per assegnare un medico a un'azienda. Le aziende demo sono esenti.
// tipiDocumenti: i tipi caricati sul profilo del medico.
export function requisitiAssegnazione({ isDemo, contenutoInformativa, tipiDocumenti }) {
  if (isDemo) return { ok: true, mancanti: [], messaggio: null };
  const tipi = new Set(tipiDocumenti || []);
  const mancanti = [];
  if (!informativaPrevedeMedico(contenutoInformativa)) mancanti.push('informativa');
  if (!tipi.has('accordo')) mancanti.push('accordo');
  if (!tipi.has('dichiarazione_presidi')) mancanti.push('dichiarazione_presidi');
  if (!mancanti.length) return { ok: true, mancanti, messaggio: null };
  const frasi = {
    informativa: 'L\'informativa del check-up in vigore non prevede l\'accesso del medico competente ai dati aggregati: il ruolo si potrà assegnare a un\'azienda reale quando sarà pubblicata la versione con la sezione dedicata al medico competente.',
    accordo: 'Manca l\'accordo con il medico competente: va caricato sul suo profilo.',
    dichiarazione_presidi: `Manca la dichiarazione dei quattro presidi sul conflitto di interessi (${PRESIDI.join('; ')}): va caricata sul suo profilo.`,
  };
  return { ok: false, mancanti, messaggio: mancanti.map(m => frasi[m]).join(' ') };
}

// ─── Indicazioni: niente persone ─────────────────────────────────────────────
export const TESTO_MAX = 160;
export const GUIDA_INDICAZIONE = 'Descrivi un reparto o una mansione, mai una persona o un turno svolto da una sola persona.';

const LETTERE = /[A-Za-zÀ-ÖØ-öø-ÿ']+/g;
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/'/g, '');

// Nomi e cognomi delle persone dell'azienda (anagrafica organizzativa e pazienti),
// come parole singole di almeno 3 lettere.
export function paroleDaNomi(nomi) {
  const out = new Set();
  for (const n of nomi || []) for (const p of String(n || '').match(LETTERE) || []) {
    const w = norm(p);
    if (w.length >= 3) out.add(w);
  }
  return out;
}

// Ritorna { ok:true, testo } (testo null se vuoto) oppure { ok:false, errore }.
// Il messaggio non ripete mai il nome trovato.
export function validaIndicazione(testo, paroleVietate) {
  if (testo == null) return { ok: true, testo: null };
  if (typeof testo !== 'string') return { ok: false, errore: 'Il testo non è valido.' };
  if (/[\r\n]/.test(testo)) return { ok: false, errore: 'Il testo deve stare su una sola riga.' };
  const t = testo.trim().replace(/\s+/g, ' ');
  if (!t) return { ok: true, testo: null };
  if (t.length > TESTO_MAX) return { ok: false, errore: `Il testo supera ${TESTO_MAX} caratteri: una riga breve.` };
  if (/@/.test(t)) return { ok: false, errore: 'Il testo non può contenere indirizzi email. ' + GUIDA_INDICAZIONE };
  if (/\d{3,}/.test(t) || /\b\d{1,2}\s?[/.-]\s?\d{1,2}\b/.test(t)) {
    return { ok: false, errore: 'Il testo contiene una sequenza di cifre (una matricola, una data): togli i numeri che possono identificare una persona. ' + GUIDA_INDICAZIONE };
  }
  const parole = t.match(LETTERE) || [];
  const maiuscola = w => /^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ']+$/.test(w);
  for (let i = 0; i + 1 < parole.length; i++) {
    if (maiuscola(parole[i]) && maiuscola(parole[i + 1])) {
      return { ok: false, errore: 'Il testo contiene due parole consecutive con l\'iniziale maiuscola, come un nome e cognome: riformula. ' + GUIDA_INDICAZIONE };
    }
  }
  const vietate = paroleVietate instanceof Set ? paroleVietate : new Set(paroleVietate || []);
  if (parole.some(w => vietate.has(norm(w)))) {
    return { ok: false, errore: 'Il testo contiene il nome o il cognome di una persona di questa azienda (o una parola uguale): riformula. ' + GUIDA_INDICAZIONE };
  }
  return { ok: true, testo: t };
}

// ─── Nessun contenuto commerciale nei documenti del medico ───────────────────
// Prova di Enrico (21/9): nei documenti che il medico riceve, zero importi in euro,
// zero «investimento», «forbice», «premio». Si controlla il testo e l'HTML grezzo.
export const RE_COMMERCIALE = /€|\beur(?:o|i)?\b|investiment|forbic|premi[oi]\b/gi;

export function terminiCommerciali(html) {
  const s = String(html || '');
  return [...new Set((s.match(RE_COMMERCIALE) || []).map(m => m.toLowerCase()))];
}

// Parole che non devono comparire nelle pagine del medico (lessico).
export const RE_LESSICO_VIETATO = /segnal|predittiv/i;
