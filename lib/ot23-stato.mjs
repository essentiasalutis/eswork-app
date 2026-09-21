// ─────────────────────────────────────────────────────────────────────────────
// OT23 — stato della verifica con l'INAIL (decisione di Enrico, 21/9/2026).
// Il modulo OT23/2027 riconosce la prevenzione dei disturbi muscolo-scheletrici come
// intervento C-4.1 (tipo B), ma non dice se l'osteopatia vi rientri. Finché l'INAIL non
// risponde per iscritto, NESSUN documento promette l'OT23: niente percentuali né cifre
// di riduzione collegate al programma. Il testo qui sotto è di Enrico, parola per parola,
// e ogni punto della piattaforma che parla dell'OT23 al cliente legge da qui.
// ─────────────────────────────────────────────────────────────────────────────
export const TESTO_OT23_IN_VERIFICA = 'Il programma produce la documentazione degli interventi erogati — pianificazione, presenze, risultati — che l\'azienda può valutare di utilizzare per la domanda OT23. L\'ammissibilità è in corso di verifica con l\'INAIL, e la riduzione richiede comunque più di un intervento.';

// ─── Voce del Listino «Documentazione OT23 INAIL» (tabella servizi_deliverable) ───
// Enrico, 21/9: valore a 0 e voce sospesa. Si riattiva SOLO quando valgono entrambe
// le condizioni qui sotto, e cambiarle richiede un rilascio, non un clic nel Listino.
// Finché non valgono, la piattaforma legge la voce a 0 anche se in banca dati c'è altro
// (modifica a mano in Supabase) e rifiuta di scriverla diversa da 0.
// Quando l'INAIL risponde per iscritto: { data: 'AAAA-MM-GG', riferimento: 'n. della richiesta', esito: 'positiva' }.
export const RISPOSTA_INAIL_C41 = null;
// Diventa true nel rilascio che porta il dossier OT23.
export const DOSSIER_OT23_COSTRUITO = false;
export const ID_VOCI_OT23 = Object.freeze(['sd_ot23_core', 'sd_ot23_plus', 'sd_ot23_ent']);
export const MOTIVO_SOSPENSIONE_OT23 = 'Riattivabile quando: risposta INAIL positiva (C-4.1) · dossier OT23 costruito.';

export function condizioniVoceOT23({ risposta = RISPOSTA_INAIL_C41, dossier = DOSSIER_OT23_COSTRUITO } = {}) {
  const mancanti = [];
  const r = risposta;
  const rispostaValida = !!r && r.esito === 'positiva' && /^\d{4}-\d{2}-\d{2}$/.test(String(r.data || '')) && String(r.riferimento || '').trim() !== '';
  if (!rispostaValida) mancanti.push('la risposta scritta positiva dell\'INAIL sull\'intervento C-4.1');
  if (dossier !== true) mancanti.push('il dossier OT23');
  return { attiva: mancanti.length === 0, mancanti };
}

// Lettura: finché la voce è sospesa vale 0, qualunque cosa ci sia in banca dati.
export function vociListinoConSospensione(righe, stato = condizioniVoceOT23()) {
  if (stato.attiva) return righe;
  return righe.map(r => {
    if (!ID_VOCI_OT23.includes(r.id)) return r;
    const inBancaDati = Number(r.valore_dichiarato) || 0;
    return {
      ...r, valore_dichiarato: 0, sospesa: true, motivo_sospensione: MOTIVO_SOSPENSIONE_OT23,
      ...(inBancaDati !== 0 ? { valore_in_banca_dati: r.valore_dichiarato } : {}),
    };
  });
}

// Scrittura: finché la voce è sospesa accetta solo 0. Restituisce il motivo del rifiuto, o null.
export function rifiutoScritturaOT23(id, campi = {}, stato = condizioniVoceOT23()) {
  if (stato.attiva || !ID_VOCI_OT23.includes(id)) return null;
  if (campi.valore_dichiarato !== undefined && Number(campi.valore_dichiarato) !== 0) {
    return `Voce sospesa: il valore resta 0 finché mancano ${stato.mancanti.join(' e ')}.`;
  }
  return null;
}
