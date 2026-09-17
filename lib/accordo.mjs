// ─────────────────────────────────────────────────────────────────────────────
// ACCORDO SUL TRATTAMENTO DEI DATI DEL PROFESSIONISTA (punto c) — regola pura.
//
// Decisioni di Enrico (17/9):
//   · servono la SPUNTA (del professionista: prova l'atto) e il FILE firmato
//     (prova il contenuto), sulla stessa versione dell'archivio;
//   · il requisito vale da subito: senza testo pubblicato nessuno è conforme;
//   · nuova versione: chi aveva sottoscritto la precedente resta conforme per
//     7 giorni dal ritiro (preavviso), poi deve risottoscrivere.
// ─────────────────────────────────────────────────────────────────────────────

export const CODICE_ACCORDO = 'accordo_trattamento_dati';
export const CONSENSO_ACCORDO = 'accordo';
export const GIORNI_PREAVVISO = 7;
export const ETICHETTA_ACCORDO = 'Accordo sul trattamento dei dati';

const ms = (v) => { const t = v ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : null; };

// La spunta vale se l'ultima riga del registro per quella versione è «dato».
function spuntaSu(firme, testoId) {
  const righe = (firme || []).filter(f => f.testo_legale_id === testoId).sort((a, b) => (ms(a.atto_at) || 0) - (ms(b.atto_at) || 0));
  return righe.length > 0 && righe[righe.length - 1].valore === 'dato';
}
const fileSu = (file, testoId) => (file || []).some(f => f.testo_legale_id === testoId);

// versioni: righe di testi_legali dell'accordo (id, versione, stato, pubblicato_il, ritirato_il)
// firme:    righe di consensi_registrati del professionista (testo_legale_id, valore, atto_at)
// file:     righe di accordi_trattamento_file del professionista (testo_legale_id, caricato_il)
export function statoAccordo({ versioni = [], firme = [], file = [], adesso = new Date() } = {}) {
  const vigente = versioni.find(v => v.stato === 'in_vigore');
  if (!vigente) {
    return { stato: 'testo_non_pubblicato', conforme: false, motivo: `${ETICHETTA_ACCORDO} (testo non ancora pubblicato)` };
  }
  const spunta = spuntaSu(firme, vigente.id);
  const copia = fileSu(file, vigente.id);
  if (spunta && copia) return { stato: 'valido', conforme: true, versione: vigente.versione, testoId: vigente.id };

  // Preavviso: accordo completo su una versione ritirata da meno di 7 giorni.
  const t = adesso.getTime();
  const precedente = versioni
    .filter(v => v.stato === 'ritirata' && ms(v.ritirato_il) != null && t < ms(v.ritirato_il) + GIORNI_PREAVVISO * 86400000)
    .find(v => spuntaSu(firme, v.id) && fileSu(file, v.id));
  if (precedente) {
    return {
      stato: 'in_preavviso', conforme: true,
      versione: vigente.versione, testoId: vigente.id, versionePrecedente: precedente.versione,
      scadenza: new Date(ms(precedente.ritirato_il) + GIORNI_PREAVVISO * 86400000).toISOString(),
      mancaSpunta: !spunta, mancaFile: !copia,
    };
  }

  const cosa = !spunta && !copia ? 'manca la sottoscrizione e la copia firmata'
    : !spunta ? 'manca la sottoscrizione' : 'manca la copia firmata';
  return {
    stato: 'mancante', conforme: false, versione: vigente.versione, testoId: vigente.id,
    mancaSpunta: !spunta, mancaFile: !copia,
    motivo: `${ETICHETTA_ACCORDO} (versione ${vigente.versione}: ${cosa})`,
  };
}

// Quello che dell'esito può andare al browser del professionista: niente percorsi
// dei file, e chi ha caricato detto per ruolo.
export function statoPerIlBrowser(s) {
  if (!s) return null;
  return {
    stato: s.stato, conforme: s.conforme, versione: s.versione || null, versionePrecedente: s.versionePrecedente || null,
    scadenza: s.scadenza || null, motivo: s.motivo || null, mancaSpunta: !!s.mancaSpunta, mancaFile: !!s.mancaFile,
    firme: (s.firme || []).map(f => ({ testo_legale_id: f.testo_legale_id, valore: f.valore, atto_at: f.atto_at })),
    file: (s.file || []).map(f => ({ id: f.id, versione: f.versione, caricato_il: f.caricato_il, caricato_da: String(f.caricato_da || '').startsWith('admin:') ? 'amministratore' : 'professionista' })),
  };
}
