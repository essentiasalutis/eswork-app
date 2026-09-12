// ─────────────────────────────────────────────────────────────────────────────
// REGOLE del piano organizzativo — logica PURA, senza I/O (niente banca dati qui).
// Estratta da lib/org.js il 12/9 perché fosse verificabile da un test che resta
// (npm test): le regole della coda di recupero sono quelle che decidono chi viene
// richiamato a fare formazione, e non devono cambiare per sbaglio.
// `today` / `dataAvvio` sono stringhe 'YYYY-MM-DD'.
// Nessun import: il file deve restare caricabile da Node senza impalcature (npm test).
// ─────────────────────────────────────────────────────────────────────────────

// I TIPI, in un posto solo. La formazione e l'ergonomia vivono sulla stessa macchina
// (sessione → partecipazioni) ma NON sono la stessa cosa: la coda di recupero, i
// trigger e la percentuale di base completata guardano SOLO la formazione.
// Chi allarga una di queste liste tocca chi viene richiamato a fare un corso.
export const TIPI_BASE = ['base', 'base_concentrata'];
export const TIPI_FORMAZIONE = ['base', 'base_concentrata', 'aggiornamento'];
export const TIPO_ERGONOMIA = 'ergonomia';
export const TIPI_PARTECIPAZIONE = [...TIPI_FORMAZIONE, TIPO_ERGONOMIA];

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
    p.dipendente_id === dipId && TIPI_BASE.includes(p.tipo) && p.stato === 'svolta');
}

// Coda recupero: nuovi ingressi attivi (non straordinari, non cessati) senza base
// 'svolta'. Ordinata per data_ingresso crescente → il primo àncora la finestra 6 mesi.
export function codaRecupero(dipendenti, partecipazioni, dataAvvio) {
  // Solo le partecipazioni FORMATIVE entrano qui: una riga di ergonomia non deve
  // poter far comparire (né sparire) qualcuno dalla coda dei corsi (Enrico, 12/9).
  const formative = (partecipazioni || []).filter(x => TIPI_FORMAZIONE.includes(x.tipo));
  return (dipendenti || [])
    .filter(d => d.attivo && !d.straordinario && !d.data_cessazione
      && isNuovoIngresso(d, dataAvvio) && !haBaseSvolta(d.id, formative))
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

// ─── Storico del singolo dipendente (vista admin) ──────────────────────────────
// Linea del tempo ORGANIZZATIVA: ingresso, formazione, ergonomia, cessazione.
// Mai un dato clinico: qui dentro passano solo righe org_* (v37/v59).
const ETICHETTA_TIPO = {
  base: 'Formazione base',
  base_concentrata: 'Formazione base (concentrata)',
  aggiornamento: 'Aggiornamento annuale',
  ergonomia: 'Intervento di ergonomia',
};

export function storicoDipendente(dip, partecipazioni, sessioni = []) {
  if (!dip) return [];
  const perId = Object.fromEntries((sessioni || []).map(s => [s.id, s]));
  const righe = [];
  if (dip.data_ingresso) righe.push({ quando: dip.data_ingresso, cosa: 'Ingresso in azienda', stato: 'fatto', dettaglio: dip.area ? (dip.area === 'reparto' ? 'reparto' : 'ufficio') : null });
  for (const p of (partecipazioni || []).filter(x => x.dipendente_id === dip.id)) {
    const sess = p.sessione_formativa_id ? perId[p.sessione_formativa_id] : null;
    righe.push({
      quando: p.data_svolgimento || (sess && (sess.data_erogazione || sess.data_pianificata)) || null,
      cosa: ETICHETTA_TIPO[p.tipo] || p.tipo,
      stato: p.stato,
      // Come è stata registrata: mai confondere una presenza segnata a mano con una
      // dedotta dal sistema confermando i presenti di una sessione.
      origine: p.tipo === TIPO_ERGONOMIA ? (p.origine === 'intervento' ? 'registrata a mano' : 'dalla conferma presenti') : null,
      dettaglio: sess && sess.gruppo ? `gruppo ${sess.gruppo}` : null,
      anno: sess ? sess.anno_programma : null,
    });
  }
  if (dip.data_cessazione) righe.push({ quando: dip.data_cessazione, cosa: 'Cessazione', stato: 'fatto', dettaglio: null });
  // Le righe senza data (mai svolte) in fondo, il resto dal più recente.
  return righe.sort((a, b) => (b.quando || '').localeCompare(a.quando || ''));
}
