/**
 * ES Work — Restore di un backup CIFRATO.
 * Decifra un file `eswork-backup-<data>.json.enc` prodotto da scripts/backup.js.
 *
 * Uso:
 *   BACKUP_ENCRYPTION_KEY='<passphrase>' node scripts/restore-backup.js <file.json.enc> [output.json]
 *
 * Senza [output.json] stampa il JSON in chiaro su stdout.
 * NB: il JSON decifrato contiene dati clinici/personali in chiaro: maneggiare
 * solo in locale e cancellare l'output quando non serve più.
 */

const fs = require('fs');
const crypto = require('crypto');

const KEY = process.env.BACKUP_ENCRYPTION_KEY;
const inFile = process.argv[2];
const outFile = process.argv[3];

if (!KEY) {
  console.error('❌ BACKUP_ENCRYPTION_KEY mancante (la stessa passphrase usata per il backup).');
  process.exit(1);
}
if (!inFile) {
  console.error('Uso: BACKUP_ENCRYPTION_KEY=... node scripts/restore-backup.js <file.json.enc> [output.json]');
  process.exit(1);
}

function decryptEnvelope(envelopeString, passphrase) {
  const env = JSON.parse(envelopeString);
  if (env.alg !== 'aes-256-gcm') throw new Error(`Algoritmo non supportato: ${env.alg}`);
  const salt = Buffer.from(env.salt, 'base64');
  const iv = Buffer.from(env.iv, 'base64');
  const tag = Buffer.from(env.tag, 'base64');
  const data = Buffer.from(env.data, 'base64');
  const key = crypto.scryptSync(passphrase, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

try {
  const envelope = fs.readFileSync(inFile, 'utf8');
  const json = decryptEnvelope(envelope, KEY);
  if (outFile) {
    fs.writeFileSync(outFile, json, 'utf8');
    console.log(`✅ Backup decifrato in ${outFile}`);
  } else {
    process.stdout.write(json);
  }
} catch (e) {
  console.error('❌ Restore fallito (chiave errata o file manomesso?):', e.message);
  process.exit(1);
}
