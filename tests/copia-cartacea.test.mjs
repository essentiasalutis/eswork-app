import test from 'node:test';
import assert from 'node:assert/strict';
import { giornoRoma, erroreDataFirma, versioneInVigoreIl, erroreMotivo, tipoDaiByte, GIORNI_MAX, cartaSospesa, CARTA_SOSPESA, MESSAGGI } from '../lib/copia-cartacea.mjs';

// 17 settembre 2026, 10:00 a Roma (08:00 UTC)
const ADESSO = new Date('2026-09-17T08:00:00Z');

test('giorno italiano: dopo mezzanotte a Roma è già il giorno dopo, anche se in UTC no', () => {
  assert.equal(giornoRoma('2026-09-17T22:30:00Z'), '2026-09-18');
  assert.equal(giornoRoma('2026-09-17T21:59:00Z'), '2026-09-17');
});

test('data della firma: oggi e fino a 7 giorni fa vale; l\'ottavo giorno no', () => {
  assert.equal(erroreDataFirma('2026-09-17', ADESSO), null);
  assert.equal(erroreDataFirma('2026-09-10', ADESSO), null);
  assert.equal(GIORNI_MAX, 7);
  assert.equal(erroreDataFirma('2026-09-09', ADESSO), 'oltre_termine');
});

test('data della firma: futura o malformata non vale', () => {
  assert.equal(erroreDataFirma('2026-09-18', ADESSO), 'data_futura');
  assert.equal(erroreDataFirma('2026-02-30', ADESSO), 'data_non_valida');
  assert.equal(erroreDataFirma('17/09/2026', ADESSO), 'data_non_valida');
  assert.equal(erroreDataFirma(undefined, ADESSO), 'data_non_valida');
});

test('firma dopo mezzanotte italiana: caricata subito, è lo stesso giorno', () => {
  // 00:30 del 18 a Roma = 22:30 UTC del 17
  assert.equal(erroreDataFirma('2026-09-18', new Date('2026-09-17T22:30:00Z')), null);
});

test('versione: in vigore il giorno della firma', () => {
  const v = { stato: 'in_vigore', pubblicato_il: '2026-09-17T07:00:00Z', ritirato_il: null };
  assert.equal(versioneInVigoreIl(v, '2026-09-17'), true);
  assert.equal(versioneInVigoreIl(v, '2026-09-16'), false, 'firmata prima che la versione esistesse');
});

test('versione ritirata: vale fino al giorno del ritiro compreso, non dopo', () => {
  const v = { stato: 'ritirata', pubblicato_il: '2026-09-01T07:00:00Z', ritirato_il: '2026-09-15T10:00:00Z' };
  assert.equal(versioneInVigoreIl(v, '2026-09-10'), true);
  assert.equal(versioneInVigoreIl(v, '2026-09-15'), true);
  assert.equal(versioneInVigoreIl(v, '2026-09-16'), false);
});

test('una bozza non vale mai', () => {
  assert.equal(versioneInVigoreIl({ stato: 'bozza', pubblicato_il: null }, '2026-09-17'), false);
  assert.equal(versioneInVigoreIl(null, '2026-09-17'), false);
});

test('motivo obbligatorio; «altro» vuole una spiegazione', () => {
  assert.equal(erroreMotivo('tablet_non_disponibile'), null);
  assert.equal(erroreMotivo(''), 'motivo_mancante');
  assert.equal(erroreMotivo('inventato'), 'motivo_mancante');
  assert.equal(erroreMotivo('altro', 'ok'), 'motivo_nota_mancante');
  assert.equal(erroreMotivo('altro', 'Paziente senza occhiali'), null);
});

test('tipo del file dai byte, non dal nome', () => {
  assert.equal(tipoDaiByte(Buffer.from('%PDF-1.7')).mime, 'application/pdf');
  assert.equal(tipoDaiByte(Buffer.from([0xff, 0xd8, 0xff, 0xe0])).mime, 'image/jpeg');
  assert.equal(tipoDaiByte(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d])).mime, 'image/png');
  assert.equal(tipoDaiByte(Buffer.from('<html>')), null);
  assert.equal(tipoDaiByte(Buffer.from('MZ\x90\x00')), null);
});

test('informativa estesa su carta sospesa, e il messaggio dice perché', () => {
  assert.equal(cartaSospesa('privacy_extended'), true);
  assert.equal(cartaSospesa('consent_treatment'), false);
  const m = MESSAGGI[CARTA_SOSPESA.privacy_extended];
  assert.match(m, /formula di consenso/);
  assert.match(m, /art\. 9/);
  assert.match(m, /in piattaforma/);
});
