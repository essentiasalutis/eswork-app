// Test delle REGOLE organizzative. Si esegue con `npm test` (Node, nessuna
// impalcatura: lib/org-regole.mjs non ha dipendenze).
//
// Perché esiste (Enrico, 12/9): l'ergonomia ora vive sulla stessa macchina della
// formazione (sessione → partecipazioni). Il rischio è che una riga di ergonomia
// finisca nella CODA DI RECUPERO, cioè fra le persone da richiamare a fare un corso.
// Non basta averlo verificato una volta: questo test fallisce se un domani qualcuno
// allarga la query.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIPI_BASE, TIPI_FORMAZIONE, TIPO_ERGONOMIA,
  codaRecupero, triggerRecupero, aggregati, storicoDipendente,
} from '../lib/org-regole.mjs';

const AVVIO = '2026-01-01';
const dip = (id, extra = {}) => ({ id, nome: `Dip ${id}`, attivo: true, straordinario: false, data_ingresso: '2026-03-01', ...extra });
const part = (dipendente_id, tipo, stato = 'svolta', extra = {}) => ({ id: `p_${dipendente_id}_${tipo}`, dipendente_id, tipo, stato, data_svolgimento: '2026-04-01', ...extra });

test('una partecipazione di ergonomia non toglie nessuno dalla coda di recupero', () => {
  const dipendenti = [dip('d1')];
  // Ha fatto l'ergonomia ma NON la formazione base: deve restare in coda.
  const coda = codaRecupero(dipendenti, [part('d1', TIPO_ERGONOMIA)], AVVIO);
  assert.equal(coda.length, 1, 'chi ha solo l\'ergonomia deve restare in coda per la formazione');
  assert.equal(coda[0].id, 'd1');
});

test('una partecipazione di ergonomia non mette nessuno in coda né fa scattare il trigger', () => {
  const dipendenti = [dip('d1'), dip('d2')];
  // Entrambi hanno la base svolta: la coda è vuota anche con righe di ergonomia intorno.
  const partecipazioni = [
    part('d1', 'base'), part('d2', 'base_concentrata'),
    part('d1', TIPO_ERGONOMIA), part('d2', TIPO_ERGONOMIA, 'da_recuperare'),
  ];
  const coda = codaRecupero(dipendenti, partecipazioni, AVVIO);
  assert.equal(coda.length, 0, 'una riga di ergonomia "da_recuperare" non è un corso da recuperare');
  const trig = triggerRecupero(coda, 5, '2026-12-31', 6);
  assert.equal(trig.active, false, 'con la coda vuota nessun trigger, nemmeno per tempo');
});

test('la base svolta conta solo dai tipi formativi di base', () => {
  const dipendenti = [dip('d1')];
  for (const tipo of TIPI_BASE) {
    assert.equal(codaRecupero(dipendenti, [part('d1', tipo)], AVVIO).length, 0, `${tipo} chiude la coda`);
  }
  // L'aggiornamento annuale NON sostituisce la base.
  assert.equal(codaRecupero(dipendenti, [part('d1', 'aggiornamento')], AVVIO).length, 1);
});

test('le liste dei tipi restano quelle attese', () => {
  assert.deepEqual(TIPI_BASE, ['base', 'base_concentrata']);
  assert.deepEqual(TIPI_FORMAZIONE, ['base', 'base_concentrata', 'aggiornamento']);
  assert.equal(TIPO_ERGONOMIA, 'ergonomia');
  assert.ok(!TIPI_FORMAZIONE.includes(TIPO_ERGONOMIA), 'l\'ergonomia non è formazione: se lo diventa, la coda cambia');
});

test('la percentuale di base completata ignora l\'ergonomia', () => {
  const dipendenti = [dip('d1', { data_ingresso: '2025-01-01' }), dip('d2', { data_ingresso: '2025-01-01' })];
  const a = aggregati(dipendenti, [part('d1', 'base'), part('d2', TIPO_ERGONOMIA)], AVVIO);
  assert.equal(a.conBase, 1);
  assert.equal(a.senzaBase, 1);
  assert.equal(a.pctBaseCompletata, 50);
});

test('lo storico distingue come è stata registrata l\'ergonomia', () => {
  const d = dip('d1', { data_cessazione: '2026-06-30', area: 'reparto' });
  const righe = storicoDipendente(d, [
    part('d1', 'base', 'svolta', { sessione_formativa_id: 's1' }),
    part('d1', TIPO_ERGONOMIA, 'svolta', { origine: 'spunta_sessione', sessione_formativa_id: 's1' }),
    part('d1', TIPO_ERGONOMIA, 'svolta', { id: 'p2', origine: 'intervento', data_svolgimento: '2026-05-02' }),
  ], [{ id: 's1', gruppo: 'A', anno_programma: 1, data_erogazione: '2026-04-01' }]);
  const ergo = righe.filter(r => r.cosa === 'Intervento di ergonomia');
  assert.equal(ergo.length, 2);
  assert.ok(ergo.some(r => r.origine === 'dalla conferma presenti'));
  assert.ok(ergo.some(r => r.origine === 'registrata a mano'));
  assert.equal(righe[0].cosa, 'Cessazione', 'la riga più recente in cima');
  assert.ok(righe.some(r => r.cosa === 'Ingresso in azienda'));
});
