/**
 * ES Work — Backup Supabase → GitHub repository
 * Esporta tutte le tabelle in JSON nella cartella backups/.
 * Il commit/push viene fatto dal workflow GitHub Actions (con git add -f,
 * perché backups/ è in .gitignore). Eseguito ogni domenica alle 02:00.
 *
 * NB: il file contiene dati clinici/personali dei pazienti → il repository
 * DEVE restare privato.
 */

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function main() {
  console.log('🔄 ES Work Backup — avvio...');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Variabili Supabase mancanti');
  }

  // ── 1. Connessione Supabase ──────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    global: { fetch },
    realtime: { transport: ws },
  });

  // ── 2. Export di tutte le tabelle ───────────────────────────────────────────
  // Tutte le tabelle del modello v4. Una tabella inesistente viene solo segnalata
  // (warning) e saltata, quindi la lista può essere conservativa.
  const TABLES = [
    'clients',
    'assessments',
    'responses',
    'assessment_consents',
    'professionals',
    'professional_assignments',
    'patients',
    'patient_documents',
    'documents',
    'sessions',
    'treatment_cycles',
    'pre_validations',
    'mini_checks',
    'reassessments_t12',
    'self_triggers',
    'waitlist',
    'restratification_alerts',
    'acute_events',
    'generated_reports',
    'email_log',
    'referral_codes',
    'referral_uses',
    'first_meetings',
    'access_logs',
    'admin_settings',
  ];

  const backup = {
    created_at: new Date().toISOString(),
    version: '1.0',
    tables: {},
  };

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.warn(`⚠️  Tabella ${table}: ${error.message}`);
      backup.tables[table] = [];
    } else {
      backup.tables[table] = data;
      console.log(`✅ ${table}: ${data.length} righe`);
    }
  }

  // ── 3. Salva file ────────────────────────────────────────────────────────────
  const date = new Date().toISOString().split('T')[0];
  const filename = `eswork-backup-${date}.json`;
  const filepath = path.join('backups', filename);

  // Crea cartella backups se non esiste
  if (!fs.existsSync('backups')) fs.mkdirSync('backups');

  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf8');
  const sizeMb = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
  console.log(`📦 File salvato: ${filename} (${sizeMb} MB)`);

  // Mantieni solo gli ultimi 8 backup (≈ 2 mesi)
  const files = fs.readdirSync('backups')
    .filter(f => f.startsWith('eswork-backup-') && f.endsWith('.json'))
    .sort();

  if (files.length > 8) {
    const toDelete = files.slice(0, files.length - 8);
    for (const f of toDelete) {
      fs.unlinkSync(path.join('backups', f));
      console.log(`🗑️  Eliminato vecchio backup: ${f}`);
    }
  }

  console.log('✅ Backup completato! Il commit verrà fatto dal workflow.');
}

main().catch(err => {
  console.error('❌ Backup fallito:', err.message);
  process.exit(1);
});
