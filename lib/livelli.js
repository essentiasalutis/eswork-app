// ─────────────────────────────────────────────────────────────────────────────
// LEGENDA dei livelli — fonte unica del significato di Livello 1, 2, 3 e della
// pre-validazione, per i documenti del cliente e per le schermate interne.
//
// Perché esiste (Enrico, 12/9): nella Stima si legge «~12% in Livello 1» e nel
// dettaglio voci «Prevenzione attiva L2» senza che da nessuna parte sia scritto
// cosa siano. Una legenda sola, uguale ovunque, invece di spiegazioni sparse che
// col tempo divergono.
//
// I numeri (trattamenti, durata, trattamenti di prevenzione) arrivano dal Listino: se là
// cambiano, cambia anche la legenda. Nessun numero scritto a mano nei testi.
// ─────────────────────────────────────────────────────────────────────────────
import { DEFAULTS_V2 } from './pricing/v2';
import { conProtocollo, PROTOCOLLO, durataInMesi } from './protocollo.mjs';

const MINUTI_PREVALIDAZIONE = 15;   // durata del colloquio di pre-validazione

// ─── I NOMI dei tre livelli — fonte unica ────────────────────────────────────
// Trattamento · Prevenzione · Formazione, come nel modello e in tutti i materiali.
// Fino al 13/9 in piattaforma giravano nomi sfalsati (L2 «Monitoraggio», L3
// «Prevenzione»): chi stava in Livello 3 leggeva il nome del Livello 2, e i nomi
// si scambiavano di posto rispetto a quello che raccontiamo ai clienti.
// Da qui in avanti si scrivono da un posto solo.
export const NOME_LIVELLO = {
  level1: 'Trattamento',
  level2: 'Prevenzione',
  level3: 'Formazione',
};
export const nomeLivello = (l) => NOME_LIVELLO[l] || '';
// Forma estesa: «Livello 2 — Prevenzione».
export const etichettaLivello = (l) => {
  const n = { level1: 1, level2: 2, level3: 3 }[l];
  return n ? `Livello ${n} — ${NOME_LIVELLO[l]}` : '';
};

// ─── Le carte dei livelli nei documenti del cliente — fonte unica (27/9) ─────
// Presentazione, Sintesi e Offerta dicevano ciascuna la sua («Trattamento — Anno 1»,
// «Solo formazione», «cicli clinici»…): stesso nome, stessa descrizione, stessa azione
// ovunque («deve essere tutto unico tra presentazione e preventivo», Enrico).
export const CARTE_LIVELLO = {
  l1: { nome: 'Livello 1', desc: 'Dolore con impatto funzionale', azione: 'Cicli clinici', color: '#dc2626', bg: '#fef2f2' },
  l2: { nome: 'Livello 2', desc: 'Segnali senza impatto', azione: 'Prevenzione', color: '#ca8a04', bg: '#fffbeb' },
  l3: { nome: 'Livello 3', desc: 'Nessun disturbo in atto', azione: 'Formazione per tutti', color: '#16a34a', bg: '#f0fdf4' },
};
// Sul listino v2 la prevenzione del Livello 2 parte dal primo anno (voce 5 di Enrico).
export const azioneLivello = (k, { nuovoProgramma = false } = {}) =>
  (k === 'l2' && nuovoProgramma ? 'Prevenzione dal primo anno' : CARTE_LIVELLO[k].azione);

export function legendaLivelli(v2Params) {
  const p = conProtocollo({ ...DEFAULTS_V2, ...(v2Params || {}) });
  return [
    {
      titolo: 'Livello 1 — trattamento',
      // Lessico (Enrico, 27/9): gli osteopati fanno «trattamenti», non «sedute»; il ciclo
      // si completa entro 60 giorni dalla presa in carico (PROTOCOLLO).
      testo: `Chi ha un disturbo in corso che limita l'attività. Ciclo di ${p.sessions_per_l1} trattamenti da ${p.session_duration_min} minuti con l'osteopata, in sede, entro ${durataInMesi(PROTOCOLLO.durata_max_ciclo_giorni)} dalla presa in carico.`,
    },
    {
      titolo: 'Livello 2 — prevenzione attiva',
      testo: `Chi ha un disturbo in corso che non lo limita ancora, individuato dai dati del check-up. L'osteopata apre il percorso dalla cartella della persona: ${p.prevention_sessions_per_l2} trattamenti di prevenzione nell'anno con l'osteopata, in sede.`,
    },
    {
      titolo: 'Livello 3 — formazione',
      testo: 'Chi non riferisce disturbi recenti. Formazione collettiva ed ergonomia della postazione, per restare così.',
    },
    {
      titolo: 'Pre-validazione',
      testo: `Prima di aprire un percorso di trattamento, un colloquio clinico di ${MINUTI_PREVALIDAZIONE} minuti con l'osteopata conferma che la persona sia davvero in Livello 1. Se non lo è, il percorso non parte: è il filtro che manda i trattamenti a chi ne ha bisogno.`,
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
