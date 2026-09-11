// ─────────────────────────────────────────────────────────────────────────────
// Stato del CHECK-UP — fonte unica per pagina del dipendente, API, scheda
// azienda e solleciti. Modulo PURO (niente DB): usabile anche lato client.
//
// Il link /q/c/[codice] ha due vite (decisione Enrico 2026-09-11):
//  - finché il check-up è aperto → le risposte entrano nell'ANALISI (la base
//    del Report di Attivazione);
//  - dopo → se l'azienda ha FIRMATO è la porta di adesione al programma per chi
//    non aveva risposto (presa in carico sì, analisi no); se non ha firmato
//    è CHIUSO DAVVERO: non salva niente e lo dice subito.
// L'analisi si congela col Report di Attivazione di QUEL check-up (non con
// la firma): così funziona anche il binario A, dove si firma prima del check-up.
// ─────────────────────────────────────────────────────────────────────────────

export const GIORNI_DEFAULT = 10;
// Chi aveva aperto il questionario prima della chiusura ha mezz'ora per inviarlo:
// a nessuno che ha iniziato in tempo si risponde "chiuso, risposte perse".
export const GRAZIA_MIN = 30;

const TZ = 'Europe/Rome';
const GIORNO_MS = 24 * 60 * 60 * 1000;

// Offset (ms) di Roma rispetto a UTC in un certo istante.
function offsetRoma(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).map(x => [x.type, x.value]));
  const comeUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return comeUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function isYmd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

// 'YYYY-MM-DD' → istante delle 23:59:59.999, ora italiana, di quel giorno.
// (I cambi d'ora avvengono alle 2-3 di notte: l'offset di mezzogiorno vale fino a mezzanotte.)
export function fineGiornataRoma(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const mezzogiorno = new Date(Date.UTC(y, m - 1, d, 12));
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - offsetRoma(mezzogiorno));
}

