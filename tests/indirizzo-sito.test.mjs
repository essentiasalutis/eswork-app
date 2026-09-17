import test from 'node:test';
import assert from 'node:assert/strict';
import { indirizzoPerEmail, indirizzoDallaRichiesta, INDIRIZZO_PREDEFINITO } from '../lib/indirizzo-sito.mjs';

test('il caso vero del 17/9: l\'indirizzo di Supabase si rifiuta, dicendo trovato e atteso', () => {
  const r = indirizzoPerEmail({ NEXT_PUBLIC_BASE_URL: 'https://mcolellymvtwkearosll.supabase.co', VERCEL_ENV: 'production' });
  assert.equal(r.ok, false);
  assert.match(r.errore, /«https:\/\/mcolellymvtwkearosll\.supabase\.co»/);
  assert.match(r.errore, /Supabase/);
  assert.match(r.errore, /Atteso .*https:\/\/eswork-app\.vercel\.app/);
});

test('valore corretto: accettato, senza barra finale', () => {
  assert.deepEqual(indirizzoPerEmail({ NEXT_PUBLIC_BASE_URL: 'https://eswork-app.vercel.app/', VERCEL_ENV: 'production' }), { ok: true, indirizzo: 'https://eswork-app.vercel.app' });
});

test('altri valori palesemente sbagliati', () => {
  const p = { VERCEL_ENV: 'production' };
  assert.match(indirizzoPerEmail({ ...p, NEXT_PUBLIC_BASE_URL: 'eswork-app.vercel.app' }).errore, /non è un indirizzo valido/);
  assert.match(indirizzoPerEmail({ ...p, NEXT_PUBLIC_BASE_URL: 'http://eswork-app.vercel.app' }).errore, /https/);
  assert.match(indirizzoPerEmail({ ...p, NEXT_PUBLIC_BASE_URL: 'http://localhost:3000' }).errore, /locale/);
  assert.match(indirizzoPerEmail({ ...p, NEXT_PUBLIC_BASE_URL: 'https://eswork-app.vercel.app/dashboard' }).errore, /percorso/);
});

test('in locale localhost va bene; variabile assente: indirizzo predefinito dichiarato', () => {
  assert.equal(indirizzoPerEmail({ NEXT_PUBLIC_BASE_URL: 'http://localhost:3000' }).ok, true);
  const r = indirizzoPerEmail({});
  assert.equal(r.indirizzo, INDIRIZZO_PREDEFINITO);
  assert.equal(r.predefinito, true);
});

test('indirizzo della richiesta: dietro Vercel e in locale', () => {
  assert.equal(indirizzoDallaRichiesta({ 'x-forwarded-host': 'eswork-app.vercel.app', 'x-forwarded-proto': 'https', host: 'interno' }), 'https://eswork-app.vercel.app');
  assert.equal(indirizzoDallaRichiesta({ host: 'localhost:3320' }), 'http://localhost:3320');
  assert.equal(indirizzoDallaRichiesta({}), INDIRIZZO_PREDEFINITO);
});
