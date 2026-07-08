// ─── Piano ORGANIZZATIVO — anagrafica + formazione (separato dal clinico) ───────
// Logica pura (coda recupero, trigger, configurazione, importo) + accesso dati
// admin (service_role) + seed dall'assessment (COPIA dei soli nomi, mai link
// clinico). Nessun campo sanitario qui. Vedi migration v37.
import supabase from './db';
import { generateId, getClientById, getPatientsByClient } from './store';
import { K_ANON, tooSmall } from './kanon';

// Default del codice (fallback finale). I valori EFFETTIVI vivono in
// pricing_settings (v2), editabili da Listino v2 — caricati da getOrgParams().
// Precedenza a valle: override per-azienda (clients.listino_*/soglia_x) →
// pricing_settings → questi default.
export const ORG_PARAMS = {
  finestra_mesi: 6,
  soglia_fasce: [{ max: 50, soglia: 5 }, { max: 200, soglia: 10 }, { max: Infinity, soglia: 20 }],
  listino_concentrata_default: 350,
  listino_base_completa_default: 500,
};

// Carica i parametri formativi globali da pricing_settings (v2), con fallback ai
// default del codice. soglia_recupero_fasce è JSON (null = Infinity).
export async function getOrgParams() {
  const p = {
    finestraMesi: ORG_PARAMS.finestra_mesi,
    sogliaFasce: ORG_PARAMS.soglia_fasce,
    listinoConcentrata: ORG_PARAMS.listino_concentrata_default,
    listinoBaseCompleta: ORG_PARAMS.listino_base_completa_default,
  };
  try {
    const { data } = await supabase.from('pricing_settings').select('key,value').eq('version', 'v2')
      .in('key', ['listino_concentrata', 'listino_base_completa', 'finestra_recupero_mesi', 'soglia_recupero_fasce']);
    for (const r of data || []) {
      const num = Number(r.value);
      if (r.key === 'listino_concentrata' && Number.isFinite(num)) p.listinoConcentrata = num;
      else if (r.key === 'listino_base_completa' && Number.isFinite(num)) p.listinoBaseCompleta = num;
      else if (r.key === 'finestra_recupero_mesi' && Number.isFinite(num)) p.finestraMesi = num;
      else if (r.key === 'soglia_recupero_fasce') {
        try {
          const arr = JSON.parse(r.value);
          if (Array.isArray(arr) && arr.length) p.sogliaFasce = arr.map(f => ({ max: f.max == null ? Infinity : Number(f.max), soglia: Number(f.soglia) }));
        } catch (_) { /* fallback ai default */ }
      }
    }
  } catch (_) { /* fallback ai default */ }
  return p;
}

// ─── Logica pura (testabile, senza I/O; `today`/`dataAvvio` = 'YYYY-MM-DD') ──────

export function sogliaDefaultPerFascia(employees, sogliaFasce = ORG_PARAMS.soglia_fasce) {
  const n = parseInt(employees) || 0;
  const f = sogliaFasce.find(x => n <= x.max) || sogliaFasce[sogliaFasce.length - 1];
  return f.soglia;
}

function addMonths(dateStr, n) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

// Anno di programma: override manuale se presente, altrimenti derivato da data_avvio.
export function annoProgramma(client, today) {
  if (client && client.anno_programma != null) return client.anno_programma;
  if (!client || !client.data_avvio_programma) return 1;
  const start = new Date(client.data_avvio_programma);
  const now = new Date(today);
  let years = now.getFullYear() - start.getFullYear();
  const anniv = new Date(start); anniv.setFullYear(start.getFullYear() + years);
  if (now < anniv) years -= 1;
  return Math.max(1, years + 1);
}

export function isNuovoIngresso(dip, dataAvvio) {
  return !!(dip && dip.data_ingresso && dataAvvio && dip.data_ingresso > dataAvvio);
}

function haBaseSvolta(dipId, partecipazioni) {
  return (partecipazioni || []).some(p =>
    p.dipendente_id === dipId && (p.tipo === 'base' || p.tipo === 'base_concentrata') && p.stato === 'svolta');
}

