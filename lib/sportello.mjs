// ─────────────────────────────────────────────────────────────────────────────
// SPORTELLO — le regole del calendario e del monitoraggio (fase 1). Modulo PURO.
//
// Principio (Enrico, 28/9): Essentia Salutis organizza lo sportello (giorni, stanza,
// orari, posti); l'osteopata decide chi viene trattato e quando. In questa fase il
// sistema non mette nessuna persona in nessun posto: conta, avvisa, mostra.
// Le regole qui sotto sono le risposte di Enrico del 28/9, una per numero.
// Lessico: «sedute» (la parola del protocollo e del contratto, Enrico 28/9).
// ─────────────────────────────────────────────────────────────────────────────
import { PROTOCOLLO } from './protocollo.mjs';
import { finestraAnno } from './anno-programma.mjs';
import { giornoIt } from './date-it.mjs';

export const SPORTELLO = Object.freeze({
  minuti_posto: PROTOCOLLO.durata_seduta_min,  // un posto = una seduta da 30 minuti
  ore_minime: 3,                               // una giornata dura almeno 3 ore…
  posti_minimi: 6,                             // …cioè 6 posti (risposta 7)
  ergonomia_persone_per_posto: 6,              // 5 minuti a persona: sei persone fanno un posto
  allarme_posti_giorni_prima: 7,               // «meno di 6 posti» si vede 7 giorni prima (risposta 5)
  allarme_trimestre_giorni_prima: 14,          // Livello 2: due settimane prima della fine del trimestre (risposta 3)
  autosegnalazione_entro_giorni: 7,            // l'autosegnalazione si gestisce entro 7 giorni
});

const GIORNO_MS = 24 * 60 * 60 * 1000;
const RE_ORA = /^(\d{1,2}):(\d{2})/;
const RE_GIORNO = /^\d{4}-\d{2}-\d{2}$/;

