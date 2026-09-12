// ─────────────────────────────────────────────────────────────────────────────
// PROIEZIONI — l'unico punto in cui si decide che cosa esce dal server verso un
// browser. Modulo PURO (nessuna query): prende le righe della banca dati e
// restituisce solo i campi che la pagina disegna davvero.
//
// Perché esiste (12/9): il server mandava al browser molto più di quanto le pagine
// mostrassero — anamnesi, red flag, note di trattamento, note della pre-validazione
// e perfino i care_token, cioè le chiavi delle aree personali. Chi apre gli strumenti
// del browser (o il sorgente della pagina) li legge. Una proiezione sola, qui, invece
// di cinque sparse che fra sei mesi divergono (regola di Enrico).
//
// REGOLA: da qui non esce MAI care_token, password, anamnesi, red flag, note
// cliniche. La cartella completa la vede l'osteopata ASSEGNATO, nelle sue pagine,
// che quei campi li disegnano davvero.
// ─────────────────────────────────────────────────────────────────────────────

import { parolaPgic } from './pgic';

const g = (o, k) => (o && o[k] !== undefined ? o[k] : null);

// Elenco pazienti (pagine del professionista): nome e inquadramento, niente clinica.
export function vistaPazienteLista(p) {
  if (!p) return null;
  return {
    id: g(p, 'id'),
    first_name: g(p, 'first_name'),
    last_name: g(p, 'last_name'),
    age: g(p, 'age'),
    gender: g(p, 'gender'),
    job_activity: g(p, 'job_activity'),
    level: g(p, 'level'),
    level_status: g(p, 'level_status'),
    current_cycle: g(p, 'current_cycle'),
    assigned_professional_id: g(p, 'assigned_professional_id'),
  };
}

// Solo chi è e per quale azienda: pre-validazione, check-in, intestazioni.
export function vistaPazienteMinima(p, azienda) {
  if (!p) return null;
  return {
    first_name: g(p, 'first_name'),
    last_name: g(p, 'last_name'),
    azienda: azienda !== undefined ? azienda : (p.clients && p.clients.name) || null,
  };
}

// Area personale del dipendente: quello che la sua pagina mostra, nient'altro.
export function vistaPazienteAreaPersonale(p) {
  if (!p) return null;
  return {
    first_name: g(p, 'first_name'),
    level: g(p, 'level'),
    level_status: g(p, 'level_status'),
    consent_withdrawn_at: g(p, 'consent_withdrawn_at'),
    azienda: (p.clients && p.clients.name) || null,
  };
}

export function vistaCicli(cicli) {
  return (cicli || []).map(c => ({
    id: g(c, 'id'),
    cycle_number: g(c, 'cycle_number'),
    cycle_type: g(c, 'cycle_type'),
    status: g(c, 'status'),
    sessions_planned: g(c, 'sessions_planned'),
    sessions_completed: g(c, 'sessions_completed'),
  }));
}

// Andamento del dolore mostrato al dipendente. Le sedute arrivano ordinate per
// numero crescente: "iniziale" è la PRIMA, "attuale" è l'ULTIMA.
// Prima del 12/9 erano invertite (si prendeva l'ultima come iniziale e la prima
// con un valore di fine come attuale): chi migliorava leggeva che peggiorava.
export function andamentoNrs(sessions) {
  const s = (sessions || []).slice().sort((a, b) => (a.session_number || 0) - (b.session_number || 0));
  const conPre = s.filter(x => x.nrs_pre != null);
  const conPost = s.filter(x => x.nrs_post != null);
  return {
    iniziale: conPre.length ? conPre[0].nrs_pre : null,
    attuale: conPost.length ? conPost[conPost.length - 1].nrs_post : null,
  };
}

export function vistaMiniCheck(mc) {
  return (mc || []).map(m => ({
    id: g(m, 'id'),
    check_type: g(m, 'check_type'),
    pgic: g(m, 'pgic'),
    created_at: g(m, 'created_at'),
  }));
}

// «Il mio percorso» — ciò che è AVVENUTO, visto dal dipendente nella sua area.
// Una riga per seduta chiusa, mini-check e rivalutazione annuale. Le sedute aperte
// non entrano: senza chiusura non hanno NRS, e l'agenda è dell'osteopata (Enrico, 12/9).
// Escono solo i campi disegnati: niente nome del professionista, niente note, niente id.
// Il PGIC si rimostra con le parole del questionario da cui viene (lib/pgic.js).
export function vistaPercorso({ sessions = [], cycles = [], miniChecks = [], reassessment = null } = {}) {
  const cicli = Object.fromEntries((cycles || []).map(c => [c.id, c]));
  const righe = [];
  for (const s of sessions || []) {
    if (!s.closed_at) continue;
    const c = s.cycle_id ? cicli[s.cycle_id] : null;
    righe.push({
      tipo: 'seduta',
      data: g(s, 'date') || (s.closed_at ? String(s.closed_at).slice(0, 10) : null),
      numero: g(s, 'session_number'),
      su: c ? g(c, 'sessions_planned') : null,
      ciclo: c ? g(c, 'cycle_number') : null,
      nrsPre: g(s, 'nrs_pre'),
      nrsPost: g(s, 'nrs_post'),
    });
  }
  for (const m of miniChecks || []) {
    righe.push({
      tipo: 'minicheck',
      data: m.created_at ? String(m.created_at).slice(0, 10) : null,
      momento: g(m, 'check_type'),
      pgic: parolaPgic(g(m, 'pgic'), 'meglio'),
    });
  }
  if (reassessment && (reassessment.completed_at || reassessment.pgic != null)) {
    righe.push({
      tipo: 'rivalutazione',
      data: reassessment.completed_at ? String(reassessment.completed_at).slice(0, 10) : null,
      pgic: parolaPgic(g(reassessment, 'pgic'), 'migliorato'),
    });
  }
  return righe.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
}

// Documenti firmati del paziente: mai l'immagine della firma né il contenuto del
// modulo. Tipo, stato, data e impronta bastano a mostrare che esistono e sono validi.
export function vistaDocumentoPaziente(d) {
  if (!d) return null;
  return {
    id: g(d, 'id'),
    patient_id: g(d, 'patient_id'),
    type: g(d, 'type'),
    status: g(d, 'status'),
    signed_at: g(d, 'signed_at'),
    content_hash: g(d, 'content_hash'),
    version: g(d, 'version'),
  };
}

// Azienda vista dal professionista: il nome, non la scheda commerciale.
export function vistaAziendaPerPro(c) {
  if (!c) return null;
  return { id: g(c, 'id'), name: g(c, 'name') };
}
