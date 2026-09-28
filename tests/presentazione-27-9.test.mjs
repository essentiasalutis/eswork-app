// Revisione della Presentazione (Enrico, 27/9): livelli uniti, piano per livello,
// prezzo senza «per dipendente», leve, sostenibilità a tutta pagina, prossimi passi,
// Stima registrata solo dal pulsante.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { kAnonPartition, livelliLeggibili, nomeCella } from '../lib/kanon.js';
import { pianoPerLivello, prossimiPassi } from '../lib/presentazione-testi.mjs';

const src = f => fs.readFileSync(f, 'utf8');
const P = (a, b, c) => kAnonPartition([{ key: 'l1', count: a }, { key: 'l2', count: b }, { key: 'l3', count: c }], a + b + c);

test('livelli sotto soglia uniti in un solo dato; quelli con almeno 3 persone separati', () => {
  const w = livelliLeggibili(P(2, 6, 1), 9);   // Weisoft
  assert.deepEqual(w.celle.map(c => [nomeCella(c), c.pct, c.count]), [['Livello 1 e Livello 3', 33, 3], ['Livello 2', 67, 6]]);
  const pieni = livelliLeggibili(P(10, 35, 55), 100);
  assert.equal(pieni.celle.length, 3);
  assert.equal(pieni.unite, null);
  assert.equal(livelliLeggibili(P(2, 2, 1), 5).nessunaDistribuzione, true, 'tutti sotto soglia: nessuna distribuzione');
});

test('il dato unito è sempre ricavabile dal totale: non rivela niente di nuovo', () => {
  for (const [a, b, c] of [[2, 6, 1], [2, 40, 50], [0, 7, 2], [2, 2, 0], [1, 8, 1]]) {
    const L = livelliLeggibili(P(a, b, c), a + b + c);
    if (!L.unite) continue;
    const visibili = L.celle.filter(x => !x.unite).reduce((s, x) => s + x.count, 0);
    assert.equal(L.unite.count, a + b + c - visibili);
  }
});

test('nessun «n.d.» livello per livello, e mai più «sotto le 5 persone»', () => {
  for (const f of ['pages/dashboard/presentazione/[clientId].js', 'lib/dati-sanitari.js', 'components/ReportView.jsx', 'pages/dashboard/offer.js', 'lib/movimento.js', 'pages/api/clients/[id]/generate-activation-report.js']) {
    assert.match(src(f), /livelliLeggibili\(/, f);
  }
  assert.ok(!/sotto le 5 persone/.test(src('pages/dashboard/presentazione/[clientId].js')));
  assert.ok(!/n\.d\. \(gruppo < \$\{K_ANON\}, soppresso per riservatezza\)/.test(src('pages/api/clients/[id]/generate-activation-report.js')));
});

test('piano per livello: il testo di Enrico, numeri dal protocollo', () => {
  const p = pianoPerLivello({ ergonomia: true });
  assert.equal(p[0].testo, 'un ciclo di 4 trattamenti da 30 minuti entro 2 mesi, con misura del dolore prima e dopo ogni trattamento; fino a 2 cicli nell\'anno.');
  assert.equal(p[1].testo, '4 trattamenti di prevenzione nell\'anno.');
  assert.equal(p[2].testo, '2 sessioni di formazione collettiva su postura ed ergonomia, da un\'ora; analisi ergonomica delle postazioni di lavoro, con indicazioni pratiche e personalizzate.');
  assert.equal(p[3].testo, '4 report nell\'anno (di Attivazione, al mese 3, al mese 6 e annuale).');
  assert.ok(!/analisi ergonomica/.test(pianoPerLivello({ ergonomia: false })[2].testo), 'senza ergonomia nel prezzo non si promette');
  assert.ok(!p.some(r => /giornat|sedut/.test(r.testo)));
});

test('prossimi passi: prima l\'accettazione dell\'offerta, poi il contratto entro 15 giorni (27/9)', () => {
  const p = prossimiPassi();
  assert.equal(p.length, 6);
  assert.equal(p[0], 'Accettazione dell\'offerta: la firma in fondo all\'Offerta.');
  assert.equal(p[1], 'Firma del contratto, entro 15 giorni dall\'accettazione.');
  assert.match(p[5], /^Review al mese 3 per chi ha iniziato un percorso, di trattamento \(Livello 1\) o di prevenzione \(Livello 2\); al mese 6 nuovo check-up di tutta la popolazione/);
  // la data è quella stampata in fondo all'Offerta, con l'articolo giusto
  assert.equal(prossimiPassi({ scadenzaOfferta: '2026-10-07' })[0], 'Accettazione dell\'offerta: la firma in fondo all\'Offerta, entro il 7 ottobre 2026.');
  assert.equal(prossimiPassi({ scadenzaOfferta: '2026-10-08' })[0], 'Accettazione dell\'offerta: la firma in fondo all\'Offerta, entro l\'8 ottobre 2026.');
  // chi ha firmato parte dal calendario
  assert.equal(prossimiPassi({ firmato: true, scadenzaOfferta: '2026-10-08' })[0], 'Calendario: date di sportello e formazione, spazio riservato, referente operativo.');
  assert.equal(prossimiPassi({ firmato: true }).length, 4);
});

test('slide: niente prezzo per dipendente, niente etichette ripetute, leve senza commercialista, ultima slide', () => {
  const pag = src('pages/dashboard/presentazione/[clientId].js');
  assert.ok(!/per dipendente/.test(pag));
  assert.ok(!/d\.voci\.map/.test(pag));
  assert.match(pag, /function ProssimiPassi/);
  assert.match(pag, /const unica = voci\.length === 1;/);
  assert.ok(!/Da confermare con il vostro commercialista/.test(src('lib/leve.js').replace(/\/\/.*$/gm, '')));
});

test('Stima: la registra solo il pulsante; scaricare, inviare e il riepilogo no', () => {
  const api = src('pages/api/stima.js');
  assert.ok(!/store: b\.store/.test(api), 'il PDF non registra');
  assert.equal((api.match(/registra: !!b\.registra/g) || []).length, 2);
  assert.equal((api.match(/if \(b\.registra && b\.clientId\) await avanzaPipeline/g) || []).length, 2);
  const pagina = src('pages/dashboard/stima.js');
  assert.match(pagina, /Registra Stima/);
  assert.equal((pagina.match(/buildBody\(true\)/g) || []).length, 3, 'scarica, invia e riepilogo: solo PDF');
  assert.match(pagina, /buildBody\(false, variante, true\)/);
});

test('lessico nei report e nella presentazione: «trattamenti», mai «sedute»', () => {
  for (const f of ['lib/programma.js', 'lib/regole-report.mjs', 'lib/presentazione-testi.mjs', 'lib/movimento.js', 'pages/api/clients/[id]/generate-activation-report.js', 'pages/api/clients/[id]/generate-checkpoint-report.js']) {
    const testo = src(f).split('\n').filter(r => !/^\s*\/\//.test(r)).join('\n');
    const pulito = testo.replace(/sedute_per_ciclo|seduteErogate|divisioneSedute|oreSedute|durata_seduta_min/g, '').replace(/MAI «seduta\/sedute»/g, '');
    assert.ok(!/\bsedut[ae]\b/i.test(pulito), f);
  }
});
