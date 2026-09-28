// ─────────────────────────────────────────────────────────────────────────────
// SPORTELLO — dati del calendario e del monitoraggio (fase 1). UNA funzione per le
// viste di Essentia Salutis: la sezione «Sportello» (tutte le aziende) e la scheda
// azienda (la sua fetta) leggono gli stessi dati da qui (Enrico, 28/9: «Stessi dati,
// due viste. Mai due fonti.»). L'osteopata e l'azienda hanno la loro proiezione, più
// stretta: ogni vista riceve solo ciò che mostra.
//
// Dalla banca dati si leggono solo date, conteggi e stati: mai note, dolore (NRS) o
// contenuti clinici. Le sedute si contano, non si aprono.
// ─────────────────────────────────────────────────────────────────────────────
import supabase from './db';
import { generateId, getClients, getProfessionals, getAssignmentsByProfessional } from './store';
import { programmaAttivo } from './attivazione';
import {
  SPORTELLO, controllaGiornata, postiOccupati, conflitti, giorniTra, aggiungiGiorniG,
  prevenzioneTrimestre, statoPercorso, seduteAContratto,
} from './sportello.mjs';
import { avvisoDurataCiclo } from './scadenza-ciclo.mjs';
import { finestraAnno, nellAnno } from './anno-programma.mjs';
import { giornoIt } from './date-it.mjs';

const CAMPI_GIORNATA = 'id, client_id, professional_id, sede, stanza, data, ora_inizio, ora_fine, posti, sedute_prenotate, ergonomia_persone, prenotazioni_il, stato, note_logistiche';
const hhmm = (t) => String(t || '').slice(0, 5);
const nome = (p) => [p && p.first_name, p && p.last_name].filter(Boolean).join(' ') || 'Nome non indicato';

