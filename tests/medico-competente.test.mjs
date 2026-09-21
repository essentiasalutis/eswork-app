import test from 'node:test';
import assert from 'node:assert/strict';
import { informativaPrevedeMedico, requisitiAssegnazione, validaIndicazione, paroleDaNomi, terminiCommerciali, PRESIDI } from '../lib/medico-competente.mjs';

const informativaSenza = { sezioni: [{ id: 'accesso', testo: 'Chi può accedere…' }] };
const informativaCon = { sezioni: [{ id: 'accesso', testo: '…' }, { id: 'medico_competente', testo: 'Il medico competente vede solo dati aggregati.' }] };

test('informativa: serve la sezione con identificativo fisso e un testo', () => {
  assert.equal(informativaPrevedeMedico(informativaSenza), false);
  assert.equal(informativaPrevedeMedico({ sezioni: [{ id: 'medico_competente', testo: '  ' }] }), false);
  assert.equal(informativaPrevedeMedico({ sezioni: [{ id: 'altro', testo: 'il medico competente…' }] }), false, 'la parola nel testo non basta');
  assert.equal(informativaPrevedeMedico(informativaCon), true);
  assert.equal(informativaPrevedeMedico(null), false);
});

test('azienda reale con l\'informativa attuale: rifiutata, con il messaggio', () => {
  const r = requisitiAssegnazione({ isDemo: false, contenutoInformativa: informativaSenza, tipiDocumenti: ['accordo', 'dichiarazione_presidi'] });
  assert.equal(r.ok, false);
  assert.deepEqual(r.mancanti, ['informativa']);
  assert.match(r.messaggio, /informativa del check-up in vigore non prevede/);
});

test('documenti mancanti: il messaggio dice quale', () => {
  const r = requisitiAssegnazione({ isDemo: false, contenutoInformativa: informativaCon, tipiDocumenti: ['accordo'] });
  assert.deepEqual(r.mancanti, ['dichiarazione_presidi']);
  assert.match(r.messaggio, /dichiarazione dei quattro presidi/);
  for (const p of PRESIDI) assert.ok(r.messaggio.includes(p));
  assert.deepEqual(requisitiAssegnazione({ isDemo: false, contenutoInformativa: informativaCon, tipiDocumenti: [] }).mancanti, ['accordo', 'dichiarazione_presidi']);
  assert.equal(requisitiAssegnazione({ isDemo: false, contenutoInformativa: informativaCon, tipiDocumenti: ['accordo', 'dichiarazione_presidi'] }).ok, true);
});

test('azienda demo: esente', () => {
  assert.equal(requisitiAssegnazione({ isDemo: true, contenutoInformativa: null, tipiDocumenti: [] }).ok, true);
});

const vietate = paroleDaNomi(['Gabriele Farina', 'Serena Ferraro', "Anna D'Angelo", 'Li']);

test('indicazione con il cognome di una persona dell\'azienda: rifiutata senza ripetere il nome', () => {
  const r = validaIndicazione('Movimentazione carichi pesanti, farina ne parla spesso', vietate);
  assert.equal(r.ok, false);
  assert.ok(!/farina/i.test(r.errore), 'il messaggio non ripete il nome');
  assert.equal(validaIndicazione('lavoro di dangelo al tornio', vietate).ok, false, 'apostrofi e accenti normalizzati');
});

test('indicazione con cifre, date, email o «Nome Cognome»: rifiutata', () => {
  assert.equal(validaIndicazione('Matricola 00123 lamenta dolore', vietate).ok, false);
  assert.equal(validaIndicazione('dal 12/03 in reparto', vietate).ok, false);
  assert.equal(validaIndicazione('scrivere a qualcuno@azienda.it', vietate).ok, false);
  assert.equal(validaIndicazione('sollevamenti ripetuti per Mario Bianchi', vietate).ok, false);
});

test('indicazione su un reparto o una mansione: accettata; vuota: niente testo', () => {
  const r = validaIndicazione('  Sollevamenti ripetuti sopra le spalle, postazioni basse  ', vietate);
  assert.equal(r.ok, true);
  assert.equal(r.testo, 'Sollevamenti ripetuti sopra le spalle, postazioni basse');
  assert.equal(validaIndicazione('', vietate).testo, null);
  assert.equal(validaIndicazione(null, vietate).testo, null);
  assert.equal(validaIndicazione('turno 2 del magazzino', vietate).ok, true, 'una cifra sola non è una matricola');
});

test('indicazione su più righe o troppo lunga: rifiutata', () => {
  assert.equal(validaIndicazione('riga uno\nriga due', vietate).ok, false);
  assert.equal(validaIndicazione('x'.repeat(161), vietate).ok, false);
});

test('ricerca dei termini commerciali', () => {
  assert.deepEqual(terminiCommerciali('Prevalenza 17% · 228 risposte'), []);
  assert.deepEqual(terminiCommerciali("L'investimento è di €54.020"), ['investiment', '€']);
  assert.deepEqual(terminiCommerciali('dentro la forbice'), ['forbic']);
  assert.deepEqual(terminiCommerciali('riduzione del premio INAIL, 300 euro'), ['premio', 'euro']);
});

test('lessico: nelle pagine e nelle API del medico mai «segnala» né «predittivo»', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { RE_LESSICO_VIETATO } = await import('../lib/medico-competente.mjs');
  const file = [];
  const giro = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? giro(p) : file.push(p); } };
  for (const d of ['pages/mc', 'pages/api/mc', 'pages/api/admin/medici-competenti']) giro(d);
  file.push('pages/dashboard/medici-competenti.js', 'lib/mc-auth.js', 'lib/medico-competente-server.js');
  const trovati = file.filter(f => RE_LESSICO_VIETATO.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(trovati, []);
});
