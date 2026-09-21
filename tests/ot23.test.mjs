// OT23 in verifica con l'INAIL (Enrico, 21/9/2026): nessun documento promette l'OT23
// finché l'INAIL non risponde per iscritto sull'ammissibilità del programma (C-4.1).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TESTO_OT23_IN_VERIFICA, RISPOSTA_INAIL_C41, DOSSIER_OT23_COSTRUITO, condizioniVoceOT23, vociListinoConSospensione, rifiutoScritturaOT23 } from '../lib/ot23-stato.mjs';
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

// ─── Voce del Listino «Documentazione OT23 INAIL»: sospesa (Enrico, 21/9) ───
const RISPOSTA = { data: '2026-10-15', riferimento: 'richiesta n. 123', esito: 'positiva' };

test('oggi la voce è sospesa: nessuna delle due condizioni vale', () => {
  assert.equal(RISPOSTA_INAIL_C41, null);
  assert.equal(DOSSIER_OT23_COSTRUITO, false);
  const st = condizioniVoceOT23();
  assert.equal(st.attiva, false);
  assert.equal(st.mancanti.length, 2);
});

test('si riattiva solo con ENTRAMBE le condizioni', () => {
  assert.equal(condizioniVoceOT23({ risposta: RISPOSTA, dossier: false }).attiva, false, 'solo la risposta INAIL');
  assert.equal(condizioniVoceOT23({ risposta: null, dossier: true }).attiva, false, 'solo il dossier');
  assert.equal(condizioniVoceOT23({ risposta: { ...RISPOSTA, esito: 'negativa' }, dossier: true }).attiva, false, 'risposta negativa');
  assert.equal(condizioniVoceOT23({ risposta: { ...RISPOSTA, riferimento: '' }, dossier: true }).attiva, false, 'risposta senza riferimento');
  assert.equal(condizioniVoceOT23({ risposta: RISPOSTA, dossier: true }).attiva, true);
});

test('lettura: la voce sospesa vale 0 anche se in banca dati c\'è 500; le altre voci restano', () => {
  const righe = [{ id: 'sd_ot23_core', valore_dichiarato: 500, configurazione: 'core' }, { id: 'sd_formazione_core', valore_dichiarato: 800 }];
  const [ot, altra] = vociListinoConSospensione(righe);
  assert.equal(ot.valore_dichiarato, 0);
  assert.equal(ot.sospesa, true);
  assert.equal(ot.valore_in_banca_dati, 500);
  assert.deepEqual(altra, righe[1]);
  const attiva = condizioniVoceOT23({ risposta: RISPOSTA, dossier: true });
  assert.deepEqual(vociListinoConSospensione(righe, attiva), righe);
});

test('scrittura: finché è sospesa accetta solo 0', () => {
  assert.match(rifiutoScritturaOT23('sd_ot23_plus', { valore_dichiarato: 500 }), /Voce sospesa: il valore resta 0 finché mancano/);
  assert.equal(rifiutoScritturaOT23('sd_ot23_plus', { valore_dichiarato: 0 }), null);
  assert.equal(rifiutoScritturaOT23('sd_formazione_core', { valore_dichiarato: 500 }), null);
  assert.equal(rifiutoScritturaOT23('sd_ot23_plus', { valore_dichiarato: 500 }, condizioniVoceOT23({ risposta: RISPOSTA, dossier: true })), null);
  assert.match(src('lib/pricing/settings.js'), /const rifiuto = rifiutoScritturaOT23\(id, fields\);/);
  assert.match(src('lib/pricing/settings.js'), /return vociListinoConSospensione\(data \|\| \[\]\);/);
});

test('nessun calcolo di prezzo legge i valori dichiarati del Listino', () => {
  const file = [];
  const giro = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = `${d}/${f.name}`; f.isDirectory() ? giro(p) : /\.(m?js|jsx)$/.test(f.name) && file.push(p); } };
  giro('pages'); giro('lib'); giro('components');
  const ammessi = new Set(['lib/pricing/settings.js', 'pages/api/admin/pricing-config.js']);
  for (const f of file) {
    const righe = src(f).split('\n').filter(r => /servizi_deliverable|getServiziDeliverable|updateServizioDeliverable/.test(r));
    const dalCodice = righe.filter(r => !/^\s*\/\//.test(r));   // i commenti non leggono niente
    if (dalCodice.length) assert.ok(ammessi.has(f), `${f} legge i valori dichiarati del Listino`);
  }
});

test('listino v1: fuori le voci Enterprise che non esistono (Audit ESG, Roadmap, Whitepaper)', async () => {
  const { CONFIG_V1 } = await import('../lib/pricing/v1.js');
  const tutte = Object.values(CONFIG_V1.management_services).flat().map(s => s.label).join(' | ');
  for (const via of ['Audit ESG', 'Roadmap triennale', 'Whitepaper']) assert.ok(!tutte.includes(via), via);
});
