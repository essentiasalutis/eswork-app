/**
 * ES Work — Backup Supabase → Google Drive
 * Esporta tutte le tabelle in JSON e carica il file su Google Drive.
 * Viene eseguito da GitHub Actions ogni domenica alle 02:00.
 *
 * I dati contengono informazioni cliniche/personali dei pazienti: NON vengono
 * mai committati nel repository, ma caricati su Google Drive (cartella dedicata)
 * tramite service account.
 */

const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
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

  // ── 4. Upload su Google Drive ────────────────────────────────────────────────
  await uploadToDrive(filepath, filename);

  console.log('✅ Backup completato e caricato su Google Drive.');
}

// ── Upload del file su Google Drive tramite service account ────────────────────
async function uploadToDrive(filepath, filename) {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT mancante');
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID mancante');

  let creds;
  try {
    creds = JSON.parse(raw);
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT non è un JSON valido: ' + e.message);
  }
  // Normalizza eventuali newline escappati nella private key
  if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    ['https://www.googleapis.com/auth/drive']
  );
  await auth.authorize();

  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: 'application/json', body: fs.createReadStream(filepath) },
    fields: 'id, name',
    supportsAllDrives: true,
  });
  console.log(`☁️  Caricato su Google Drive: ${res.data.name} (id ${res.data.id})`);
}

main().catch(err => {
  console.error('❌ Backup fallito:', err.message);
  process.exit(1);
});
