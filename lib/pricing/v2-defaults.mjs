// Default dei fattori del Listino v2 — modulo PURO, importabile dai test.
// I quattro parametri del protocollo NON sono del listino: vengono da
// lib/protocollo.mjs e si applicano sempre (conProtocollo), qualunque override.
import { PROTOCOLLO } from '../protocollo.mjs';

// Default dei fattori v2 (= seed pricing_settings v38). Gli override admin
// arrivano dal DB via lib/pricing/settings (server-side) come `v2Params`.
export const DEFAULTS_V2 = Object.freeze({
  l2_multiplier: 2,
  sessions_per_l1: PROTOCOLLO.sedute_per_ciclo,                 // regola del protocollo (lib/protocollo.mjs)
  session_duration_min: PROTOCOLLO.durata_seduta_min,           // regola del protocollo
  prevention_sessions_per_l2: PROTOCOLLO.sessioni_prevenzione_l2, // regola del protocollo
  tariffa_sessione_prevenzione: 60,   // €/sessione prevenzione (tutte le configurazioni)
  buffer_pct: PROTOCOLLO.buffer_pct,  // regola del protocollo; SOLO su clinica (cicli L1 + prevenzione L2)
  capienza_aula: 25,
  training_modules_y1: PROTOCOLLO.formazione_moduli_primo_anno,      // regola del protocollo
  training_modules_y2: PROTOCOLLO.formazione_moduli_anni_successivi, // regola del protocollo
  // Ergonomia a 3 voci (decisione Enrico 2026-09-11):
  ergonomia_minuti_persona: 5,        // ufficio: minuti a persona × tariffa/h sportello
  ergonomia_minuti_addetto: 5,        // reparto: formazione dell'addetto sulla SUA postazione, minuti a persona
  ergonomia_forfait_postazione: 120,  // reparto: studio della postazione tipo, € a FORFAIT per postazione
  ergonomia_minuti_postazione: 60,    // reparto: tempo in sede dello studio — SOLO pianificazione e minimo ore, non prezzo
  ergonomia_minimo_ore: 4,            // mezza giornata: sotto → avviso, nessun blocco
  soglia_ingresso: 80,                   // NON PIÙ USATO dal 12/9: il pacchetto non ha un tetto di dipendenti
  // Quota «Programma, misurazione e regia» (Enrico, 21/9): check-up iniziale e di
  // controllo, i quattro report, la piattaforma e il coordinamento costano uguale che
  // l'azienda stia bene o male. Per anno di programma (anche il rinnovo). Parametro
  // COMMERCIALE, modificabile dal Listino. Nel Pacchetto vale solo la parte per
  // dipendente (sostituisce il vecchio «check-up €15/dipendente»).
  quota_programma_fissa: 1500,
  quota_programma_per_dipendente: 15,
  quota_programma_costo_pct: 0.30,     // costo della quota, per il margine nella vista admin
  // Prezzo applicato più basso del calcolato (Enrico, 21/9): sotto questa soglia di
  // margine, avviso e conferma. Scelta COMMERCIALE, modificabile. Il limite dello zero
  // (mai sotto il costo) NON è qui: vive in lib/sconto.mjs e non si sposta.
  sconto_margine_avviso_pct: 0.40,
});

// Stime già emesse (snapshot congelato prima del 21/9): i loro parametri non hanno la
// quota. Il motore riempirebbe il vuoto con i valori di base e il prezzo definitivo
// uscirebbe dalla forbice promessa. Regola: in una Stima congelata SENZA la quota,
// la quota vale zero. Solo per il programma completo (il Pacchetto non si ricalcola
// mai da uno snapshot: il suo prezzo è congelato in pacchetto_price).
export function parametriDaStimaCongelata(v2Params) {
  if (!v2Params || typeof v2Params !== 'object') return v2Params;
  if ('quota_programma_fissa' in v2Params || 'quota_programma_per_dipendente' in v2Params) return v2Params;
  return { ...v2Params, quota_programma_fissa: 0, quota_programma_per_dipendente: 0 };
}
