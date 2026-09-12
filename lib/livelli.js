// ─────────────────────────────────────────────────────────────────────────────
// LEGENDA dei livelli — fonte unica del significato di Livello 1, 2, 3 e della
// pre-validazione, per i documenti del cliente e per le schermate interne.
//
// Perché esiste (Enrico, 12/9): nella Stima si legge «~12% in Livello 1» e nel
// dettaglio voci «Prevenzione attiva L2» senza che da nessuna parte sia scritto
// cosa siano. Una legenda sola, uguale ovunque, invece di spiegazioni sparse che
// col tempo divergono.
//
// I numeri (sedute, durata, sessioni di prevenzione) arrivano dal Listino: se là
// cambiano, cambia anche la legenda. Nessun numero scritto a mano nei testi.
// ─────────────────────────────────────────────────────────────────────────────
import { DEFAULTS_V2 } from './pricing/v2';

const MINUTI_PREVALIDAZIONE = 15;   // durata del colloquio di pre-validazione

export function legendaLivelli(v2Params) {
  const p = { ...DEFAULTS_V2, ...(v2Params || {}) };
  return [
    {
      titolo: 'Livello 1 — trattamento',
      testo: `Chi ha un disturbo in corso che limita l'attività. Percorso di ${p.sessions_per_l1} sedute da ${p.session_duration_min} minuti con l'osteopata, in sede.`,
    },
    {
      titolo: 'Livello 2 — prevenzione attiva',
      testo: `Chi ha un disturbo in corso che non lo limita ancora, individuato dai dati del check-up. L'osteopata apre il percorso dalla cartella della persona: ${p.prevention_sessions_per_l2} sedute di prevenzione con l'osteopata, in sede.`,
    },
    {
      titolo: 'Livello 3 — formazione',
      testo: 'Chi non riferisce disturbi recenti. Formazione collettiva ed ergonomia della postazione, per restare così.',
    },
    {
      titolo: 'Pre-validazione',
      testo: `Prima di aprire un percorso di trattamento, un colloquio clinico di ${MINUTI_PREVALIDAZIONE} minuti con l'osteopata conferma che la persona sia davvero in Livello 1. Se non lo è, il percorso non parte: è il filtro che manda le sedute a chi ne ha bisogno.`,
    },
  ];
}

// Blocco HTML per i documenti generati (Stima). Stile in linea: l'HTML diventa PDF
// in un browser senza foglio di stile esterno.
export function legendaHtml(v2Params) {
  const righe = legendaLivelli(v2Params).map(v => `
      <div style="margin-bottom:7px">
        <span style="font-weight:700;color:#1e293b">${v.titolo}.</span>
        <span style="color:#475569"> ${v.testo}</span>
      </div>`).join('');
  return `
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;font-size:11px;line-height:1.55;margin-top:14px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;font-weight:700;margin-bottom:9px">Come si leggono i livelli</div>
      ${righe}
    </div>`;
}
