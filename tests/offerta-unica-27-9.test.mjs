// Offerta e presentazione: «deve essere tutto unico tra presentazione e preventivo»
// (Enrico, 27/9). Zone tutte, stessi testi, accettazione B, niente promesse di risultato.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { zoneDaMostrare } from '../lib/distretti.js';
import { legendaLivelli, CARTE_LIVELLO, azioneLivello } from '../lib/livelli.js';
import { contenutoAnno2 } from '../lib/anno2.mjs';
import { testoAccettazione, prossimoPassoInBreve, GIORNI_FIRMA_CONTRATTO } from '../lib/presentazione-testi.mjs';
import { scadenzaOffertaProposta } from '../lib/offerta.js';

const src = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

const zona = (zone, count12, n) => ({ zone, count12, pct12: Math.round((count12 / n) * 100) });

test('zone: tutte, dalla più colpita; sotto soglia senza numeri; lo zero resta (27/9)', () => {
  const n = 9;
  const nmq = {
    zones: [zona('Collo', 8, n), zona('Schiena bassa (lombare)', 7, n), zona('Spalle', 6, n), zona('Schiena alta (dorsale)', 6, n),
      zona('Caviglie / Piedi', 6, n), zona('Anche / Cosce', 5, n), zona('Ginocchia', 5, n), zona('Polsi / Mani', 4, n), zona('Gomiti', 2, n)],
    districts: [],
  };
  const Z = zoneDaMostrare(nmq);
  assert.equal(Z.aggrega, false);
  assert.equal(Z.righe.length, 9, 'tutte le zone, non le prime tre');
  assert.deepEqual(Z.righe.slice(2, 5).map(r => r.pct12), [67, 67, 67], 'i pari merito ci sono tutti');
  const gomiti = Z.righe.find(r => r.zone === 'Gomiti');
  assert.equal(gomiti.soppressa, true);
  assert.equal(gomiti.pct12, null, 'sotto soglia niente percentuale');
  assert.ok(Z.righe.every(r => !('count12' in r)), 'nessun conteggio esce');
  const conZero = zoneDaMostrare({ zones: [zona('Collo', 5, 9), zona('Gomiti', 0, 9)], districts: [] });
  assert.deepEqual(conZero.righe[1], { zone: 'Gomiti', pct12: 0, soppressa: false });
});

test('zone: con la popolazione piccola i tre distretti, come nel report dal 13/9', () => {
  const n = 5;
  const nmq = {
    zones: [zona('Collo', 3, n), zona('Spalle', 2, n), zona('Gomiti', 1, n), zona('Ginocchia', 1, n), zona('Polsi / Mani', 2, n)],
    districts: [{ zone: 'Rachide', count12: 3, pct12: 60 }, { zone: 'Arti superiori', count12: 4, pct12: 80 }, { zone: 'Arti inferiori', count12: 1, pct12: 20 }],
  };
  const Z = zoneDaMostrare(nmq);
  assert.equal(Z.aggrega, true);
  assert.ok(Z.nota && /distretto/.test(Z.nota));
  assert.deepEqual(Z.righe.map(r => r.zone), ['Rachide', 'Arti superiori', 'Arti inferiori']);
  assert.equal(Z.righe[2].pct12, null);
});