export function oggiRoma(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function aggiungiGiorni(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function etichettaData(ymd) {
  if (!isYmd(ymd)) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const mese = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('it-IT', { month: 'long', timeZone: 'UTC' });
  return `${d === 1 ? '1°' : d} ${mese}`;
}

// Articolo giusto davanti al giorno: "l'8", "l'11" (iniziano per vocale), "il 1°", "il 20".
const conApostrofo = (ymd) => { const d = Number(ymd.slice(8, 10)); return d === 8 || d === 11; };
export function ilGiorno(ymd) { return isYmd(ymd) ? `${conApostrofo(ymd) ? "l'" : 'il '}${etichettaData(ymd)}` : ''; }
export function alGiorno(ymd) { return isYmd(ymd) ? `${conApostrofo(ymd) ? "all'" : 'al '}${etichettaData(ymd)}` : ''; }
export function dalGiorno(ymd) { return isYmd(ymd) ? `${conApostrofo(ymd) ? "dall'" : 'dal '}${etichettaData(ymd)}` : ''; }

export function etichettaOra(date) {
  return new Date(date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

// Stato del check-up.
//   assessment  : il check-up CORRENTE dell'azienda (il più recente) o null
//   reportDopo  : esiste un Report di Attivazione generato dopo l'avvio di QUESTO check-up
//   firmato     : l'azienda ha firmato (pipeline "Contratto firmato")
//   conGrazia   : true all'INVIO delle risposte (la pagina, all'apertura, non concede grazia)
// Ritorna { stato: 'aperto'|'adesione'|'chiuso'|'non_avviato', accetta, salvaRisposta,
//           chiudeIl (ymd|null), chiusoAlle (Date|null) }
export function statoCheckup({ assessment, reportDopo = false, firmato = false, now = new Date(), conGrazia = false } = {}) {
  const fuori = (extra) => (firmato
    ? { ...extra, stato: 'adesione', accetta: true, salvaRisposta: false }
    : { stato: 'chiuso', ...extra, accetta: false, salvaRisposta: false });

  if (!assessment) return fuori({ stato: 'non_avviato', chiudeIl: null, chiusoAlle: null });

  const chiudeIl = isYmd(assessment.chiude_il) ? assessment.chiude_il : null;
  const scadenza = chiudeIl ? fineGiornataRoma(chiudeIl) : null;
  const chiusoAMano = assessment.status !== 'active';
  const chiusoAlle = chiusoAMano
    ? (assessment.chiuso_at ? new Date(assessment.chiuso_at) : null)
    : (scadenza && now > scadenza ? scadenza : null);

  let aperto = false;
  if (!reportDopo) {
    if (!chiusoAMano && (!scadenza || now <= scadenza)) aperto = true;
    else if (conGrazia && chiusoAlle && now.getTime() <= chiusoAlle.getTime() + GRAZIA_MIN * 60 * 1000) aperto = true;
  }
  if (aperto) return { stato: 'aperto', accetta: true, salvaRisposta: true, chiudeIl, chiusoAlle };
  return fuori({ stato: 'chiuso', chiudeIl, chiusoAlle: chiusoAlle || scadenza });
}

// Giorni che mancano alla chiusura (0 = chiude oggi), o null se senza scadenza.
export function giorniAllaChiusura(chiudeIl, now = new Date()) {
  if (!isYmd(chiudeIl)) return null;
  const ms = fineGiornataRoma(chiudeIl).getTime() - now.getTime();
  return ms < 0 ? null : Math.floor(ms / GIORNO_MS);
}

// Sollecito dovuto oggi: 'meta' (metà finestra), 'finale' (ultimi 2 giorni) o null.
// Se si arriva agli ultimi giorni senza aver fatto quello di metà, resta solo il finale.
export function sollecitoDovuto(assessment, now = new Date()) {
  if (!assessment || assessment.status !== 'active' || !isYmd(assessment.chiude_il)) return null;
  const fine = fineGiornataRoma(assessment.chiude_il).getTime();
  if (now.getTime() > fine) return null;
  const inizio = new Date(assessment.created_at).getTime();
  const giorni = giorniAllaChiusura(assessment.chiude_il, now);
  if (giorni !== null && giorni <= 2 && !assessment.sollecito_finale_at) return 'finale';
  if (now.getTime() >= inizio + (fine - inizio) / 2 && !assessment.sollecito_meta_at && !assessment.sollecito_finale_at) return 'meta';
  return null;
}

// Testo del sollecito al referente (approvato da Enrico; parola scelta: "analisi" —
// non "fotografia", non "rilevazione", non "screening", che evoca la sorveglianza sanitaria).
export function testoSollecito({ tipo, referente, n, dipendenti, chiudeIl, link, firma }) {
  const pct = dipendenti > 0 ? ` (${Math.round((n / dipendenti) * 100)}%)` : '';
  const su = dipendenti > 0 ? ` su ${dipendenti}` : '';
  const oggetto = tipo === 'finale' ? 'Check-up ES Work — ultimi due giorni' : 'Check-up ES Work — a che punto siamo';
  const corpo = `Gentile ${referente || 'referente'},

un aggiornamento sul check-up: finora sono arrivati ${n} questionari${su}${pct}. Il link resta aperto fino ${alGiorno(chiudeIl)}. Chi non risponde entro quella data non rientra nell'analisi: un ultimo promemoria ai colleghi fa spesso la differenza.

Il link da girare è sempre questo: ${link}

Grazie,
${firma || 'Enrico'}`;
  return { oggetto, corpo };
}

// Avvisi prima di avviare un check-up — avvisi, non blocchi (decisioni Enrico): Lettera di
// incarico non ancora inviata a un'azienda del binario B; limite dei check-up aperti non
// convertiti già raggiunto (le demo non contano). Usati dalla scheda azienda e dalla Stima.
export function avvisiAvvioCheckup({ client, altriAperti = [], limite = 3 } = {}) {
  const out = [];
  if (!client) return out;
  if (client.binario === 'B' && !['inviata', 'firmata'].includes(client.lettera_stato)) {
    out.push('Lettera di incarico non ancora inviata a questa azienda (binario B).\n\nAvviare comunque il check-up?');
  }
  if (!client.is_demo && altriAperti.length >= limite) {
    out.push(`Hai già ${altriAperti.length} check-up aperti non convertiti (limite ${limite}):\n${altriAperti.map(x => `• ${x.name}`).join('\n')}\n\nAvviare comunque il check-up?`);
  }
  return out;
}
