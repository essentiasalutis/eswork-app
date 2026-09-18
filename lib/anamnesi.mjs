// ─────────────────────────────────────────────────────────────────────────────
// ANAMNESI — l'originale firmato non si riscrive. Modulo PURO (.mjs, testato).
//
// Fino al 18/9 «Modifica anamnesi» sovrascriveva il documento firmato (contenuto
// e data della firma) e l'esportazione mostrava il testo nuovo sotto la firma del
// paziente. Decisione di Enrico (18/9): la firma prova cosa ha dichiarato il
// paziente, le integrazioni provano cosa ha aggiunto il professionista, e le due
// cose non si mescolano mai. Le modifiche sono integrazioni (v71, tabella
// anamnesi_integrazioni), mai riscritture dell'originale.
// ─────────────────────────────────────────────────────────────────────────────

export const MESSAGGIO_BLOCCO_ANAMNESI = 'L\'anamnesi firmata dal paziente non si può riscrivere: la firma copre quel testo. '
  + 'Le modifiche si registrano come integrazioni, con data e motivo, dal pulsante «Integra anamnesi».';

// Un'anamnesi c'è già (compilata o firmata): da qui in avanti non si sovrascrive.
export function anamnesiGiaCompilata(docs) {
  return (docs || []).some(d => d && d.type === 'anamnesi' && (d.status === 'completed' || d.status === 'signed'));
}

// ─── I campi dell'anamnesi — un solo elenco per cartella, modulo ed esportazione ──
// L'esportazione leggeva campi di un modulo vecchio (patologie_pregresse,
// motivo_consultazione…) e mostrava quasi nulla dell'anamnesi vera (18/9).
export const SEZIONI_ANAMNESI = [
  { titolo: 'Dati paziente', campi: [
    ['first_name', 'Nome', 'testo'], ['last_name', 'Cognome', 'testo'], ['age', 'Età', 'testo'], ['gender', 'Sesso biologico', 'scelta'],
  ] },
  { titolo: 'Attività lavorativa', campi: [
    ['job_activity', 'Mansione / attività svolta', 'testo'], ['sedentary', 'Lavoro prevalentemente sedentario', 'si_no'],
    ['does_sport', 'Pratica sport', 'si_no'], ['sport_details', 'Quale sport / frequenza', 'testo'],
  ] },
  { titolo: 'Sintomatologia attuale', campi: [
    ['pain_location', 'Zona / sede del dolore', 'testo'], ['durata', 'Insorgenza', 'scelta'], ['pain_type', 'Tipo di dolore', 'testo'],
    ['pain_onset', 'Modalità di insorgenza', 'testo'], ['nrs', 'Intensità del dolore (NRS 0–10)', 'numero'],
    ['fattori_peggio', 'Fattori aggravanti', 'testo'], ['fattori_meglio', 'Fattori allevianti', 'testo'],
  ] },
  { titolo: 'Farmaci ed esami', campi: [
    ['takes_medications', 'Terapia farmacologica in corso', 'si_no'], ['medications_details', 'Farmaci (quali)', 'testo'],
    ['recent_diagnostics', 'Esami diagnostici recenti', 'si_no'], ['diagnostics_details', 'Esami (quali/quando)', 'testo'],
    ['traumas_surgeries', 'Traumi, fratture, interventi chirurgici', 'testo'],
  ] },
  { titolo: 'Anamnesi sistemica', campi: [
    ['vision_issues', 'Problemi visivi', 'si_no'], ['vision_details', 'Problemi visivi — dettagli', 'testo'],
    ['hearing_issues', 'Problemi uditivi', 'si_no'], ['hearing_details', 'Problemi uditivi — dettagli', 'testo'],
    ['headaches', 'Cefalee / emicranie', 'si_no'], ['headaches_details', 'Cefalee — dettagli', 'testo'],
    ['bruxism', 'Bruxismo / serramento', 'si_no'], ['bruxism_details', 'Bruxismo — dettagli', 'testo'],
    ['has_cardiovascular_issues', 'Problemi cardiovascolari', 'si_no'], ['cardiovascular_details', 'Problemi cardiovascolari — dettagli', 'testo'],
    ['has_gastrointestinal_issues', 'Problemi gastrointestinali', 'si_no'], ['gastrointestinal_details', 'Problemi gastrointestinali — dettagli', 'testo'],
    ['urological_issues', 'Problemi urologici', 'testo'], ['gynecological_info', 'Problemi urologici / ginecologici', 'testo'],
    ['obstetric_history', 'Gravidanze / parti / cesarei', 'testo'],
    ['red_flags', 'Red flags presenti', 'si_no'], ['red_flags_details', 'Red flags — dettagli', 'testo'],
    ['notes', 'Note anamnestiche generali', 'testo'],
  ] },
  { titolo: 'Note del professionista', campi: [['pro_notes', 'Note cliniche del professionista', 'testo']] },
].map(s => ({ ...s, campi: s.campi.map(([campo, etichetta, tipo]) => ({ campo, etichetta, tipo })) }));