// Coda recupero: nuovi ingressi attivi (non straordinari, non cessati) senza base
// 'svolta'. Ordinata per data_ingresso crescente → il primo àncora la finestra 6 mesi.
export function codaRecupero(dipendenti, partecipazioni, dataAvvio) {
  return (dipendenti || [])
    .filter(d => d.attivo && !d.straordinario && !d.data_cessazione
      && isNuovoIngresso(d, dataAvvio) && !haBaseSvolta(d.id, partecipazioni))
    .sort((a, b) => (a.data_ingresso || '').localeCompare(b.data_ingresso || ''));
}

// Trigger: parte se coda >= soglia_x OPPURE 6 mesi dall'ingresso del primo in coda.
export function triggerRecupero(coda, sogliaX, today, finestraMesi = ORG_PARAMS.finestra_mesi) {
  const n = (coda || []).length;
  const primo = (coda && coda[0]) || null;
  const scadenza = primo && primo.data_ingresso ? addMonths(primo.data_ingresso, finestraMesi) : null;
  const perSoglia = sogliaX != null && n >= sogliaX;
  const perTempo = scadenza != null && today >= scadenza;
  const active = n > 0 && (perSoglia || perTempo);
  return {
    active, n, soglia: sogliaX, primoInCoda: primo, scadenzaSeiMesi: scadenza,
    perSoglia, perTempo, motivo: !active ? null : (perSoglia ? 'soglia' : 'sei_mesi'),
  };
}

// CONCENTRATA vs COMPLETA: decisa dalla CAPIENZA (non dalla soglia).
export function configurazioneRecupero(nPartecipanti, capienza) {
  const cap = Math.max(1, parseInt(capienza) || 1);
  const tipo = nPartecipanti <= cap ? 'base_concentrata' : 'base';
  const nGruppi = Math.max(1, Math.ceil(nPartecipanti / cap));
  return { tipo, nGruppi };
}

// Importo a consumo = n_gruppi × listino (concentrata o base completa).
export function importoRecupero(nPartecipanti, capienza, listinoConcentrata, listinoBase) {
  const { tipo, nGruppi } = configurazioneRecupero(nPartecipanti, capienza);
  const listino = tipo === 'base_concentrata' ? Number(listinoConcentrata) : Number(listinoBase);
  return { tipo, nGruppi, importo: nGruppi * (Number.isFinite(listino) ? listino : 0) };
}

// Proposta completa (trigger + configurazione + importo) per la vista admin.
export function propostaRecupero(coda, client, today, orgParams = null) {
  const op = orgParams || {
    finestraMesi: ORG_PARAMS.finestra_mesi, sogliaFasce: ORG_PARAMS.soglia_fasce,
    listinoConcentrata: ORG_PARAMS.listino_concentrata_default, listinoBaseCompleta: ORG_PARAMS.listino_base_completa_default,
  };
  const soglia = (client && client.soglia_x != null) ? client.soglia_x : sogliaDefaultPerFascia(client && client.employees, op.sogliaFasce);
  const trig = triggerRecupero(coda, soglia, today, op.finestraMesi);
  if (!trig.active) return { ...trig, proposta: null };
  const lc = (client && client.listino_concentrata != null) ? client.listino_concentrata : op.listinoConcentrata;
  const lb = (client && client.listino_base_completa != null) ? client.listino_base_completa : op.listinoBaseCompleta;
  const imp = importoRecupero(coda.length, client && client.capienza_gruppo, lc, lb);
  return { ...trig, proposta: { nPartecipanti: coda.length, ...imp } };
}

// Dedup (silenzioso): forte = matricola uguale; debole = nome+data_ingresso.
const norm = s => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
export function findDuplicato(nuovo, esistenti) {
  if (nuovo.matricola && nuovo.matricola.trim()) {
    const m = (esistenti || []).find(e => e.id !== nuovo.id && e.matricola && e.matricola.trim() === nuovo.matricola.trim());
    if (m) return { match_dipendente_id: m.id, match_tipo: 'forte_matricola' };
  }
  const m2 = (esistenti || []).find(e => e.id !== nuovo.id && (e.data_ingresso || '')
    && (e.data_ingresso || '') === (nuovo.data_ingresso || '') && norm(e.nome) === norm(nuovo.nome));
  if (m2) return { match_dipendente_id: m2.id, match_tipo: 'debole_nome_data' };
  return null;
}

