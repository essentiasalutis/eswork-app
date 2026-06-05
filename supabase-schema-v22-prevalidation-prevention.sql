-- ES Work — Schema v22
-- Esiti pre-validazione a 3 vie + prevenzione L2 per tier (BLOCCO D).

-- 1) Pre-validazione: esiti espliciti.
--    l1_confirmed → apre ciclo · reclassified_l2 → consulenza breve, level2
--    reclassified_l3 → resta L3 · needs_more_info → stato intermedio
--    ('not_l1' mantenuto per i record storici, non distruttivo)
ALTER TABLE public.pre_validations DROP CONSTRAINT IF EXISTS pre_validations_outcome_check;
ALTER TABLE public.pre_validations ADD CONSTRAINT pre_validations_outcome_check
  CHECK (outcome IN ('l1_confirmed','reclassified_l2','reclassified_l3','needs_more_info','not_l1'));

-- 2) Distinzione ciclo di PREVENZIONE (L2) dal ciclo di TRATTAMENTO (L1).
ALTER TABLE public.treatment_cycles ADD COLUMN IF NOT EXISTS cycle_type TEXT NOT NULL DEFAULT 'treatment'
  CHECK (cycle_type IN ('treatment','prevention'));

-- 3) Diritto alla prevenzione attiva fissato a inizio anno (regola "opzione A").
--    TRUE solo se il livello di inizio anno (assessment iniziale / re-assessment
--    anno precedente) è L2. Chi diventa L2 in corso d'anno via self-trigger NON
--    riceve la prevenzione attiva quest'anno (resta false).
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS prevention_eligible BOOLEAN NOT NULL DEFAULT FALSE;
