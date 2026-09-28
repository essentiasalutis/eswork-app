// ─────────────────────────────────────────────────────────────────────────────
// Riassunti del Report di Attivazione per la presentazione (Enrico, 28/9). Modulo PURO.
//
// La presentazione nasce dal Report e ne riassume le voci. I riassunti li scrive l'AI
// nella STESSA chiamata del Report (stessi dati, niente in più verso l'esterno), dopo
// una riga separatrice, e passano lo stesso controllo automatico del testo. Si salvano
// accanto al Report (generated_reports.presentazione, v81).
// ─────────────────────────────────────────────────────────────────────────────

export const SEPARATORE_PRESENTAZIONE = '===PRESENTAZIONE===';

// Una voce per sezione del Report, nell'ordine delle slide.
export const VOCI_PRESENTAZIONE = Object.freeze([
  { chiave: 'executive', sezione: 'Executive Summary' },
  { chiave: 'mappa', sezione: 'Mappa Clinica della Popolazione' },
  { chiave: 'piano', sezione: 'Piano Operativo Proposto' },
  { chiave: 'raccomandazioni', sezione: 'Raccomandazioni' },
]);

const MAX_FRASI = 4;
const MAX_CARATTERI = 320;

// Le istruzioni che si aggiungono al prompt del Report.
export function istruzioniPresentazione() {
  const esempio = `{${VOCI_PRESENTAZIONE.map(v => `"${v.chiave}": ["…", "…"]`).join(', ')}}`;
  return `PRESENTAZIONE (tassativo): dopo l'ultima sezione del report scrivi, su una riga da sola, ${SEPARATORE_PRESENTAZIONE} e subito sotto SOLO un oggetto JSON con i riassunti per le slide con cui il report viene presentato all'azienda:
${esempio}
- ${VOCI_PRESENTAZIONE.map(v => `${v.chiave} = sezione «${v.sezione}»`).join('; ')}.
- Da 2 a 3 frasi per voce, ciascuna di al massimo 20 parole: riassumono la sezione con le sue parole e i suoi numeri, senza aggiungere nulla che non sia nel report.
- Niente cifre in euro: l'investimento si presenta a parte, con la proposta di intervento.
- Valgono tutte le regole date sopra (numeri, lessico, livelli insieme per riservatezza, niente paragoni, niente promesse di risultato). I riassunti non contano nelle parole del report.`;
}

// Nella richiesta di correzione: i riassunti vanno riscritti insieme al report.
export const CORREZIONE_PRESENTAZIONE = `Riscrivi anche i riassunti dopo ${SEPARATORE_PRESENTAZIONE}, nella stessa forma JSON, con le stesse correzioni.`;

// Riassunti ben formati, o null: ogni voce 1–4 frasi di testo, niente markup.
export function riassuntiValidi(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const out = {};
  for (const { chiave } of VOCI_PRESENTAZIONE) {
    const v = obj[chiave];
    if (!Array.isArray(v)) return null;
    const frasi = v.map(x => (typeof x === 'string' ? x.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim() : ''))
      .filter(Boolean);
    if (!frasi.length || frasi.length > MAX_FRASI || frasi.some(f => f.length > MAX_CARATTERI)) return null;
    out[chiave] = frasi;
  }
  return out;
}

// Separa il report dai riassunti. Senza separatore, o con un JSON non leggibile, il
// report resta intero e i riassunti sono null: la presentazione chiederà di rigenerarlo.
export function separaPresentazione(testo) {
  const t = String(testo || '');
  const i = t.indexOf(SEPARATORE_PRESENTAZIONE);
  if (i < 0) return { report: t, presentazione: null };
  const report = t.slice(0, i).replace(/\s+$/, '');
  const coda = t.slice(i + SEPARATORE_PRESENTAZIONE.length).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  let obj = null;
  try { obj = JSON.parse(coda); } catch (_) { obj = null; }
  return { report, presentazione: riassuntiValidi(obj) };
}
