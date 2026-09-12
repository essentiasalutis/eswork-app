// Validazione registrata dei report (v60). `npm test`.
// Regola: un documento dichiara la validazione SOLO se è registrata, e la sequenza
// degli eventi (validato → revocato → …) non si riscrive mai.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applicaValidazione, isValidato, rigaValidazione, testoConValidazione } from '../lib/validazione.js';

const CHI = 'Dott. Enrico Maiolo (osteopata)';
const QUANDO = '2026-09-12T10:00:00.000Z';

test('validare scrive chi e quando, e apre la sequenza', () => {
  const p = applicaValidazione({ id: 'r1' }, { azione: 'valida', chi: CHI, quando: QUANDO });
  assert.equal(p.validato_da, CHI);
  assert.equal(p.validato_il, QUANDO);
  assert.deepEqual(p.validazioni, [{ azione: 'validato', chi: CHI, quando: QUANDO }]);
});

test('revocare svuota lo stato ma NON cancella la storia', () => {
  const validato = { id: 'r1', validato_da: CHI, validato_il: QUANDO, validazioni: [{ azione: 'validato', chi: CHI, quando: QUANDO }] };
  const p = applicaValidazione(validato, { azione: 'revoca', chi: CHI, quando: '2026-09-13T08:00:00.000Z' });
  assert.equal(p.validato_da, null);
  assert.equal(p.validato_il, null);
  assert.equal(p.validazioni.length, 2, 'restano entrambi i momenti: chi aveva validato e chi ha revocato');
  assert.deepEqual(p.validazioni.map(v => v.azione), ['validato', 'revocato']);
});

test('non si valida due volte e non si revoca ciò che non è validato', () => {
  const validato = { validato_da: CHI, validato_il: QUANDO };
  assert.equal(applicaValidazione(validato, { azione: 'valida', chi: CHI }), null);
  assert.equal(applicaValidazione({}, { azione: 'revoca', chi: CHI }), null);
});

test('la riga si ferma al fatto: chi e quando', () => {
  const rec = { validato_da: CHI, validato_il: QUANDO };
  assert.equal(rigaValidazione(rec), `Validato da ${CHI} il 12 settembre 2026.`);
  assert.ok(!/responsabilità/i.test(rigaValidazione(rec)), 'nessuna assunzione di responsabilità dichiarata');
  assert.equal(rigaValidazione({}), null);
});

test('il testo porta la riga solo se il registro lo conferma', () => {
  const testo = 'Corpo del report.';
  assert.equal(testoConValidazione(testo, {}), testo, 'non validato: il testo resta identico');
  assert.ok(!isValidato({}));
  const conRiga = testoConValidazione(testo, { validato_da: CHI, validato_il: QUANDO });
  assert.ok(conRiga.startsWith(testo), 'il testo salvato non si riscrive');
  assert.ok(conRiga.includes(`*Validato da ${CHI} il 12 settembre 2026.*`));
});
