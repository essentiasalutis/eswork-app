// ─────────────────────────────────────────────────────────────────────────────
// MODIFICA DEL PAZIENTE DALLA CARTELLA — cosa l'osteopata può cambiare.
// Modulo PURO (.mjs, testato).
//
// Prima l'API salvava il corpo della richiesta così com'era: un osteopata
// assegnato poteva cambiare azienda, livello, stato, diritto alla prevenzione,
// osteopata assegnato o la chiave dell'area personale — scavalcando la
// stratificazione clinica e il perimetro di accesso (Enrico, 17/9).
//
// Qui si modifica SOLO l'anamnesi. Il livello si cambia con la riclassificazione
// (/reclassify), che mette il L1 in pre-validazione e chiude i cicli aperti.
// Un campo non ammesso non si ignora in silenzio: la richiesta si rifiuta e si
// dice quale campo.
// ─────────────────────────────────────────────────────────────────────────────

export const CAMPI_TESTO = [
  'job_activity', 'sport_details', 'pain_location', 'pain_onset', 'pain_type',
  'medications_details', 'diagnostics_details', 'traumas_surgeries',
  'vision_details', 'hearing_details', 'headaches_details', 'bruxism_details',
  'cardiovascular_details', 'gastrointestinal_details',
  'urological_issues', 'gynecological_info', 'obstetric_history',
  'red_flags_details', 'notes',
];

export const CAMPI_SI_NO = [
  'sedentary', 'does_sport', 'takes_medications', 'recent_diagnostics',
  'vision_issues', 'hearing_issues', 'headaches', 'bruxism',
  'has_cardiovascular_issues', 'has_gastrointestinal_issues', 'red_flags',
];

export const LUNGHEZZA_MAX = 4000;

// Ritorna { ok:true, campi } oppure { ok:false, errore, campi_rifiutati? }.
export function validaModifica(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, errore: 'Richiesta non valida.' };
  const chiavi = Object.keys(body);
  if (!chiavi.length) return { ok: false, errore: 'Nessun campo da modificare.' };

  const rifiutati = chiavi.filter(k => !CAMPI_TESTO.includes(k) && !CAMPI_SI_NO.includes(k));
  if (rifiutati.length) {
    const livello = rifiutati.some(k => ['level', 'computed_level', 'level_status'].includes(k));
    const prevenzione = rifiutati.includes('prevention_eligible');
    return {
      ok: false,
      campi_rifiutati: rifiutati,
      errore: `Dalla cartella si modifica solo l'anamnesi. Campi non modificabili: ${rifiutati.join(', ')}.`
        + (livello ? ' Il livello si cambia con «Riclassifica».' : '')
        + (prevenzione ? ' Il diritto alla prevenzione è fissato a inizio anno e non si modifica dalla cartella.' : ''),
    };
  }

  const campi = {};
  for (const k of chiavi) {
    const v = body[k];
    if (CAMPI_SI_NO.includes(k)) {
      if (typeof v !== 'boolean') return { ok: false, errore: `Il campo ${k} vuole sì o no.` };
      campi[k] = v;
    } else {
      if (v !== null && typeof v !== 'string') return { ok: false, errore: `Il campo ${k} vuole un testo.` };
      const t = v == null ? '' : v.trim();
      if (t.length > LUNGHEZZA_MAX) return { ok: false, errore: `Il campo ${k} è troppo lungo.` };
      campi[k] = t || null;
    }
  }
  return { ok: true, campi };
}
