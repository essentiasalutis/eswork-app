// OT23 in verifica con l'INAIL (Enrico, 21/9/2026): nessun documento promette l'OT23
// finché l'INAIL non risponde per iscritto sull'ammissibilità del programma (C-4.1).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TESTO_OT23_IN_VERIFICA } from '../lib/ot23-stato.mjs';
import { VOCI_PROGRAMMA } from '../lib/programma.js';
import { leveEconomiche } from '../lib/leve.js';

const src = f => fs.readFileSync(f, 'utf8');

test('il testo di Enrico, parola per parola', () => {
  assert.equal(TESTO_OT23_IN_VERIFICA, 'Il programma produce la documentazione degli interventi erogati — pianificazione, presenze, risultati — che l\'azienda può valutare di utilizzare per la domanda OT23. L\'ammissibilità è in corso di verifica con l\'INAIL, e la riduzione richiede comunque più di un intervento.');
});

test('voce 12: il testo in verifica, nessuna promessa nel nome', () => {
  const v = VOCI_PROGRAMMA.find(x => x.n === 12);
  assert.equal(v.cliente, TESTO_OT23_IN_VERIFICA);
  assert.ok(!/OT23|INAIL/.test(v.nome));
});

test('leva OT23: né percentuali né cifre in euro, nemmeno con premio e dipendenti noti', () => {
  const ot23 = leveEconomiche({ dipendenti: 8, premioInail: 50000, giorniMalattia: 300 }).find(l => /OT23/.test(l.titolo));
  assert.equal(ot23.testo, TESTO_OT23_IN_VERIFICA);
  assert.ok(!/%|€/.test(`${ot23.titolo} ${ot23.testo} ${ot23.nota || ''}`));
});

test('nessun testo al cliente promette la riduzione o afferma interventi non verificati', () => {
  const testi = ['lib/programma.js', 'lib/leve.js', 'lib/pricing/v1.js', 'pages/dashboard/offer.js', 'pages/api/clients/[id]/generate-checkpoint-report.js'].map(src).join('\n');
  for (const vietato of [/utilizzabili per la domanda/, /Elementi per la richiesta di riduzione/, /Riduzione del premio INAIL/, /## Documentazione INAIL OT23\n/, /Dossier con la documentazione necessaria/, /formazione collettiva e sportello osteopatico in sede\./]) {
    assert.ok(!vietato.test(testi), String(vietato));
  }
});
