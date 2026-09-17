import { ETICHETTA_ACCORDO } from './accordo.mjs';

// ─── Configurazione UNICA dei documenti di conformità del professionista ─────
// Sorgente unica usata da /pro/documents, dalla vista admin conformità e dal
// registro log. Cambiando i flag/slot qui, l'effetto è ovunque.

// Feature flag: la QUIETANZA RC è temporaneamente NASCOSTA. L'infrastruttura
// resta intatta (colonna DB, valore enum 'rc_receipt', endpoint, log): rimetti
// true per riaccendere lo slot ovunque.
export const SHOW_RC_RECEIPT = false;

// Tipi che compongono la QUALIFICA: ne basta ALMENO UNO per essere conformi
// (l'albo degli osteopati è ancora in costituzione → vale anche il titolo).
export const QUALIFICATION_TYPES = ['qualification_diploma', 'albo'];

// Tutti gli slot documento (anche quelli nascosti dal flag).
const ALL_SLOTS = [
  { type: 'identity', label: "Documento d'identità", required: true },
  { type: 'qualification_diploma', label: 'Titolo di formazione in osteopatia', group: 'qualification' },
  { type: 'albo', label: 'Iscrizione albo professionale', group: 'qualification' },
  { type: 'rc_policy', label: 'Polizza RC professionale', required: true, expiry: true },
  { type: 'rc_receipt', label: 'Quietanza RC', flag: 'rc_receipt' },
  { type: 'contract', label: 'Contratto di collaborazione firmato', required: true },
];

// Slot VISIBILI (rispetta il feature flag della quietanza).
export const SLOTS = ALL_SLOTS.filter(s => !(s.flag === 'rc_receipt' && !SHOW_RC_RECEIPT));

// Enum completo dei doc_type ammessi lato server (allineato al CHECK del DB v35).
// Include 'rc_receipt' anche se nascosto: l'infrastruttura resta valida.
export const DOC_TYPES = ALL_SLOTS.map(s => s.type);

// Etichette per OGNI tipo (anche nascosti) — usate dal registro accessi.
export const DOC_LABEL = { ...Object.fromEntries(ALL_SLOTS.map(s => [s.type, s.label])), accordo_trattamento_dati: ETICHETTA_ACCORDO };

// Stato di conformità: obbligatori = identità + qualifica(almeno uno) + RC +
// contratto + accordo sul trattamento dei dati (v66). La quietanza NON concorre.
// presentTypes = doc_type presenti; accordo = esito di lib/accordo.mjs statoAccordo.
// Senza l'esito dell'accordo NON si è conformi (nel dubbio si blocca).
export function complianceState(presentTypes, accordo) {
  const has = t => (presentTypes || []).includes(t);
  const qualificationOk = QUALIFICATION_TYPES.some(has);
  const missing = [];
  if (!has('identity')) missing.push('Identità');
  if (!qualificationOk) missing.push('Qualifica');
  if (!has('rc_policy')) missing.push('Polizza RC');
  if (!has('contract')) missing.push('Contratto');
  if (!accordo) missing.push(`${ETICHETTA_ACCORDO} (verifica non disponibile)`);
  else if (!accordo.conforme) missing.push(accordo.motivo || ETICHETTA_ACCORDO);
  return { qualificationOk, missing, complete: missing.length === 0 };
}

// Messaggio quando una presa in carico o un'assegnazione si ferma: dice QUALE
// requisito manca, non «non conforme» (Enrico, 17/9).
export function messaggioNonConforme(reasons, azione = 'Presa in carico non consentita') {
  const elenco = (reasons || []).filter(Boolean);
  return `${azione}: il professionista non è in regola con ${elenco.length ? elenco.join('; ') : 'la documentazione richiesta'}.`;
}

// Idoneità all'ASSEGNAZIONE di un professionista a un'azienda.
// Serve la conformità COMPLETA (identità + qualifica(≥1) + RC + contratto) E una
// polizza RC valida (non scaduta). `reasons` elenca cosa manca, per il messaggio.
// Nota: rcStatus 'expiring'/'no_expiry' NON blocca (la copertura è ancora valida).
// rcStatus = uno tra missing|no_expiry|valid|expiring|expired (da rcStatusFrom).
export function assignmentEligibility(presentTypes, rcStatus, accordo) {
  const { missing } = complianceState(presentTypes, accordo);
  const reasons = [...missing]; // include 'Polizza RC' se il file manca del tutto
  if (rcStatus === 'expired') reasons.push('Polizza RC scaduta');
  return { blocked: reasons.length > 0, reasons };
}
