export const CONFIG = {
  // ─── Stratificazione: prevalenze L1 per settore (min / medio / max) ─────────
  l1_prevalence: {
    services:      [0.07, 0.12, 0.18],   // Servizi / IT / uffici
    manufacturing: [0.10, 0.15, 0.20],   // Manifattura
    mix:           [0.08, 0.13, 0.19],   // Mix
  },
  // L2 attesi (default) = moltiplicatore × L1 atteso del settore — DA TARARE sui dati reali
  l2_multiplier_default: 2,

  // ─── Protocollo clinico (sedute) ────────────────────────────────────────────
  sessions_per_l1: 4,              // sedute trattamento per L1 (1° ciclo; il 2° è coperto dal buffer)
  prevention_sessions_per_l2: 4,   // sessioni di prevenzione attiva per L2 (solo Plus/Enterprise)
  session_duration_min: 30,        // durata seduta sportello (minuti)
  hours_per_day: 7,                // ore sportello per giornata (per stima giornate)

  // ─── Formazione ───────────────────────────────────────────────────────────
  classroom_capacity_default: 25,  // capienza aula (modificabile)
  training_modules_y1: 2,          // moduli formativi Anno 1
  training_modules_y2: 1,          // moduli formativi Anno 2+
  training_module_hours: 1,        // durata erogata per modulo (ore)

  // ─── Buffer ─────────────────────────────────────────────────────────────────
  buffer_pct: 0.20,                // 20% sul totale (copre L2→L1, self-trigger, urgenze, 2° ciclo)

  // ─── Tariffe (venduto / costo professionista) — default NUOVI clienti ───────
  rates_new: {
    sportello_sell: 120, sportello_cost: 60,        // €/ora
    prevalidation_sell: 30, prevalidation_cost: 15, // € a pre-validazione (15 min)
    training_sell: 250, training_cost: 100,         // € a modulo (1h)
  },
  // Override per clienti STORICI
  rates_legacy: {
    sportello_sell: 100, sportello_cost: 50,
    prevalidation_sell: 30, prevalidation_cost: 15,
    training_sell: 200, training_cost: 100,
  },

  // ─── Fiscale / temporale ─────────────────────────────────────────────────────
  vat_exempt: true,                // regime forfettario (esente IVA) — configurabile
  vat_pct: 0.22,
  delivery_months: 10,             // mesi di erogazione effettiva
  contract_months: 12,             // offerta annuale spalmata su 12 mesi

  // ─── Tier interno (uso interno; mai esposto al cliente) ─────────────────────
  tier_core_max: 150,              // Core: ~20-150
  tier_plus_max: 500,              // Plus: ~150-500 · Enterprise: >500

  // ─── ROI ──────────────────────────────────────────────────────────────────
  cost_per_absence_day: 160,

  // ─── Soglie semaforo NMQ (% Livello 1) ──────────────────────────────────────
  nmq_green_max: 20,
  nmq_yellow_max: 40,

  // ─── Contatti (footer/offerta) ───────────────────────────────────────────────
  company_name: 'Essentia Salutis',
  company_address: 'Via Salbertrand 9, Torino',
  contact_phone: '327 102 7443',
  contact_email: 'info@essentiasalutis.it',
  contact_website: 'www.essentiasalutis.it',
};