test('legenda dei livelli: trattamenti, mai sedute; il ciclo entro 2 mesi (27/9)', () => {
  const t = legendaLivelli().map(v => v.testo).join(' ');
  assert.ok(!/sedut/i.test(t), t);
  assert.ok(!/sessioni di prevenzione/i.test(t), t);
  assert.match(t, /Ciclo di 4 trattamenti da 30 minuti con l'osteopata, in sede, entro 2 mesi dalla presa in carico\./);
  assert.match(t, /4 trattamenti di prevenzione nell'anno/);
});

test('carte dei livelli: una sola fonte per presentazione, Sintesi e Offerta', () => {
  assert.equal(azioneLivello('l2', { nuovoProgramma: true }), 'Prevenzione dal primo anno');
  assert.equal(azioneLivello('l3'), 'Formazione per tutti');
  assert.equal(CARTE_LIVELLO.l1.desc, 'Dolore con impatto funzionale');
  for (const f of ['pages/dashboard/presentazione/[clientId].js', 'lib/sintesi.js']) {
    assert.ok(!/const LIVELLI = \{/.test(src(f)), `${f}: niente copia locale dei livelli`);
  }
  assert.ok(!/Trattamento — Anno 1|label: 'Solo formazione'/.test(src('pages/dashboard/offer.js')));
});

test('Anno 2: si nomina solo ciò che è nel prezzo', () => {
  const senza = contenutoAnno2({ y2: { sportello: { sell: 100 }, prevention: { sell: 0 } } });
  assert.ok(!/prevenzione/.test(senza), senza);
  assert.match(contenutoAnno2({ y2: { sportello: { sell: 100 }, prevention: { sell: 50 } } }), /i cicli per chi ne avrà bisogno, la prevenzione individuale, un modulo di formazione e la regia del programma\./);
});

test('accettazione (strada B): chi firma, importo con IVA forfettaria, 7 giorni per il contratto', () => {
  const a = testoAccettazione({ importo: '€5.576', iva: 'IVA non applicata — regime forfettario', scadenza: '2026-10-08' });
  assert.match(a.dichiarazione, /per un investimento nel primo anno di €5\.576 \(IVA non applicata — regime forfettario\)\.$/);
  assert.equal(a.condizioni, `L'accettazione fissa le condizioni di questa offerta per ${GIORNI_FIRMA_CONTRATTO} giorni: il programma si attiva con la firma del contratto entro questo termine.`);
  assert.equal(a.validita, 'La presente offerta è valida fino all\'8 ottobre 2026.');
  assert.equal(testoAccettazione({}).validita, '');
  assert.ok(!/\+ IVA/.test(JSON.stringify(a)));
  const offer = src('pages/dashboard/offer.js');
  assert.match(offer, /Il\/La sottoscritto\/a <span/);
  assert.match(offer, /in qualità di <span/);
  assert.match(prossimoPassoInBreve({ scadenzaOfferta: '2026-10-07' }), /^Accettazione dell'offerta entro il 7 ottobre 2026, poi firma del contratto entro 7 giorni/);
});

test('scadenza dell\'offerta: la stessa per Offerta e presentazione', () => {
  assert.equal(scadenzaOffertaProposta({ pipeline_stage: 'offer_open', offerta_scade_il: '2026-10-07' }, 10, '2026-09-28'), '2026-10-07');
  assert.equal(scadenzaOffertaProposta({ pipeline_stage: 'report_presented' }, 10, '2026-09-28'), '2026-10-08');
  const offer = src('pages/dashboard/offer.js');
  assert.match(offer, /scadenzaOffertaProposta\(client, offertaGiorni\)/);
  assert.match(src('lib/presentazione-server.js'), /scadenzaOffertaProposta\(client,/);
});

test('Offerta: niente promesse di risultato, niente voci inesistenti, niente testi vecchi (27/9)', () => {
  const offer = senzaCommenti(src('pages/dashboard/offer.js'));
  for (const vietato of [/Riduzione sintomi/, /Timeline Anno 1/, /\/dipendente/, /giornate nel primo anno/, /intervention-plan/, /analisi ROI/i,
    /Sessioni intensive/, /fase di <strong>mantenimento/, /sessione per sessione/, /Sessioni di prevenzione/, /pianoDeterministico/]) {
    assert.ok(!vietato.test(offer), `ancora presente: ${vietato}`);
  }
  assert.match(offer, /testiCondivisi\(\{ client, d, fm, params \}\)/);
  assert.match(offer, /I prossimi passi/);
  assert.match(offer, /Perché riguarda l&apos;azienda/);
  assert.match(offer, /Le leve economiche/);
});

test('Sintesi e presentazione: tutte le zone, niente prezzo per dipendente', () => {
  const sint = senzaCommenti(src('lib/sintesi.js'));
  assert.ok(!/per dipendente/.test(sint));
  assert.ok(!/zoneTop/.test(sint));
  assert.ok(!/zoneTop/.test(src('pages/dashboard/presentazione/[clientId].js')));
  assert.ok(!/zoneTop/.test(src('lib/presentazione-server.js')));
  assert.ok(!/dipendente: calc\.price_per_employee_y1/.test(src('lib/presentazione-server.js')));
});

test('Report di Attivazione: il prezzo non parla più di «condizioni concordate al colloquio»', () => {
  const gen = src('pages/api/clients/[id]/generate-activation-report.js');
  assert.match(gen, /const TESTA_STAMPATA = 'Investimento calcolato sui numeri del vostro check-up:';/);
  assert.ok(!/concordate al colloquio e/.test(gen.replace(/^\s*\/\/.*$/gm, '')));
  assert.match(gen, /entro la Stima di investimento presentata al colloquio/);
});