// Aggregato GREZZO (vista admin): % base completata + N in attesa + popolazione.
export function aggregati(dipendenti, partecipazioni, dataAvvio) {
  const attivi = (dipendenti || []).filter(d => d.attivo && !d.data_cessazione && !d.straordinario);
  const N = attivi.length;
  const conBase = attivi.filter(d => haBaseSvolta(d.id, partecipazioni)).length;
  return {
    popolazioneAderente: N,
    conBase, senzaBase: N - conBase,
    pctBaseCompletata: N ? Math.round((conBase / N) * 100) : 0,
    nNuoviInAttesa: codaRecupero(dipendenti, partecipazioni, dataAvvio).length,
  };
}

// Gruppo "piccolo ma non vuoto": 1..K-1 → singolarizza pochi individui.
const smallGroup = x => x >= 1 && tooSmall(x);

// Versione PUBBLICA (azienda/HR): k-anonymity per evitare la re-identificazione
// del singolo, anche per differenza (K da lib/kanon, =5).
//  - aderenti < K  → soppressione TOTALE (qualsiasi aggregato di un'azienda con
//    pochi aderenti rivelerebbe il singolo, anche calcolando per differenza);
//  - N in attesa fra 1 e K-1 → soppresso ("<K"); 0 o ≥K → mostrato.
// Con N≥K la % e un conteggio ≥K non isolano un individuo fra molti.
export function aggregatiPubblici(raw) {
  const N = raw ? raw.popolazioneAderente : 0;
  if (tooSmall(N)) {
    return { soppresso: true, motivo: `pochi aderenti (< ${K_ANON})`, sogliaK: K_ANON, pctBaseCompletata: null, nNuoviInAttesa: null };
  }
  // % soppressa se uno dei due gruppi (completati / non completati) è piccolo:
  // mostrarla rivelerebbe quel gruppo "per differenza" (uniforme 0%/100% = ok).
  const pctSafe = !smallGroup(raw.conBase) && !smallGroup(raw.senzaBase);
  // N in attesa soppresso se 1..K-1.
  const nSafe = !smallGroup(raw.nNuoviInAttesa);
  return {
    soppresso: false,
    sogliaK: K_ANON,
    pctBaseCompletata: pctSafe ? raw.pctBaseCompletata : null,
    pctBaseCompletataSoppressa: !pctSafe,
    nNuoviInAttesa: nSafe ? raw.nNuoviInAttesa : null,
    nNuoviInAttesaSoppresso: !nSafe,   // true → la UI mostra "<K"
  };
}

// ─── Accesso dati (admin / service_role) ────────────────────────────────────────

