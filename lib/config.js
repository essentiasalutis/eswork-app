export const CONFIG = {
  // ─── Protocollo clinico ───────────────────────────────────────────────────
  sessions_intensive: 5,        // sessioni osteo primi 2 mesi (3+2)
  sessions_maintenance: 5,      // sessioni osteo mesi 3-10 (1 ogni 6 settimane)
  sessions_prevention_y2: 5,    // Anno 2+: sessioni per persona L2 — 5 visite nei 10 mesi attivi (esclusi agosto/dicembre)
  sessions_maintenance_y2: 6,   // Anno 2+: sessioni per ex-L1 (1 ogni 2 mesi)
  session_duration_min: 30,     // minuti per sessione osteopatica
  slots_per_day: 14,            // sessioni per giornata (7h / 30min)
  hours_per_day: 7,             // ore lavorate per giornata (7h)
  completion_rate: 0.75,        // tasso completamento atteso
  training_topics_y1: 2,        // moduli formativi Anno 1 (2 postura/ergonomia)
  training_topics_y2: 2,        // moduli formativi Anno 2+ (1 postura + 1 complementare)
  max_group_size: 15,           // max dipendenti per gruppo formazione

  // ─── Costi ────────────────────────────────────────────────────────────────
  hourly_rate: 60,              // €/ora professionista
  training_hours_paid: 3,       // 1h erogazione + 2h prep per modulo
  cost_initial_assessment: 300, // assessment pre-contratto + report attivazione
  cost_final_assessment: 200,   // assessment finale + report annuale
  cost_review: 400,             // review checkpoint o semestrale
  cost_annual_report: 600,

  // ─── Margini ──────────────────────────────────────────────────────────────
  margin_y1: 0.43,
  margin_y2: 0.48,

  // ─── ROI ──────────────────────────────────────────────────────────────────
  cost_per_absence_day: 160,    // stima €/giorno assenza

  // ─── Soglie semaforo NMQ (basate su % Livello 1) ─────────────────────────
  nmq_green_max: 20,
  nmq_yellow_max: 40,

  // ─── Contatti (per offerta grafica e footer) ───────────────────────────────
  company_name: 'Essentia Salutis',
  company_address: 'Via Salbertrand 9, Torino',
  contact_phone: '327 102 7443',
  contact_email: 'info@essentiasalutis.it',
  contact_website: 'www.essentiasalutis.it',
};
