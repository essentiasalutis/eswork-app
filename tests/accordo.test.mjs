import test from 'node:test';
import assert from 'node:assert/strict';
import { statoAccordo } from '../lib/accordo.mjs';

const ADESSO = new Date('2026-10-10T10:00:00Z');
const v1 = { id: 'tl_a_1', versione: '2026-10-01.1', stato: 'in_vigore', pubblicato_il: '2026-10-01T08:00:00Z', ritirato_il: null };
const v1r = { ...v1, stato: 'ritirata', ritirato_il: '2026-10-08T08:00:00Z' };
const v2 = { id: 'tl_a_2', versione: '2026-10-08.1', stato: 'in_vigore', pubblicato_il: '2026-10-08T08:00:00Z', ritirato_il: null };
const firma = (id, valore = 'dato', at = '2026-10-02T09:00:00Z') => ({ testo_legale_id: id, valore, atto_at: at });
const copia = (id) => ({ testo_legale_id: id, caricato_il: '2026-10-02T09:00:00Z' });

test('testo non pubblicato: nessuno è conforme, e il motivo lo dice', () => {
  const s = statoAccordo({ versioni: [], adesso: ADESSO });
  assert.equal(s.conforme, false);
  assert.match(s.motivo, /testo non ancora pubblicato/);
});

test('servono spunta E file sulla stessa versione', () => {
  assert.equal(statoAccordo({ versioni: [v1], firme: [firma('tl_a_1')], file: [copia('tl_a_1')], adesso: ADESSO }).stato, 'valido');
  const soloSpunta = statoAccordo({ versioni: [v1], firme: [firma('tl_a_1')], adesso: ADESSO });
  assert.equal(soloSpunta.conforme, false);
  assert.match(soloSpunta.motivo, /manca la copia firmata/);
  const soloFile = statoAccordo({ versioni: [v1], file: [copia('tl_a_1')], adesso: ADESSO });
  assert.match(soloFile.motivo, /manca la sottoscrizione\)/);
});

test('spunta e file su versioni diverse non bastano', () => {
  const s = statoAccordo({ versioni: [v1r, v2], firme: [firma('tl_a_1')], file: [copia('tl_a_2')], adesso: new Date('2026-10-20T10:00:00Z') });
  assert.equal(s.conforme, false);
});

test('nuova versione: 7 giorni di preavviso dal ritiro, poi non conforme', () => {
  const base = { versioni: [v1r, v2], firme: [firma('tl_a_1')], file: [copia('tl_a_1')] };
  const dentro = statoAccordo({ ...base, adesso: new Date('2026-10-14T10:00:00Z') });
  assert.equal(dentro.stato, 'in_preavviso');
  assert.equal(dentro.conforme, true);
  assert.equal(dentro.scadenza, '2026-10-15T08:00:00.000Z');
  const fuori = statoAccordo({ ...base, adesso: new Date('2026-10-15T08:00:01Z') });
  assert.equal(fuori.conforme, false);
  assert.match(fuori.motivo, /2026-10-08\.1/);
});

test('una spunta revocata non vale', () => {
  const s = statoAccordo({ versioni: [v1], firme: [firma('tl_a_1'), firma('tl_a_1', 'revocato', '2026-10-05T09:00:00Z')], file: [copia('tl_a_1')], adesso: ADESSO });
  assert.equal(s.conforme, false);
});
