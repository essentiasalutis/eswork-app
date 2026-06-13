/**
 * ES Work — Backup Supabase → GitHub repository (CIFRATO)
 * Esporta tutte le tabelle, le CIFRA con AES-256-GCM e scrive solo il file
 * `backups/eswork-backup-<data>.json.enc`. Il JSON in chiaro non tocca MAI il
 * disco né il commit. Il commit/push lo fa il workflow GitHub Actions (git add -f,
 * perché backups/ è in .gitignore). Eseguito ogni domenica alle 02:00.
 *
 * La chiave di cifratura è la passphrase BACKUP_ENCRYPTION_KEY (secret GitHub /
 * variabile d'ambiente), MAI versionata. Senza chiave il backup fallisce: così
 * non può mai ricadere a scrivere dati clinici in chiaro.
 * Per rileggere un backup: `node scripts/restore-backup.js <file.json.enc>`.
 */

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BACKUP_ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY;

// Cifra una stringa JSON con AES-256-GCM. Chiave a 256 bit derivata dalla
// passphrase via scrypt + salt casuale; IV casuale; tag di autenticazione
// (manomissione → errore in fase di restore). Output = envelope JSON base64.
function encryptJson(jsonString, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(jsonString, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    alg: 'aes-256-gcm',
    kdf: 'scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  });
}

async function main() {
  console.log('🔄 ES Work Backup — avvio...');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Variabili Supabase mancanti');
  }
  if (!BACKUP_ENCRYPTION_KEY || BACKUP_ENCRYPTION_KEY.length < 16) {
    // Senza chiave robusta NON procediamo: mai scrivere dati clinici in chiaro.
    throw new Error('BACKUP_ENCRYPTION_KEY mancante o troppo corta (min 16 caratteri). Backup interrotto per non scrivere dati in chiaro.');
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

  // ── 3. Cifra e salva file ────────────────────────────────────────────────────
  const date = new Date().toISOString().split('T')[0];
  const filename = `eswork-backup-${date}.json.enc`;
  const filepath = path.join('backups', filename);

  // Crea cartella backups se non esiste
  if (!fs.existsSync('backups')) fs.mkdirSync('backups');

  // Cifra in memoria: il JSON in chiaro non viene MAI scritto su disco.
  const plaintext = JSON.stringify(backup);
  const encrypted = encryptJson(plaintext, BACKUP_ENCRYPTION_KEY);
  fs.writeFileSync(filepath, encrypted, 'utf8');
  const sizeMb = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
  console.log(`🔐 File cifrato salvato: ${filename} (${sizeMb} MB)`);

  // Mantieni solo gli ultimi 8 backup (≈ 2 mesi)
  const files = fs.readdirSync('backups')
    .filter(f => f.startsWith('eswork-backup-') && f.endsWith('.json.enc'))
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