// ─── Lettura e scrittura delle giornate ──────────────────────────────────────
export async function elencaGiornate({ da, a, clientIds = null, professionalId = null } = {}) {
  let q = supabase.from('sportello_giornate').select(CAMPI_GIORNATA).order('data').order('ora_inizio');
  if (da) q = q.gte('data', da);
  if (a) q = q.lte('data', a);
  if (clientIds) q = q.in('client_id', clientIds.length ? clientIds : ['-']);
  if (professionalId) q = q.eq('professional_id', professionalId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(g => ({ ...g, ora_inizio: hhmm(g.ora_inizio), ora_fine: hhmm(g.ora_fine) }));
}

export async function getGiornata(id) {
  const { data, error } = await supabase.from('sportello_giornate').select(CAMPI_GIORNATA).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { ...data, ora_inizio: hhmm(data.ora_inizio), ora_fine: hhmm(data.ora_fine) } : null;
}

// Crea una giornata, o una serie settimanale (ripeti = quante settimane in tutto).
export async function creaGiornate(g, { ripeti = 1, creataDa = 'admin' } = {}) {
  const problemi = controllaGiornata(g);
  if (problemi.length) return { errore: problemi.join(' ') };
  const n = Math.max(1, Math.min(52, parseInt(ripeti) || 1));
  const righe = Array.from({ length: n }, (_, i) => ({
    id: generateId('sg'),
    client_id: g.client_id, professional_id: g.professional_id || null,
    sede: g.sede || null, stanza: g.stanza || null,
    data: aggiungiGiorniG(g.data, i * 7), ora_inizio: g.ora_inizio, ora_fine: g.ora_fine,
    posti: Number(g.posti), stato: 'pianificata', note_logistiche: g.note_logistiche || null,
    created_by: creataDa, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from('sportello_giornate').insert(righe);
  if (error) return { errore: error.message };
  return { create: righe.length };
}

// Modifica di Essentia Salutis: orari, posti, osteopata, luogo, stato.
export async function modificaGiornata(id, campi) {
  const attuale = await getGiornata(id);
  if (!attuale) return { errore: 'Giornata non trovata.' };
  const ammessi = ['professional_id', 'sede', 'stanza', 'data', 'ora_inizio', 'ora_fine', 'posti', 'stato', 'note_logistiche', 'sedute_prenotate', 'ergonomia_persone'];
  const nuovo = { ...attuale };
  for (const k of ammessi) if (k in (campi || {})) nuovo[k] = campi[k] === '' ? null : campi[k];
  if (nuovo.posti != null) nuovo.posti = Number(nuovo.posti);
  const problemi = controllaGiornata(nuovo);
  if (problemi.length) return { errore: problemi.join(' ') };
  if (!['pianificata', 'annullata'].includes(nuovo.stato)) return { errore: 'Stato non valido.' };
  const upd = Object.fromEntries(ammessi.filter(k => k in (campi || {})).map(k => [k, nuovo[k]]));
  if ('sedute_prenotate' in upd || 'ergonomia_persone' in upd) { upd.prenotazioni_il = new Date().toISOString(); upd.prenotazioni_da = 'admin'; }
  upd.updated_at = new Date().toISOString();
  const { error } = await supabase.from('sportello_giornate').update(upd).eq('id', id);
  return error ? { errore: error.message } : { ok: true };
}

// L'osteopata scrive solo quanti posti ha prenotato: numeri, mai nomi (risposta 1).
export async function segnaPrenotazioni(id, { sedute, ergonomia }, { proId }) {
  const g = await getGiornata(id);
  if (!g || g.professional_id !== proId) return { errore: 'Questa giornata non è tua.' };
  const numero = (v) => (v === '' || v == null ? null : Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : NaN);
  const s = numero(sedute), e = numero(ergonomia);
  if (Number.isNaN(s) || Number.isNaN(e)) return { errore: 'Scrivi numeri interi, zero o più.' };
  const { error } = await supabase.from('sportello_giornate')
    .update({ sedute_prenotate: s, ergonomia_persone: e, prenotazioni_il: new Date().toISOString(), prenotazioni_da: proId, updated_at: new Date().toISOString() })
    .eq('id', id);
  return error ? { errore: error.message } : { ok: true, occupati: postiOccupati({ sedute_prenotate: s, ergonomia_persone: e }) };
}

// ─── Percorsi (solo conteggi e date) ─────────────────────────────────────────
async function percorsi(clientIds) {
  if (!clientIds.length) return { pazienti: [], cicli: [], sedute: [], autosegnalazioni: [], contratti: {} };
  const [pz, cy, se, st, rp] = await Promise.all([
    supabase.from('patients').select('id, client_id, first_name, last_name, level, computed_level, level_status, consent_withdrawn_at, assigned_professional_id').in('client_id', clientIds),
    supabase.from('treatment_cycles').select('id, patient_id, client_id, cycle_type, cycle_number, status, sessions_planned, sessions_completed, started_at').in('client_id', clientIds),
    supabase.from('sessions').select('id, patient_id, client_id, cycle_id, date').in('client_id', clientIds),
    supabase.from('self_triggers').select('id, patient_id, client_id, status, created_at').in('client_id', clientIds),
    supabase.from('generated_reports').select('client_id, created_at, quote_compliance').eq('report_type', 'activation').in('client_id', clientIds).order('created_at', { ascending: false }),
  ]);
  for (const r of [pz, cy, se, st, rp]) if (r.error) throw new Error(r.error.message);
  // Contratto = l'ULTIMO Report di Attivazione (è quello valido), congelato lì.
  const contratti = {};
  for (const r of rp.data || []) {
    if (r.client_id in contratti) continue;
    const q = r.quote_compliance || {};
    contratti[r.client_id] = q.persone_l1 != null && q.persone_l2 != null
      ? { ...seduteAContratto({ l1: q.persone_l1, l2: q.persone_l2 }), reportDel: r.created_at }
      : { mancante: true, reportDel: r.created_at };
  }
  return { pazienti: pz.data || [], cicli: cy.data || [], sedute: se.data || [], autosegnalazioni: st.data || [], contratti };
}

const livelloDi = (p) => p.level || p.computed_level || null;
const inCarico = (p) => !p.consent_withdrawn_at && p.level_status !== 'opted_out';

function allarmeTesto(tipo, x) {
  return {
    posti_non_indicati: `Mancano i posti prenotati per la giornata del ${x.giorno}${x.tra != null ? ` (tra ${x.tra} ${x.tra === 1 ? 'giorno' : 'giorni'})` : ''}.`,
    posti_pochi: `Giornata del ${x.giorno}: ${x.occupati} ${x.occupati === 1 ? 'posto prenotato' : 'posti prenotati'} su ${x.posti}, sotto i ${SPORTELLO.posti_minimi}.`,
    senza_osteopata: `Giornata del ${x.giorno} senza osteopata.`,
    conflitto: `${x.osteopata}: due giornate sovrapposte il ${x.giorno}.`,
    ritmo_l1: `${x.persona}: ${x.testo}`,
    trimestre_l2: `${x.persona}: nessuna seduta di prevenzione nel trimestre ${x.trimestre}, che finisce il ${x.fine} (restano ${x.restano} ${x.restano === 1 ? 'giorno' : 'giorni'}).`,
    autosegnalazione: `${x.persona}: autosegnalazione in attesa da ${x.giorni} giorni (va gestita entro ${SPORTELLO.autosegnalazione_entro_giorni}).`,
  }[tipo];
}
const giornoBreve = (g) => String(g).split('-').reverse().join('/');

// ─── La funzione unica (vista di Essentia Salutis) ───────────────────────────
//   da / a: il periodo del calendario ('AAAA-MM-GG'); clientId: solo quell'azienda.
export async function datiSportello({ da, a, clientId = null, adesso = new Date() } = {}) {
  const oggi = giornoIt(adesso);
  const [clienti, professionisti] = await Promise.all([getClients(), getProfessionals().catch(() => [])]);
  const aziende = (clienti || []).filter(c => !clientId || c.id === clientId);
  const nomeAzienda = Object.fromEntries((clienti || []).map(c => [c.id, c.name]));
  const nomeOsteopata = Object.fromEntries((professionisti || []).map(p => [p.id, p.name]));
  // Calendario del periodo + la finestra degli allarmi (oggi … oggi + 7) e dei conflitti (4 settimane).
  const orizzonte = aggiungiGiorniG(oggi, 28);
  const [giornate, prossime] = await Promise.all([
    elencaGiornate({ da, a, clientIds: clientId ? [clientId] : null }),
    elencaGiornate({ da: oggi, a: orizzonte, clientIds: clientId ? [clientId] : null }),
  ]);
  const inChiaro = (g) => ({
    ...g, azienda: nomeAzienda[g.client_id] || '—', osteopata: g.professional_id ? (nomeOsteopata[g.professional_id] || '—') : null,
    occupati: postiOccupati(g),
  });

  const allarmi = [];
  for (const g of prossime) {
    if (g.stato === 'annullata') continue;
    const tra = giorniTra(oggi, g.data);
    const base = { clientId: g.client_id, azienda: nomeAzienda[g.client_id] || '—', giornataId: g.id, data: g.data };
    if (!g.professional_id) allarmi.push({ ...base, tipo: 'senza_osteopata', grave: tra <= SPORTELLO.allarme_posti_giorni_prima, testo: allarmeTesto('senza_osteopata', { giorno: giornoBreve(g.data) }) });
    if (tra > SPORTELLO.allarme_posti_giorni_prima) continue;
    const occ = postiOccupati(g);
    if (occ == null) allarmi.push({ ...base, tipo: 'posti_non_indicati', grave: false, testo: allarmeTesto('posti_non_indicati', { giorno: giornoBreve(g.data), tra }) });
    else if (occ < SPORTELLO.posti_minimi) allarmi.push({ ...base, tipo: 'posti_pochi', grave: true, testo: allarmeTesto('posti_pochi', { giorno: giornoBreve(g.data), occupati: occ, posti: g.posti }) });
  }
  const perId = Object.fromEntries(prossime.map(g => [g.id, g]));
  for (const [x] of conflitti(prossime)) {
    const g = perId[x];
    allarmi.push({ tipo: 'conflitto', grave: true, clientId: g.client_id, azienda: nomeAzienda[g.client_id] || '—', giornataId: g.id, data: g.data, professionalId: g.professional_id,
      testo: allarmeTesto('conflitto', { osteopata: nomeOsteopata[g.professional_id] || 'Osteopata', giorno: giornoBreve(g.data) }) });
  }

  // Monitoraggio dei programmi attivi (o dell'azienda chiesta): contratto, erogato, persone.
  const monitorate = aziende.filter(c => clientId || (programmaAttivo(c) && !c.is_demo));
  const P = await percorsi(monitorate.map(c => c.id));
  const perAzienda = [];
  for (const c of monitorate) {
    const finestra = finestraAnno(c.data_avvio_programma || null, adesso);
    const pazienti = P.pazienti.filter(p => p.client_id === c.id && inCarico(p));
    const cicli = P.cicli.filter(x => x.client_id === c.id);
    const tipoCiclo = Object.fromEntries(cicli.map(x => [x.id, x.cycle_type || 'treatment']));
    const sedute = P.sedute.filter(s => s.client_id === c.id && nellAnno(s.date, finestra));
    const erogate = {
      l1: sedute.filter(s => tipoCiclo[s.cycle_id] !== 'prevention').length,
      l2: sedute.filter(s => tipoCiclo[s.cycle_id] === 'prevention').length,
    };
    const seduteDate = {};
    for (const s of P.sedute.filter(x => x.client_id === c.id && x.cycle_id)) (seduteDate[s.cycle_id] = seduteDate[s.cycle_id] || []).push(giornoIt(s.date));
    const autos = P.autosegnalazioni.filter(s => s.client_id === c.id);
    const persone = [];
    for (const p of pazienti) {
      const suoiCicli = cicli.filter(x => x.patient_id === p.id);
      const sueAuto = autos.filter(s => s.patient_id === p.id);
      const liv = livelloDi(p);
      if (!suoiCicli.length && !sueAuto.some(s => s.status === 'pending') && liv !== 'level1' && liv !== 'level2') continue;
      const righe = statoPercorso({ cicli: suoiCicli, seduteDate, autosegnalazioni: sueAuto, livello: liv, dataAvvio: c.data_avvio_programma || null, adesso });
      persone.push({ id: p.id, nome: nome(p), livello: liv, professionalId: p.assigned_professional_id || null, stato: righe });
      const chi = nome(p);
      const base = { clientId: c.id, azienda: c.name, patientId: p.id, professionalId: p.assigned_professional_id || null };
      for (const ciclo of suoiCicli) {
        const av = avvisoDurataCiclo(ciclo, { adesso });
        if (av) allarmi.push({ ...base, tipo: 'ritmo_l1', grave: av.superato || av.restano <= 7, testo: allarmeTesto('ritmo_l1', { persona: chi, testo: av.testo }) });
      }
      const prev = suoiCicli.filter(x => x.cycle_type === 'prevention').sort((x, y) => String(y.started_at).localeCompare(String(x.started_at)))[0];
      if (prev || liv === 'level2') {
        const t = prevenzioneTrimestre({ dataAvvio: c.data_avvio_programma || null, date: prev ? (seduteDate[prev.id] || []) : [], adesso });
        if (t && t.allarme) allarmi.push({ ...base, tipo: 'trimestre_l2', grave: t.restano <= 7, testo: allarmeTesto('trimestre_l2', { persona: chi, trimestre: t.corrente.numero, fine: giornoBreve(t.ultimoGiorno), restano: t.restano }) });
      }
      for (const s of sueAuto.filter(x => x.status === 'pending')) {
        const g = giorniTra(giornoIt(s.created_at), oggi);
        if (g > SPORTELLO.autosegnalazione_entro_giorni) allarmi.push({ ...base, tipo: 'autosegnalazione', grave: true, testo: allarmeTesto('autosegnalazione', { persona: chi, giorni: g }) });
      }
    }
    persone.sort((x, y) => x.nome.localeCompare(y.nome));
    perAzienda.push({
      id: c.id, nome: c.name, attivo: programmaAttivo(c), dataAvvio: c.data_avvio_programma || null,
      contratto: P.contratti[c.id] || null, erogate, persone,
    });
  }

  // Agenda per osteopata (periodo richiesto).
  const agenda = {};
  for (const g of giornate) {
    if (g.stato === 'annullata' || !g.professional_id) continue;
    (agenda[g.professional_id] = agenda[g.professional_id] || { id: g.professional_id, nome: nomeOsteopata[g.professional_id] || '—', giornate: [] }).giornate.push(inChiaro(g));
  }
  const inConflitto = new Set(conflitti(giornate).flat());

  const ordineGrave = (x, y) => (y.grave - x.grave) || String(x.data || '').localeCompare(String(y.data || ''));
  return {
    oggi, da, a,
    giornate: giornate.map(g => ({ ...inChiaro(g), conflitto: inConflitto.has(g.id) })),
    agenda: Object.values(agenda).sort((x, y) => x.nome.localeCompare(y.nome)),
    allarmi: allarmi.sort(ordineGrave),
    aziende: perAzienda,
    scelte: {
      aziende: (clienti || []).filter(c => !c.is_demo || clientId === c.id).map(c => ({ id: c.id, nome: c.name })).sort((x, y) => x.nome.localeCompare(y.nome)),
      osteopati: (professionisti || []).filter(p => p.active !== false).map(p => ({ id: p.id, nome: p.name })),
    },
  };
}

// ─── Vista dell'osteopata: le sue giornate e i suoi allarmi ──────────────────
// Riceve: le giornate a lui assegnate, gli allarmi delle SUE giornate, dei SUOI pazienti
// (quelli presi in carico da lui) e le autosegnalazioni in attesa nelle sue aziende
// (Livello A: contatto e priorità, come la lista d'attesa). Mai le persone degli altri.
export async function datiSportelloOsteopata(proId, { adesso = new Date() } = {}) {
  const oggi = giornoIt(adesso);
  const assegnazioni = await getAssignmentsByProfessional(proId).catch(() => []);
  const mieAziende = (assegnazioni || []).map(x => x.client_id);
  const tutto = await datiSportello({ da: oggi, a: aggiungiGiorniG(oggi, 28), adesso });
  const miePersone = new Set(tutto.aziende.flatMap(c => c.persone.filter(p => p.professionalId === proId).map(p => p.id)));
  const mieGiornate = tutto.giornate.filter(g => g.professional_id === proId && g.stato !== 'annullata');
  const mieGiornateId = new Set(mieGiornate.map(g => g.id));
  const allarmi = tutto.allarmi.filter(x =>
    (x.giornataId && mieGiornateId.has(x.giornataId))
    || (x.patientId && miePersone.has(x.patientId))
    || (x.tipo === 'autosegnalazione' && mieAziende.includes(x.clientId)));
  return {
    oggi,
    giornate: mieGiornate.map(g => ({ id: g.id, azienda: g.azienda, sede: g.sede, stanza: g.stanza, data: g.data, ora_inizio: g.ora_inizio, ora_fine: g.ora_fine, posti: g.posti, sedute_prenotate: g.sedute_prenotate, ergonomia_persone: g.ergonomia_persone, occupati: g.occupati, note_logistiche: g.note_logistiche, conflitto: g.conflitto })),
    allarmi: allarmi.map(x => ({ tipo: x.tipo, grave: x.grave, azienda: x.azienda, data: x.data || null, testo: x.testo, patientId: miePersone.has(x.patientId) ? x.patientId : null })),
  };
}

// ─── Vista dell'azienda: solo giornate e posti, mai chi né quanti prenotati ────
export async function giornateAzienda(clientId, { adesso = new Date(), giorni = 60 } = {}) {
  const oggi = giornoIt(adesso);
  const g = await elencaGiornate({ da: oggi, a: aggiungiGiorniG(oggi, giorni), clientIds: [clientId] });
  return g.filter(x => x.stato !== 'annullata').map(x => ({ data: x.data, ora_inizio: x.ora_inizio, ora_fine: x.ora_fine, sede: x.sede, stanza: x.stanza, posti: x.posti }));
}