export const CAMPI_ANAMNESI = Object.fromEntries(SEZIONI_ANAMNESI.flatMap(s => s.campi).map(c => [c.campo, c]));

const SCELTE = {
  gender: { M: 'Maschile', F: 'Femminile', altro: 'Altro / Non specificato' },
  durata: { '<1m': 'Meno di 1 mese', '1-3m': '1–3 mesi', '3-6m': '3–6 mesi', '6-12m': '6–12 mesi', '>12m': 'Più di 12 mesi' },
};

const vuoto = v => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

// Il valore come lo legge una persona.
export function valoreLeggibile(campo, v) {
  if (vuoto(v)) return '—';
  const c = CAMPI_ANAMNESI[campo];
  if (c?.tipo === 'si_no') return v ? 'Sì' : 'No';
  if (c?.tipo === 'numero') return `${v}/10`;
  if (SCELTE[campo]) return SCELTE[campo][v] || String(v);
  return String(v);
}

// L'originale del documento: i campi del modulo più le note del professionista.
export function originaleDaDocumento(doc) {
  if (!doc) return null;
  return { ...(doc.form_data || {}), pro_notes: doc.pro_notes ?? '' };
}

// Versione corrente = originale + integrazioni in ordine di tempo.
// storia[campo] = le integrazioni di quel campo, dalla più vecchia.
export function versioneCorrente(originale, integrazioni) {
  const valori = { ...(originale || {}) };
  const storia = {};
  const ordinate = (integrazioni || []).slice().sort((a, b) => String(a.creato_il).localeCompare(String(b.creato_il)));
  for (const r of ordinate) {
    valori[r.campo] = r.valore_dopo;
    (storia[r.campo] ||= []).push(r);
  }
  return { valori, storia, integrazioni: ordinate };
}

export const MOTIVO_MIN = 3, MOTIVO_MAX = 200, TESTO_MAX = 4000;

const normalizza = (c, v) => {
  if (c.tipo === 'si_no') return !!v;
  if (vuoto(v)) return '';
  return c.tipo === 'numero' ? Number(v) : String(v).trim();
};

// Confronta i valori proposti con la versione corrente. Ritorna
// { ok:true, righe:[{campo, valore_prima, valore_dopo}], motivo } oppure { ok:false, errore }.
// Un campo non dell'anamnesi non si ignora: si rifiuta e si dice quale.
export function validaIntegrazione(corrente, proposti, motivo) {
  const m = typeof motivo === 'string' ? motivo.trim() : '';
  if (m.length < MOTIVO_MIN || m.length > MOTIVO_MAX) {
    return { ok: false, errore: `Il motivo è obbligatorio: una riga breve (da ${MOTIVO_MIN} a ${MOTIVO_MAX} caratteri).` };
  }
  if (!proposti || typeof proposti !== 'object' || Array.isArray(proposti)) return { ok: false, errore: 'Richiesta non valida.' };
  const estranei = Object.keys(proposti).filter(k => !CAMPI_ANAMNESI[k]);
  if (estranei.length) return { ok: false, errore: `Campi che non fanno parte dell'anamnesi: ${estranei.join(', ')}.` };

  const righe = [];
  for (const [campo, v] of Object.entries(proposti)) {
    const c = CAMPI_ANAMNESI[campo];
    if (c.tipo === 'si_no' && typeof v !== 'boolean') return { ok: false, errore: `«${c.etichetta}» vuole sì o no.` };
    if (c.tipo === 'numero' && !vuoto(v) && !(Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 10)) return { ok: false, errore: `«${c.etichetta}» vuole un numero da 0 a 10.` };
    // I campi di testo ammettono anche numeri: l'età arriva dal modulo come numero (48).
    if ((c.tipo === 'testo' || c.tipo === 'scelta') && v !== null && typeof v !== 'string' && typeof v !== 'number') return { ok: false, errore: `«${c.etichetta}» vuole un testo.` };
    if (typeof v === 'string' && v.length > TESTO_MAX) return { ok: false, errore: `«${c.etichetta}» supera ${TESTO_MAX} caratteri.` };
    const dopo = normalizza(c, v);
    const prima = normalizza(c, corrente?.[campo]);
    if (dopo === prima) continue;
    righe.push({ campo, valore_prima: corrente?.[campo] ?? null, valore_dopo: dopo });
  }
  if (!righe.length) return { ok: false, errore: 'Nessuna modifica rispetto alla versione corrente.' };
  return { ok: true, righe, motivo: m };
}

// Svuotato = il valore dopo l'integrazione è vuoto (per i sì/no: mai).
export const svuotato = r => vuoto(r?.valore_dopo);

// Chi ha scritto l'originale di quel campo: il paziente, tranne le note del
// professionista (le scrive l'osteopata anche nell'originale).
export const autoreOriginale = campo => (campo === 'pro_notes' ? "Nell'originale firmato" : "Scritto dal paziente nell'originale firmato");