export function minuti(ora) {
  const m = RE_ORA.exec(String(ora || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function durataMinuti(inizio, fine) {
  const a = minuti(inizio), b = minuti(fine);
  return a == null || b == null ? null : b - a;
}

// Posti di una giornata: durata ÷ 30 minuti (modificabili giornata per giornata).
export function postiDaOrario(inizio, fine) {
  const d = durataMinuti(inizio, fine);
  return d == null || d <= 0 ? 0 : Math.floor(d / SPORTELLO.minuti_posto);
}

// Una giornata si può salvare? Ritorna l'elenco dei problemi (vuoto = va bene).
export function controllaGiornata(g) {
  const out = [];
  if (!g || !g.client_id) out.push('Manca l\'azienda.');
  if (!g || !RE_GIORNO.test(String(g.data || ''))) out.push('Manca la data.');
  const d = durataMinuti(g && g.ora_inizio, g && g.ora_fine);
  if (d == null) out.push('Mancano gli orari.');
  else if (d < SPORTELLO.ore_minime * 60) out.push(`Una giornata dura almeno ${SPORTELLO.ore_minime} ore.`);
  const posti = Number(g && g.posti);
  if (!Number.isInteger(posti) || posti < SPORTELLO.posti_minimi) out.push(`I posti sono almeno ${SPORTELLO.posti_minimi}.`);
  else if (d != null && d >= SPORTELLO.ore_minime * 60 && posti > postiDaOrario(g.ora_inizio, g.ora_fine)) out.push(`In ${Math.floor(d / 60)} ore e ${d % 60} minuti ci stanno al massimo ${postiDaOrario(g.ora_inizio, g.ora_fine)} posti.`);
  return out;
}

// Posti occupati: sedute prenotate + ergonomia (sei persone = un posto). null = non indicati.
export function postiOccupati(g) {
  if (!g || (g.sedute_prenotate == null && g.ergonomia_persone == null)) return null;
  return (Number(g.sedute_prenotate) || 0) + Math.ceil((Number(g.ergonomia_persone) || 0) / SPORTELLO.ergonomia_persone_per_posto);
}

export function giorniTra(daGiorno, aGiorno) {
  return Math.round((Date.parse(`${aGiorno}T12:00:00Z`) - Date.parse(`${daGiorno}T12:00:00Z`)) / GIORNO_MS);
}

export function aggiungiGiorniG(giorno, n) {
  const [y, m, d] = String(giorno).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Aggiunge mesi a un giorno di calendario; il 31 diventa l'ultimo giorno del mese.
export function aggiungiMesi(giorno, n) {
  const [y, m, d] = String(giorno).split('-').map(Number);
  const mese = new Date(Date.UTC(y, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(mese.getUTCFullYear(), mese.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(mese.getUTCFullYear(), mese.getUTCMonth(), Math.min(d, ultimo))).toISOString().slice(0, 10);
}

// Giornate dello stesso osteopata che si sovrappongono (anche in aziende diverse).
export function conflitti(giornate = []) {
  const attive = giornate.filter(g => g && g.stato !== 'annullata' && g.professional_id);
  const out = [];
  for (let i = 0; i < attive.length; i++) {
    for (let j = i + 1; j < attive.length; j++) {
      const a = attive[i], b = attive[j];
      if (a.professional_id !== b.professional_id || a.data !== b.data) continue;
      if (minuti(a.ora_inizio) < minuti(b.ora_fine) && minuti(b.ora_inizio) < minuti(a.ora_fine)) out.push([a.id, b.id]);
    }
  }
  return out;
}

// I trimestri dell'anno di programma in corso (dalla data di avvio). null senza data.
export function trimestriAnno(dataAvvio, adesso = new Date()) {
  const f = finestraAnno(dataAvvio, adesso);
  if (!f) return null;
  const inizio = f.inizioGiorno;
  return [0, 1, 2, 3].map(q => ({
    numero: q + 1,
    inizio: aggiungiMesi(inizio, q * 3),
    fine: q === 3 ? f.rinnovoIl : aggiungiMesi(inizio, (q + 1) * 3),   // fine esclusa
  }));
}

// Livello 2: una seduta di prevenzione per trimestre (risposta 3). Allarme due settimane
// prima della fine del trimestre, se la seduta del trimestre non c'è ancora: dopo non si
// rimedia più. `date`: giorni ('AAAA-MM-GG') delle sedute di prevenzione della persona.
export function prevenzioneTrimestre({ dataAvvio, date = [], adesso = new Date() } = {}) {
  const trimestri = trimestriAnno(dataAvvio, adesso);
  if (!trimestri) return null;
  const oggi = giornoIt(adesso);
  const stati = trimestri.map(t => {
    const fatta = date.some(g => g >= t.inizio && g < t.fine);
    const stato = fatta ? 'fatta' : oggi >= t.fine ? 'persa' : oggi < t.inizio ? 'futura' : 'da_fare';
    return { ...t, stato };
  });
  const corrente = stati.find(t => oggi >= t.inizio && oggi < t.fine) || null;
  const ultimoGiorno = corrente ? aggiungiGiorniG(corrente.fine, -1) : null;
  const restano = corrente ? giorniTra(oggi, corrente.fine) : null;
  const allarme = !!(corrente && corrente.stato === 'da_fare' && restano <= SPORTELLO.allarme_trimestre_giorni_prima);
  return { trimestri: stati, corrente, ultimoGiorno, restano, allarme };
}

// Stato del percorso di una persona in una riga: solo conteggi e date, mai note,
// dolore o contenuti clinici (Enrico, 28/9).
export function statoPercorso({ cicli = [], seduteDate = {}, autosegnalazioni = [], livello = null, dataAvvio = null, adesso = new Date(), prevenzioneDopo = null, prevenzioneNonSpetta = false } = {}) {
  const righe = [];
  const oggi = giornoIt(adesso);
  const tratt = cicli.filter(c => (c.cycle_type || 'treatment') === 'treatment').sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
  const prev = cicli.filter(c => c.cycle_type === 'prevention').sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
  const attivo = tratt.find(c => c.status === 'active');
  if (attivo) {
    const giorni = giorniTra(giornoIt(attivo.started_at), oggi);
    righe.push(`Ciclo ${attivo.cycle_number || 1}: ${attivo.sessions_completed || 0} sedute su ${attivo.sessions_planned || PROTOCOLLO.sedute_per_ciclo}, aperto da ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`);
  } else if (tratt.length) {
    righe.push(`${tratt.length === 1 ? 'Ciclo concluso' : `${tratt.length} cicli conclusi`}`);
  } else if (livello === 'level1') {
    righe.push('Livello 1: ciclo non ancora avviato');
  }
  // Prevenzione: solo per chi è in Livello 2 (Enrico, 30/9: chi è in Livello 3 non la fa;
  // prima un L3 con la prevenzione dell'anno prima risultava «seduta da fare»).
  if (livello === 'level2' && prevenzioneDopo) {
    righe.push(`Neoassunto: prevenzione dal prossimo anno di programma${prevenzioneDopo.dal ? ` (${prevenzioneDopo.dal.split('-').reverse().join('/')})` : ''}`);
  } else if (livello === 'level2' && prevenzioneNonSpetta) {
    righe.push('Prevenzione non prevista quest\'anno (diritto fissato a inizio anno)');
  } else if (livello === 'level2') {
    // Le sedute di prevenzione si contano nell'ANNO DI PROGRAMMA in corso: quelle dell'anno
    // prima non valgono (prova su Officine, 28/9: «4 su 4 nell'anno» era l'anno scorso).
    const trimestri = trimestriAnno(dataAvvio, adesso);
    const nellAnnoCorso = (g) => !trimestri || (g >= trimestri[0].inizio && g < trimestri[3].fine);
    const date = prev.flatMap(c => seduteDate[c.id] || []).filter(nellAnnoCorso);
    if (!prev.length) righe.push('Prevenzione non ancora avviata');
    else if (!date.length && trimestri && prev.every(c => giornoIt(c.started_at) < trimestri[0].inizio)) righe.push('Prevenzione di quest\'anno non ancora avviata');
    if (prev.length) {
      const t = prevenzioneTrimestre({ dataAvvio, date, adesso });
      const base = `Prevenzione: ${date.length} ${date.length === 1 ? 'seduta' : 'sedute'} su ${PROTOCOLLO.sessioni_prevenzione_l2} nell'anno`;
      righe.push(t && t.corrente
        ? `${base}; trimestre ${t.corrente.numero}: ${t.corrente.stato === 'fatta' ? 'seduta fatta' : `seduta da fare entro il ${t.ultimoGiorno.split('-').reverse().join('/')}`}`
        : base);
    }
  }
  const aperte = autosegnalazioni.filter(s => s.status === 'pending');
  for (const s of aperte) {
    const g = giorniTra(giornoIt(s.created_at), oggi);
    righe.push(`Autosegnalazione in attesa da ${g} ${g === 1 ? 'giorno' : 'giorni'}`);
  }
  return righe;
}

// Sedute a contratto: persone di Livello 1 e 2 del Report di Attivazione × 4, congelate
// al Report (risposta 4: «è il numero che ho promesso per iscritto»).
export function seduteAContratto(persone) {
  if (!persone || persone.l1 == null || persone.l2 == null) return null;
  return {
    l1: persone.l1 * PROTOCOLLO.sedute_per_ciclo,
    l2: persone.l2 * PROTOCOLLO.sessioni_prevenzione_l2,
    personeL1: persone.l1,
    personeL2: persone.l2,
  };
}
