import test from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOLLO, conProtocollo, eRegolaDelProtocollo, inLettere, percento } from '../lib/protocollo.mjs';
import { MAX_CICLI_TRATTAMENTO, MAX_CICLI_PREVENZIONE, MAX_AUTOSEGNALAZIONI } from '../lib/anno-programma.mjs';
import { DEFAULTS_V2 } from '../lib/pricing/v2-defaults.mjs';

// Le regole firmate con il cliente (Enrico, 17/9). Se uno di questi numeri cambia,
// il test deve fallire: la modifica va decisa, non scivolata.
test('i valori del protocollo sono quelli contrattuali', () => {
  assert.deepEqual({ ...PROTOCOLLO }, {
    sedute_per_ciclo: 4, durata_seduta_min: 30, sessioni_prevenzione_l2: 4,
    cicli_trattamento_per_anno: 2, cicli_prevenzione_per_anno: 1,
    giorni_tra_cicli: 60, autosegnalazioni_per_anno: 2, buffer_pct: 0.20,
  });
  assert.equal(Object.isFrozen(PROTOCOLLO), true);
});

test('i limiti dell\'anno di programma leggono il protocollo', () => {
  assert.equal(MAX_CICLI_TRATTAMENTO, PROTOCOLLO.cicli_trattamento_per_anno);
  assert.equal(MAX_CICLI_PREVENZIONE, PROTOCOLLO.cicli_prevenzione_per_anno);
  assert.equal(MAX_AUTOSEGNALAZIONI, PROTOCOLLO.autosegnalazioni_per_anno);
});

test('il prezzo usa il protocollo, qualunque cosa sia salvata nel listino', () => {
  const salvati = { sessions_per_l1: 6, session_duration_min: 45, prevention_sessions_per_l2: 8, buffer_pct: 0.5, tariffa_sessione_prevenzione: 50 };
  const p = conProtocollo(salvati);
  assert.equal(p.sessions_per_l1, 4);
  assert.equal(p.session_duration_min, 30);
  assert.equal(p.prevention_sessions_per_l2, 4);
  assert.equal(p.buffer_pct, 0.20);
  assert.equal(p.tariffa_sessione_prevenzione, 50, 'i parametri commerciali restano modificabili');
  assert.equal(eRegolaDelProtocollo('buffer_pct'), true);
  assert.equal(eRegolaDelProtocollo('l2_multiplier'), false);
});

test('i default del listino v2 coincidono con il protocollo', () => {
  assert.equal(DEFAULTS_V2.sessions_per_l1, PROTOCOLLO.sedute_per_ciclo);
  assert.equal(DEFAULTS_V2.session_duration_min, PROTOCOLLO.durata_seduta_min);
  assert.equal(DEFAULTS_V2.prevention_sessions_per_l2, PROTOCOLLO.sessioni_prevenzione_l2);
  assert.equal(DEFAULTS_V2.buffer_pct, PROTOCOLLO.buffer_pct);
});

test('numeri per le frasi', () => {
  assert.equal(inLettere(2), 'due');
  assert.equal(inLettere(4, { maiuscola: true }), 'Quattro');
  assert.equal(inLettere(12), '12');
  assert.equal(percento(0.2), '20%');
});
