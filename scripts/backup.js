/**
 * ES Work — Backup Supabase → Google Drive
 * Esporta tutte le tabelle in un file JSON e lo carica su Drive.
 * Viene eseguito da GitHub Actions ogni domenica alle 02:00.
 */

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GOOGLE_SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT; // JSON stringificato
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function main() {
  console.log('🔄 ES Work Backup — avvio...');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Variabili Supabase mancanti');
  }
  if (!GOOGLE_SERVICE_ACCOUNT || !GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error('Variabili Google Drive mancanti');
  }

  // ── 1. Connessione Supabase ──────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    global: { fetch: fetch },
    realtime: { transport: ws },
  });

  // ── 2. Export di tutte le tabelle ───────────────────────────────────────────
  const TABLES = [
    'clients',
    'assessments',
    'responses',
    'professionals',
    'professional_assignments',
    'patients',
    'sessions',
    'access_logs',
    'first_meetings',
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

  // ── 3. Salva file locale ─────────────────────────────────────────────────────
  const date = new Date().toISOString().split('T')[0]; // es. 2026-05-06
  const filename = `eswork-backup-${date}.json`;
  const filepath = path.join('/tmp', filename);

  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf8');
  const sizeMb = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
  console.log(`📦 File creato: ${filename} (${sizeMb} MB)`);

  // ── 4. Upload su Google Drive ────────────────────────────────────────────────
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  const drive = google.drive({ version: 'v3', auth });

  // Elimina backup vecchi (mantieni solo gli ultimi 8 = 2 mesi)
  const existing = await drive.files.list({
    q: `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and name contains 'eswork-backup' and trashed=false`,
    fields: 'files(id, name, createdTime)',
    orderBy: 'createdTime asc',
  });

  const files = existing.data.files || [];
  if (files.length >= 8) {
    const toDelete = files.slice(0, files.length - 7);
    for (const f of toDelete) {
      await drive.files.delete({ fileId: f.id });
      console.log(`🗑️  Eliminato vecchio backup: ${f.name}`);
    }
  }

  // Carica il nuovo backup
  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [GOOGLE_DRIVE_FOLDER_ID],
      mimeType: 'application/json',
    },
    media: {
      mimeType: 'application/json',
      body: fs.createReadStream(filepath),
    },
    fields: 'id, name, size',
  });

  console.log(`☁️  Caricato su Drive: ${response.data.name} (id: ${response.data.id})`);
  console.log('✅ Backup completato!');
}

main().catch(err => {
  console.error('❌ Backup fallito:', err.message);
  process.exit(1);
});
