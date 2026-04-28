export const CONFIG = {
  // ─── Protocollo clinico ───────────────────────────────────────────────────
  sessions_intensive: 5,        // sessioni osteo primi 2 mesi (per persona L1)
  sessions_maintenance: 5,      // sessioni osteo mesi 3-10 (per persona L1)
  sessions_prevention_y2: 4,    // Anno 2+: sessioni per persona L2
  sessions_maintenance_y2: 7,   // Anno 2+: sessioni per ex-L1
  session_duration_min: 30,     // minuti per sessione osteopatica
  slots_per_day: 16,            // sessioni per giornata (8h / 30min)
  completion_rate: 0.75,        // tasso completamento atteso
  training_topics_y1: 3,        // moduli formativi Anno 1
  training_topics_y2: 4,        // moduli formativi Anno 2+
  max_group_size: 15,           // max dipendenti per gruppo formazione

  // ─── Costi ────────────────────────────────────────────────────────────────
  hourly_rate: 60,              // €/ora professionista
  hours_per_day: 8,
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

  // ─── Contatti (per offerta grafica) ───────────────────────────────────────
  company_name: 'Essentia Salutis',
  contact_phone: '',
  contact_email: '',
  contact_website: '',
};
