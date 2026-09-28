// Revisione del preventivo (Enrico, 28/9): il preventivo è il documento che si firma, la
// presentazione quello che racconta. Niente ripetizioni; la Sintesi tolta dappertutto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { leveEconomiche, leveEconomichePreventivo } from '../lib/leve.js';
import { VOCI_PROGRAMMA, RIGA_REPORT_ANNO, quantitaPrimoAnno } from '../lib/programma.js';
import { pianoPerLivello } from '../lib/presentazione-testi.mjs';

const src = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const esiste = (p) => fs.existsSync(new URL(`../${p}`, import.meta.url));
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

test('la Sintesi non esiste più: niente pagina, niente PDF, niente collegamenti', () => {
  assert.ok(!esiste('pages/dashboard/sintesi/[clientId].js'));
  assert.ok(!esiste('pages/api/clients/[id]/sintesi.js'));
  assert.ok(!esiste('lib/sintesi.js'));
  for (const f of ['pages/dashboard/offer.js', 'pages/dashboard/[clientId].js', 'pages/dashboard/presentazione/[clientId].js']) {
    assert.ok(!/\/dashboard\/sintesi\//.test(src(f)), `${f}: collegamento alla Sintesi`);
  }
  assert.ok(!/buildSintesiHtml|prossimoPassoInBreve/.test(src('lib/dati-sanitari.js') + src('lib/presentazione-testi.mjs') + src('lib/presentazione-server.js')));
  // i dati del medico competente restano
  assert.match(src('lib/medico-competente-server.js'), /import\('\.\/dati-sanitari'\)/);
});

test('pagina del preventivo: niente Presenta/Sintesi, niente avviso di Chrome, «Mostra al cliente»', () => {
  const offer = src('pages/dashboard/offer.js');
  assert.ok(!/\/dashboard\/presentazione\//.test(offer));
  assert.ok(!/Per un PDF pulito/.test(offer));
  assert.ok(!/Scadenza proposta dal Listino/.test(offer));
  assert.match(offer, /🖥 Mostra al cliente/);
  // in modalità cliente spariscono i riquadri di lavoro e l'argomentario
  assert.match(offer, /\{!cliente && \(\n\s+<div className="no-print px-6 pt-4 pb-2">/);
  // l'argomentario in un riquadro vicino a «Mostra al cliente», non a lato (28/9)
  assert.ok(!/<aside/.test(offer));
  assert.match(offer, /🖥 Mostra al cliente\n\s+<\/button>\n[\s\S]{0,800}📖 Argomentario/);
  assert.match(offer, /\{conArgomentario && <div className="mb-2"><ArgomentarioVoci aperto \/><\/div>\}/);
  // in stampa il documento resta A4, a schermo si allarga
  assert.match(offer, /\.offer-doc \{ zoom: 1 !important; \}/);
  assert.match(offer, /@media screen \{ \.offer-doc \{ zoom: var\(--zoom-doc, 1\); \}/);
});

test('documento: cruscotto, programma, investimento con le leve, accettazione — in quest\'ordine', () => {
  const doc = senzaCommenti(src('pages/dashboard/offer.js'));
  assert.ok(!/Piattaforma digitale ES Work/.test(doc), 'riquadro piattaforma tolto (resta la voce 11)');
  const ordine = ['Cruscotto sintetico</div>', 'Il vostro programma nel primo anno</div>', 'Cosa comprende il programma</div>', '>Investimento</div>', 'Le leve economiche</div>', 'Accettazione della proposta</div>'];
  const pos = ordine.map(t => doc.indexOf(t));
  assert.ok(pos.every(p => p > 0), JSON.stringify(pos));
  assert.deepEqual([...pos].sort((a, b) => a - b), pos);
  assert.match(doc, /'Accettazione della proposta',/);
  assert.match(src('pages/dashboard/offer.js'), /leveEconomichePreventivo\(t\.leve\.economiche, \{ conVoceOT23: t\.nuovoProgramma \}\)/);
});

test('leve nel preventivo: senza il tempo (è nell\'investimento) e senza l\'OT23 quando c\'è la voce 12', () => {
  const tutte = leveEconomiche({ giorniMsk: 40 });
  assert.deepEqual(tutte.map(l => l.id), ['ot23', 'deducibilita', 'assenze', 'welfare', 'tempo']);
  assert.deepEqual(leveEconomichePreventivo(tutte).map(l => l.id), ['deducibilita', 'assenze', 'welfare']);
  assert.deepEqual(leveEconomichePreventivo(tutte, { conVoceOT23: false }).map(l => l.id), ['ot23', 'deducibilita', 'assenze', 'welfare']);
});

test('mail dell\'offerta: niente elenco del programma né «prossimi passi»; importo, validità, 15 giorni', () => {
  const offer = src('pages/dashboard/offer.js');
  const mail = offer.slice(offer.indexOf('function openOfferEmail()'), offer.indexOf('const STILE_SEM'));
  assert.ok(!/prossimi passi|in sintesi|condivisi\.piano/.test(mail), mail);
  assert.match(mail, /grazie per il tempo che ci ha dedicato alla presentazione dei risultati del check-up/);
  assert.match(mail, /entro \$\{GIORNI_FIRMA_CONTRATTO\} giorni dall'accettazione/);
  assert.match(mail, /subject: `Proposta di intervento ES Work — \$\{client\.name\}`/);
  assert.match(offer, /La mail non allega il documento da sola/);
  // «S.p.A.» non diventa «S.p.A..» (prova su Officine, 28/9)
  assert.match(mail, /\$\{client\.name\}\$\{\/\\\.\$\/\.test\(client\.name\) \? '' : '\.'\}/);
  // la nota sulla Pipeline dice il vero: solo in avanti, come registraOffertaInviata
  assert.match(offer, /avanzamento\(normalizza\(stage\), 'offer_open'\)/);
});

test('«Cosa comprende» allineato ai passi della presentazione; argomentario senza cose non vere', () => {
  const v = (n) => VOCI_PROGRAMMA.find(x => x.n === n);
  assert.ok(!/giornat/i.test(v(3).cliente), v(3).cliente);
  assert.match(v(4).cliente, /con misura del dolore prima e dopo ogni trattamento/);
  assert.equal(v(8).nome, 'Review al mese 3 e check-up al mese 6');
  assert.match(v(8).cliente, /^Al mese 3 review con chi ha iniziato un percorso, di trattamento \(Livello 1\) o di prevenzione \(Livello 2\); al mese 6 nuovo check-up di tutta la popolazione/);
  const arg = VOCI_PROGRAMMA.map(x => x.argomentario).join(' ');
  for (const vietato of [/mappe corporee/, /riduzione del mal di schiena/, /l'unica voce che tocca il 100%/, /la prevalenza si è mantenuta sotto l'atteso/, /entro marzo/]) {
    assert.ok(!vietato.test(arg), `argomentario: ${vietato}`);
  }
  assert.match(v(2).argomentario, /le zone del corpo più colpite/);
  assert.equal(RIGA_REPORT_ANNO, '4 report nell\'anno (di Attivazione, al mese 3, al mese 6 e annuale)');
  assert.equal(pianoPerLivello()[3].testo, `${RIGA_REPORT_ANNO}.`);
  assert.equal(quantitaPrimoAnno({ y1: {}, l1: 0, l2: 0 }).at(-1), RIGA_REPORT_ANNO);
});

test('«proposta di intervento» ovunque: niente «offerta» in ciò che legge il cliente (28/9)', async () => {
  const { testoAccettazione, prossimiPassi } = await import('../lib/presentazione-testi.mjs');
  const { fraseValidita, testoSollecitoOfferta } = await import('../lib/offerta.js');
  const { STAGES } = await import('../lib/pipeline.js');
  const testi = [
    ...Object.values(testoAccettazione({ importo: '€5.576', iva: 'IVA', scadenza: '2026-10-08' })),
    ...prossimiPassi({ scadenzaOfferta: '2026-10-08' }),
    fraseValidita('2026-10-08'),
    ...Object.values(testoSollecitoOfferta({ azienda: 'X', referente: 'Y', inviataIl: '2026-09-28', scadeIl: '2026-10-08' })),
  ].join(' ');
  assert.ok(!/offert/i.test(testi), testi);
  assert.match(prossimiPassi()[0], /^Accettazione della proposta di intervento: la firma in fondo al documento\.$/);
  assert.equal(STAGES.find(s => s.id === 'offer_open').label, 'Proposta aperta');
  const offer = senzaCommenti(src('pages/dashboard/offer.js'));
  for (const vecchio of [/Invia offerta via email/, /Accettazione offerta/, /Validità dell&apos;offerta/, /«Offerta aperta»/]) assert.ok(!vecchio.test(offer), String(vecchio));
  assert.match(src('pages/dashboard/[clientId].js'), /📄 Proposta di intervento\{reportDopo\(a\) \? '' : ' \(bozza\)'\}/);
});

test('flusso: la proposta nasce dal Report (bozza prima, stesso prezzo dopo); la presentazione solo con il Report (28/9)', () => {
  const offer = src('pages/dashboard/offer.js');
  assert.match(offer, /const pronta = !!\(reportAttivazione && !prezzoDiverso\);/);
  assert.match(offer, /reportAttivazione\.prezzo != null && Math\.round\(reportAttivazione\.prezzo\) !== Math\.round\(calc\.price_y1\)/);
  for (const b of ['onClick={() => window.print()} disabled={!pronta}', 'onClick={openOfferEmail} disabled={!pronta}', 'onClick={mostraAlCliente} disabled={!pronta}']) assert.ok(offer.includes(b), b);
  assert.match(offer, /BOZZA — NON VALIDA COME PROPOSTA DI INTERVENTO/);
  // alla pagina solo data e prezzo del Report
  assert.match(offer, /const reportAttivazione = rep \? \{ il: rep\.created_at, prezzo: /);
  const pres = src('pages/dashboard/presentazione/[clientId].js');
  assert.match(pres, /if \(d && !d\.errore && !d\.reportAttivazione\)/);
  assert.match(src('pages/dashboard/[clientId].js'), /a\.id === sortedAssessments\[0\]\.id && reportDopo\(a\) && \(/);
});