export async function getOrgDipendenti(client_id) {
  const { data } = await supabase.from('org_dipendente').select('*').eq('client_id', client_id).order('created_at', { ascending: true });
  return data || [];
}
export async function insertOrgDipendente(fields) {
  const { data, error } = await supabase.from('org_dipendente').insert({ id: generateId('odip'), ...fields }).select().single();
  if (error) throw error;
  return data;
}
// HR-ready: insert "puro" che NON ritorna la riga (per il futuro endpoint HR).
export async function insertOrgDipendentePuro(fields) {
  const { error } = await supabase.from('org_dipendente').insert({ id: generateId('odip'), inserito_da: 'hr', ...fields });
  return { ok: !error };
}
export async function updateOrgDipendente(id, fields) {
  const { data, error } = await supabase.from('org_dipendente').update(fields).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function getOrgPartecipazioni(client_id) {
  const dips = await getOrgDipendenti(client_id);
  const ids = dips.map(d => d.id);
  if (!ids.length) return [];
  const { data } = await supabase.from('org_partecipazione_formativa').select('*').in('dipendente_id', ids);
  return data || [];
}
export async function insertOrgPartecipazioni(rows) {
  if (!rows || !rows.length) return [];
  const withIds = rows.map(r => ({ id: generateId('opart'), ...r }));
  const { data, error } = await supabase.from('org_partecipazione_formativa').insert(withIds).select();
  if (error) throw error;
  return data || [];
}
export async function updateOrgPartecipazione(id, fields) {
  const { data, error } = await supabase.from('org_partecipazione_formativa').update(fields).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function getOrgSessioni(client_id) {
  const { data } = await supabase.from('org_sessione_formativa').select('*').eq('client_id', client_id).order('created_at', { ascending: false });
  return data || [];
}
export async function insertOrgSessione(fields) {
  const { data, error } = await supabase.from('org_sessione_formativa').insert({ id: generateId('osess'), ...fields }).select().single();
  if (error) throw error;
  return data;
}
export async function updateOrgSessione(id, fields) {
  const { data, error } = await supabase.from('org_sessione_formativa').update(fields).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function getOrgDuplicati(client_id, stato = 'aperto') {
  let q = supabase.from('org_duplicato_validazione').select('*').eq('client_id', client_id);
  if (stato) q = q.eq('stato', stato);
  const { data } = await q.order('created_at', { ascending: false });
  return data || [];
}
export async function insertOrgDuplicato(fields) {
  const { error } = await supabase.from('org_duplicato_validazione').insert({ id: generateId('odup'), ...fields });
  return { ok: !error };
}
export async function updateOrgDuplicato(id, fields) {
  const { data, error } = await supabase.from('org_duplicato_validazione').update(fields).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ─── Azioni composte ────────────────────────────────────────────────────────────

// Aggiunge un dipendente e accoda l'eventuale duplicato (non bloccante).
// Per gli inserimenti admin il duplicato è restituito (segnalazione immediata).
export async function aggiungiDipendente(client_id, f) {
  const dip = await insertOrgDipendente({
    client_id,
    nome: f.nome,
    data_ingresso: f.data_ingresso || null,
    matricola: f.matricola || null,
    identificativo_hr: f.identificativo_hr || null,
    straordinario: !!f.straordinario,
    inserito_da: f.inserito_da === 'hr' ? 'hr' : 'admin',
  });
  const esistenti = (await getOrgDipendenti(client_id)).filter(e => e.id !== dip.id);
  const dup = findDuplicato(dip, esistenti);
  if (dup) await insertOrgDuplicato({ client_id, dipendente_id: dip.id, match_dipendente_id: dup.match_dipendente_id, match_tipo: dup.match_tipo });
  return { dipendente: dip, duplicato: dup };
}

// SEED: copia SOLO i nomi (first+last) dalla popolazione assessment in org_dipendente.
// Nessun campo clinico, nessun FK al record clinico. Idempotente per nome.
export async function seedDipendentiDaAssessment(client_id) {
  const patients = await getPatientsByClient(client_id).catch(() => []);
  const esistenti = await getOrgDipendenti(client_id);
  const presenti = new Set(esistenti.map(d => norm(d.nome)));
  const nuovi = [];
  for (const p of patients) {
    const nome = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    if (!nome || presenti.has(norm(nome))) continue;
    presenti.add(norm(nome));
    nuovi.push({ id: generateId('odip'), client_id, nome, inserito_da: 'admin', data_ingresso: null, attivo: true });
  }
  if (nuovi.length) await supabase.from('org_dipendente').insert(nuovi);
  return { importati: nuovi.length, popolazioneAssessment: patients.length };
}

// Genera una sessione di recupero dalla coda corrente (+ partecipazioni 'pianificata').
// origine 'recupero_autonomo' (autonoma); l'aggancio a una campagna è gestito a parte.
export async function generaSessioneRecupero(client_id, { today, origine = 'recupero_autonomo' } = {}) {
  const client = await getClientById(client_id);
  if (!client) return { ok: false, motivo: 'cliente non trovato' };
  const [dips, part] = await Promise.all([getOrgDipendenti(client_id), getOrgPartecipazioni(client_id)]);
  const coda = codaRecupero(dips, part, client.data_avvio_programma);
  if (!coda.length) return { ok: false, motivo: 'coda vuota' };
  const op = await getOrgParams();
  const lc = client.listino_concentrata != null ? client.listino_concentrata : op.listinoConcentrata;
  const lb = client.listino_base_completa != null ? client.listino_base_completa : op.listinoBaseCompleta;
  const { tipo, nGruppi, importo } = importoRecupero(coda.length, client.capienza_gruppo, lc, lb);
  const sess = await insertOrgSessione({
    client_id, tipo, origine, anno_programma: annoProgramma(client, today),
    data_pianificata: null, stato: 'pianificata', a_consumo: false, importo_dovuto: importo,
    note: `Recupero ${coda.length} nuovi ingressi · ${nGruppi} gruppo/i`,
  });
  await insertOrgPartecipazioni(coda.map(d => ({ dipendente_id: d.id, sessione_formativa_id: sess.id, tipo, stato: 'pianificata' })));
  return { ok: true, sessione: sess, nPartecipanti: coda.length, nGruppi, importo, tipo };
}

// Parametri di programma dell'azienda (colonne org su clients).
export async function updateClientOrgParams(client_id, fields) {
  const allowed = ['data_avvio_programma', 'anno_programma', 'popolazione_aderente', 'soglia_x', 'capienza_gruppo', 'listino_concentrata', 'listino_base_completa'];
  const patch = {};
  for (const k of allowed) if (k in (fields || {})) patch[k] = fields[k] === '' ? null : fields[k];
  const { data, error } = await supabase.from('clients').update(patch).eq('id', client_id).select().single();
  if (error) throw error;
  return data;
}

// Import lista (admin): aggiunge in blocco, ognuno con dedup.
export async function importDipendenti(client_id, lista) {
  const out = { importati: 0, conDuplicato: 0 };
  for (const f of (lista || [])) {
    if (!f || !f.nome || !f.nome.trim()) continue;
    const { duplicato } = await aggiungiDipendente(client_id, { ...f, inserito_da: 'admin' });
    out.importati++; if (duplicato) out.conDuplicato++;
  }
  return out;
}

// Marca una sessione 'erogata' confermando i presenti: le loro partecipazioni →
// 'svolta' (data_svolgimento = data_erogazione); i NON presenti restano 'da_recuperare'.
export async function markSessioneErogata(sessione_id, { data_erogazione, presentiDipendentiIds }) {
  const oggi = data_erogazione || new Date().toISOString().slice(0, 10);
  const sess = await updateOrgSessione(sessione_id, { stato: 'erogata', data_erogazione: oggi, a_consumo: true });
  const { data: parts } = await supabase.from('org_partecipazione_formativa').select('*').eq('sessione_formativa_id', sessione_id);
  const presenti = new Set(presentiDipendentiIds || []);
  for (const p of (parts || [])) {
    await updateOrgPartecipazione(p.id, presenti.has(p.dipendente_id)
      ? { stato: 'svolta', data_svolgimento: oggi }
      : { stato: 'da_recuperare' });
  }
  return { sessione: sess, presenti: presenti.size, totali: (parts || []).length };
}

// Risolve una voce della coda duplicati (solo admin).
export async function risolviDuplicato(id, azione) {
  const { data: dup } = await supabase.from('org_duplicato_validazione').select('*').eq('id', id).maybeSingle();
  if (!dup) return null;
  if (azione === 'unisci') {
    // stessa persona: disattivo il record nuovo (duplicato), tengo l'esistente.
    await updateOrgDipendente(dup.dipendente_id, { attivo: false, data_cessazione: new Date().toISOString().slice(0, 10) });
    return updateOrgDuplicato(id, { stato: 'unito' });
  }
  return updateOrgDuplicato(id, { stato: 'confermato_distinto' }); // persone diverse
}

// Stato ORGANIZZATIVO completo (NOMINATIVO) — solo per endpoint admin.
export async function getStatoOrg(client_id, today) {
  const client = await getClientById(client_id);
  if (!client) return null;
  const [dipendenti, partecipazioni, sessioni, duplicati] = await Promise.all([
    getOrgDipendenti(client_id), getOrgPartecipazioni(client_id), getOrgSessioni(client_id), getOrgDuplicati(client_id, 'aperto'),
  ]);
  const dataAvvio = client.data_avvio_programma || null;
  const coda = codaRecupero(dipendenti, partecipazioni, dataAvvio);
  const op = await getOrgParams();
  return {
    params: {
      id: client.id, name: client.name, employees: client.employees,
      data_avvio_programma: dataAvvio, anno_programma: annoProgramma(client, today),
      popolazione_aderente: client.popolazione_aderente ?? null,
      soglia_x: client.soglia_x ?? sogliaDefaultPerFascia(client.employees, op.sogliaFasce),
      capienza_gruppo: client.capienza_gruppo ?? null,
      listino_concentrata: client.listino_concentrata ?? op.listinoConcentrata,
      listino_base_completa: client.listino_base_completa ?? op.listinoBaseCompleta,
    },
    dipendenti, partecipazioni, sessioni, duplicati, coda,
    proposta: propostaRecupero(coda, client, today, op),
    aggregati: aggregati(dipendenti, partecipazioni, dataAvvio),
  };
}

// SOLO NUMERI per l'azienda/HR — nessuna riga individuale, con k-anonymity.
export async function getAggregatiOrg(client_id) {
  const client = await getClientById(client_id);
  const [dipendenti, partecipazioni] = await Promise.all([getOrgDipendenti(client_id), getOrgPartecipazioni(client_id)]);
  return aggregatiPubblici(aggregati(dipendenti, partecipazioni, client?.data_avvio_programma || null));
}

// Registro formativo CSV — SOLO dati organizzativi (nome, matricola, date, stato
// formativo). NESSUN campo clinico (le tabelle org_ non ne contengono). Admin-only
// è garantito dall'endpoint (requireAuth).
function _statoTipo(partecipazioni, dipId, tipi) {
  const p = (partecipazioni || []).filter(x => x.dipendente_id === dipId && tipi.includes(x.tipo));
  const s = p.find(x => x.stato === 'svolta');
  if (s) return ['svolta', s.data_svolgimento || ''];
  if (p.some(x => x.stato === 'pianificata')) return ['pianificata', ''];
  return ['pendente', ''];
}
export function buildRegistroCsv(dipendenti, partecipazioni, annoCorrente) {
  const q = v => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const header = ['Nome', 'Matricola', 'Data ingresso', 'Data cessazione', 'Attivo', 'Straordinario', 'Origine',
    'Base — stato', 'Base — data', `Aggiornamento ${annoCorrente} — stato`, `Aggiornamento ${annoCorrente} — data`];
  const rows = (dipendenti || []).map(d => {
    const [bs, bd] = _statoTipo(partecipazioni, d.id, ['base', 'base_concentrata']);
    const [as, ad] = _statoTipo(partecipazioni, d.id, ['aggiornamento']);
    return [d.nome, d.matricola || '', d.data_ingresso || '', d.data_cessazione || '', d.attivo ? 'sì' : 'no',
      d.straordinario ? 'sì' : 'no', d.inserito_da, bs, bd, as, ad];
  });
  return [header, ...rows].map(r => r.map(q).join(';')).join('\r\n');
}

// Widget dashboard (admin): aziende con coda recupero non vuota + stato trigger
// + eventuale prossima campagna di aggiornamento pianificata.
export async function getDashboardFormazione(today) {
  const { data: dips } = await supabase.from('org_dipendente')
    .select('id,client_id,data_ingresso,attivo,straordinario,data_cessazione');
  if (!dips || !dips.length) return [];
  const ids = [...new Set(dips.map(d => d.client_id))];
  const [{ data: parts }, { data: clients }, { data: sess }] = await Promise.all([
    supabase.from('org_partecipazione_formativa').select('dipendente_id,tipo,stato'),
    supabase.from('clients').select('id,name,employees,data_avvio_programma,soglia_x').in('id', ids),
    supabase.from('org_sessione_formativa').select('client_id,tipo,stato,data_pianificata').in('client_id', ids).eq('tipo', 'aggiornamento').eq('stato', 'pianificata'),
  ]);
  const clientById = Object.fromEntries((clients || []).map(c => [c.id, c]));
  const dipsByClient = {};
  for (const d of dips) (dipsByClient[d.client_id] = dipsByClient[d.client_id] || []).push(d);
  const op = await getOrgParams();
  const out = [];
  for (const cid of ids) {
    const c = clientById[cid]; if (!c) continue;
    const coda = codaRecupero(dipsByClient[cid], parts, c.data_avvio_programma);
    if (!coda.length) continue;
    const soglia = c.soglia_x != null ? c.soglia_x : sogliaDefaultPerFascia(c.employees, op.sogliaFasce);
    const trig = triggerRecupero(coda, soglia, today, op.finestraMesi);
    const giorni = trig.scadenzaSeiMesi ? Math.ceil((new Date(trig.scadenzaSeiMesi) - new Date(today)) / 86400000) : null;
    const camp = (sess || []).filter(s => s.client_id === cid && s.data_pianificata && s.data_pianificata >= today)
      .map(s => s.data_pianificata).sort()[0] || null;
    out.push({ client_id: cid, name: c.name, nInAttesa: coda.length, soglia, active: trig.active, motivo: trig.motivo, giorniAllaScadenza: giorni, prossimaCampagna: camp });
  }
  return out.sort((a, b) => (b.active - a.active) || ((a.giorniAllaScadenza ?? 9999) - (b.giorniAllaScadenza ?? 9999)));
}
