// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — alias del contratto pricing v1 (lib/pricing/v1.js, CONGELATO).
// I valori sono deep-frozen: qualunque tentativo di modifica a runtime lancia.
// NON aggiungere/modificare costanti di pricing qui: le evoluzioni del modello
// vanno in lib/pricing/v2.js (+ override admin in pricing_settings, Blocco B).
// Le costanti non di pricing (k_anon_min, retention, contatti, soglie NMQ)
// restano lette da qui dagli altri moduli: valgono per entrambe le versioni.
// ─────────────────────────────────────────────────────────────────────────────
export { CONFIG_V1 as CONFIG } from './pricing/v1';
