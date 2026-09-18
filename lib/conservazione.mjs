import { dataIt } from './date-it.mjs';
// ─────────────────────────────────────────────────────────────────────────────
// CONSERVAZIONE DELLA DOCUMENTAZIONE CLINICA — regola pura (.mjs, testata).
//
// Decisione di Enrico (17/9): la cancellazione dell'amministratore non parte se
// esiste documentazione clinica ancora nel periodo di conservazione, e dice perché.
//
// Conta come documentazione clinica ciò che nasce dalla PRESA IN CARICO
// (documenti firmati, copie su carta, sedute, cicli, pre-validazioni, mini-check,
// check periodici, rivalutazioni, eventi acuti). NON conta il solo check-up: chi
// ha soltanto risposto al check-up deve restare cancellabile (l'informativa
// promette la cancellazione dei contatti entro 6 mesi se il programma non parte).
//
// Il periodo si conta dal record clinico PIÙ RECENTE.
// ─────────────────────────────────────────────────────────────────────────────

export const TABELLE_CLINICHE = [
  { tabella: 'patient_documents', date: ['signed_at', 'updated_at', 'created_at'], etichetta: 'documenti firmati o compilati' },
  { tabella: 'anamnesi_integrazioni', date: ['creato_il'], etichetta: 'integrazioni dell\'anamnesi' },
  { tabella: 'copie_cartacee', date: ['caricato_il'], etichetta: 'copie firmate su carta' },
  { tabella: 'sessions', date: ['closed_at', 'date', 'created_at'], etichetta: 'sedute' },
  { tabella: 'treatment_cycles', date: ['closed_at', 'updated_at', 'started_at'], etichetta: 'cicli di trattamento o prevenzione' },
  { tabella: 'pre_validations', date: ['created_at'], etichetta: 'pre-validazioni' },
  { tabella: 'mini_checks', date: ['created_at'], etichetta: 'mini-check' },
  { tabella: 'checkpoints', date: ['created_at'], etichetta: 'check periodici' },
  { tabella: 'reassessments_t12', date: ['completed_at', 'created_at'], etichetta: 'rivalutazioni annuali' },
  { tabella: 'acute_events', date: ['resolved_at', 'updated_at', 'reported_at', 'created_at'], etichetta: 'eventi acuti' },
];

const ms = (v) => { const t = v ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : null; };

// righe: { [tabella]: [riga, ...] } · anni: periodo di conservazione.
// Ritorna { bloccato, ultima, finoAl, elementi: [{ etichetta, n }] }.
export function esitoConservazione(righe, anni, adesso = new Date()) {
  let ultima = null;
  const elementi = [];
  for (const { tabella, date, etichetta } of TABELLE_CLINICHE) {
    const elenco = (righe && righe[tabella]) || [];
    if (!elenco.length) continue;
    elementi.push({ etichetta, n: elenco.length });
    for (const r of elenco) {
      // Data più recente fra quelle della riga; una riga senza date vale «adesso»
      // (nel dubbio si conserva).
      const t = Math.max(...date.map(k => ms(r[k])).filter(x => x != null), -Infinity);
      const quando = Number.isFinite(t) ? t : adesso.getTime();
      if (ultima == null || quando > ultima) ultima = quando;
    }
  }
  if (!elementi.length) return { bloccato: false, ultima: null, finoAl: null, elementi };
  const fino = new Date(ultima);
  fino.setUTCFullYear(fino.getUTCFullYear() + anni);
  return {
    bloccato: fino.getTime() > adesso.getTime(),
    ultima: new Date(ultima).toISOString(),
    finoAl: fino.toISOString(),
    elementi,
  };
}

export function messaggioConservazione(esito, anni, nome = 'il paziente') {
  const cosa = esito.elementi.map(e => `${e.etichetta} (${e.n})`).join(', ');
  const data = dataIt(esito.finoAl);
  return `Cancellazione non eseguita: per ${nome} esiste documentazione clinica — ${cosa} — ancora nel periodo di conservazione di ${anni} anni, fino al ${data}. Va conservata fino ad allora.`;
}
