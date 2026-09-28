// La presentazione nasce dal Report di Attivazione (Enrico, 28/9): ne riassume le voci con
// i riassunti scritti nella stessa chiamata del Report (v81), accanto ai numeri.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { separaPresentazione, riassuntiValidi, istruzioniPresentazione, SEPARATORE_PRESENTAZIONE, VOCI_PRESENTAZIONE } from '../lib/presentazione-report.mjs';
import { controllaTesto } from '../lib/controllo-report.mjs';
import { ambitoAzienda } from '../lib/presentazione-testi.mjs';

const src = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const buoni = { executive: ['Il check-up ha coinvolto 9 dipendenti su 12.', 'Il programma proposto parte da questi dati.'], mappa: ['Collo e schiena bassa sono le zone più colpite.'], piano: ['Cicli di trattamento per il Livello 1.', 'Formazione per tutti.'] };

test('riassunti: si separano dal report, il report resta com\'era', () => {
  const testo = `## Executive Summary\n\nTesto.\n\n## Raccomandazioni Cliniche\n\n1. Una.\n\n${SEPARATORE_PRESENTAZIONE}\n\`\`\`json\n${JSON.stringify(buoni)}\n\`\`\`\n`;
  const { report, presentazione } = separaPresentazione(testo);
  assert.equal(report, '## Executive Summary\n\nTesto.\n\n## Raccomandazioni Cliniche\n\n1. Una.');
  assert.deepEqual(presentazione, buoni);
  // senza separatore: report intero, niente riassunti
  assert.deepEqual(separaPresentazione('## Executive Summary\n\nTesto.'), { report: '## Executive Summary\n\nTesto.', presentazione: null });
  // JSON rotto: niente riassunti, il report resta
  const rotto = separaPresentazione(`Testo.\n${SEPARATORE_PRESENTAZIONE}\n{"executive": [`);
  assert.equal(rotto.report, 'Testo.');
  assert.equal(rotto.presentazione, null);
});

test('riassunti ben formati o niente: le tre voci, frasi brevi, senza markup, senza euro (28/9)', () => {
  // le raccomandazioni restano nel Report: «sono per me più che per loro»
  assert.deepEqual(VOCI_PRESENTAZIONE.map(v => v.chiave), ['executive', 'mappa', 'piano']);
  // niente valori economici: la frase del primo Report di Weisoft si scarta, anche già salvata
  const weisoft = riassuntiValidi({ ...buoni, executive: ['Check-up completato da 9 dipendenti su 12, adesione 75%.', 'Programma proposto con investimento Anno 1 di €5.576, dimensionato su 12 dipendenti.'] });
  assert.deepEqual(weisoft.executive, ['Check-up completato da 9 dipendenti su 12, adesione 75%.']);
  assert.equal(riassuntiValidi({ ...buoni, piano: ['Investimento di 5.576 euro.'] }), null, 'una voce che resta vuota: si rigenera');
  assert.match(istruzioniPresentazione(), /VIETATO citare l'investimento, il prezzo o cifre in euro/);
  assert.equal(riassuntiValidi({ ...buoni, piano: [] }), null);
  assert.equal(riassuntiValidi({ executive: buoni.executive }), null);
  assert.equal(riassuntiValidi({ ...buoni, mappa: ['x'.repeat(400)] }), null);
  assert.equal(riassuntiValidi(null), null);
  assert.deepEqual(riassuntiValidi({ ...buoni, mappa: ['**Collo** e schiena.'] }).mappa, ['Collo e schiena.']);
});

test('i riassunti passano lo stesso controllo del report: un numero inventato si vede anche lì', () => {
  const testo = `## Executive Summary\n\n9 dipendenti.\n\n${SEPARATORE_PRESENTAZIONE}\n${JSON.stringify({ ...buoni, executive: ['Il 37% è in Livello 1.'] })}`;
  const problemi = controllaTesto(testo, { dati: 'questionari: 9, dipendenti 12' });
  assert.ok(problemi.some(p => /37/.test(p)), problemi.join(' | '));
});

test('il Report li chiede, li separa, li salva; la correzione li riscrive insieme', () => {
  const gen = src('pages/api/clients/[id]/generate-activation-report.js');
  assert.match(gen, /Non più di 800 parole totali\.\n\$\{istruzioniPresentazione\(\)\}`;/);
  assert.match(gen, /correzione: CORREZIONE_PRESENTAZIONE/);
  assert.match(gen, /const \{ report: testo, presentazione \} = separaPresentazione\(testoAi\);/);
  assert.match(gen, /quote_compliance: quoteCompliance, presentazione \}/);
  assert.match(src('lib/controllo-report.mjs'), /correzione \? `\$\{richiestaCorrezione\(problemi\)\}\\n\$\{correzione\}`/);
  // senza la v81 il Report si salva lo stesso, senza perdere prezzo e persone a contratto
  const store = src('lib/store.js');
  assert.match(store, /if \(error && fields\.presentazione !== undefined\) \{\n\s+const \{ presentazione, \.\.\.senza \} = fields;/);
  assert.match(src('supabase-schema-v81-presentazione-report.sql'), /ALTER TABLE public\.generated_reports ADD COLUMN IF NOT EXISTS presentazione jsonb;/);
});

test('presentazione: dal Report, niente prezzo né raccomandazioni; cruscotto e colori; «da rivedere» o senza riassunti non parte', () => {
  const pag = src('pages/dashboard/presentazione/[clientId].js');
  const ordine = ["id: 'copertina'", "id: 'sintesi'", "id: 'zone'", "id: 'livelli'", "id: 'piano'", "id: 'impatto'", "id: 'prossimi'"];
  const pos = ordine.map(t => pag.indexOf(t));
  assert.ok(pos.every(p => p > 0), JSON.stringify(pos));
  assert.deepEqual([...pos].sort((a, b) => a - b), pos);
  assert.ok(!/raccomandazioni/.test(pag.replace(/^\s*\/\/.*$/gm, '')), 'le raccomandazioni restano nel Report');
  // il cruscotto nella pagina 2, i colori del Report nelle zone (28/9)
  assert.match(pag, /<div className="mb-8"><Cruscotto d=\{d\} \/><\/div>/);
  assert.match(pag, /background: TL_COLOR\[trafficLight\('zona', z\.pct12\)\]/);
  assert.ok(!/function Preventivo|d\.prezzo\.y1\)\}<\/div>|DICITURA_IVA/.test(pag), 'il prezzo si presenta con la proposta');
  assert.match(pag, /const bloccata = senzaRiassunti \|\| daRivedere;/);
  assert.match(pag, /const daRivedere = R\.stato === 'ai_da_rivedere' && !validato;/);
  assert.match(pag, /disabled=\{bloccata\}/);
  assert.match(pag, /\/api\/clients\/\$\{d\.clientId\}\/reports\/\$\{R\.id\}\/valida/);
  assert.match(pag, /✅ Valido questo report/);
  // alla pagina solo ciò che mostra: niente testo intero del Report
  const srv = src('lib/presentazione-server.js');
  assert.match(srv, /riassunti: riassuntiValidi\(rep\.presentazione\),/);
  assert.ok(!/content_text/.test(srv));
  assert.equal(ambitoAzienda(1), 'Manifattura / Produzione');
  assert.equal(ambitoAzienda(2), 'Ufficio / IT / Servizi');
});

test('proposta di intervento a slide: dopo i prossimi passi con un clic, e da «Mostra al cliente» (28/9)', () => {
  const sp = src('components/presentazione/SlideProposta.jsx');
  const ordine = ["id: 'p-copertina'", "id: 'p-programma'", "id: 'p-comprende'", "id: 'p-investimento'", "id: 'p-leve'", "id: 'p-accettazione'"];
  const pos = ordine.map(t => sp.indexOf(t));
  assert.ok(pos.every(p => p > 0), JSON.stringify(pos));
  assert.deepEqual([...pos].sort((a, b) => a - b), pos);
  // la forbice si mostra solo con il prezzo dentro: fuori, il cliente vede il totale
  assert.match(sp, /if \(f && p\.inRange === true\) \{/);
  const pag = src('pages/dashboard/presentazione/[clientId].js');
  // in fondo a tutto «Grazie per l'attenzione» (28/9)
  assert.match(pag, /const schermate = R \? \[\.\.\.slideReport, \.\.\.proposta, SLIDE_GRAZIE\] : \[\];/);
  assert.match(pag, /<StampaSlide schermate=\{\[\.\.\.slideReport, SLIDE_GRAZIE\]\} \/>/);
  assert.match(src('components/presentazione/slide.jsx'), /Grazie per l&apos;attenzione/);
  // la proposta segue solo se porta il prezzo del Report e il contratto non è firmato
  const srv = src('lib/presentazione-server.js');
  assert.match(srv, /: firmato \? 'firmato'\n\s+: prezzoReport != null && Math\.round\(prezzoReport\) !== Math\.round\(prezzo\.y1\) \? 'prezzo_diverso'/);
  assert.match(srv, /leve: leveEconomicheSlide\(t\.leve\.economiche\),/);
  assert.ok(!/content_text/.test(srv));
  const offer = src('pages/dashboard/offer.js');
  assert.match(offer, /const schermateCliente = slideCliente\.length \? \[\.\.\.slideCliente, SLIDE_GRAZIE\] : \[\];/);
  assert.match(offer, /passi: condivisi && !condivisi\.pacchetto && !firmato \? prossimiPassi\(\{ scadenzaOfferta: scadenza \}\)\.slice\(0, 2\) : null,/);
});

test('i due tasti su entrambe: PDF / Stampa e Invia al referente (28/9)', () => {
  const pag = src('pages/dashboard/presentazione/[clientId].js');
  assert.match(pag, /🖨 PDF \/ Stampa/);
  assert.match(pag, /✉ Invia al referente/);
  assert.match(pag, /<EmailModal modal=\{mail\} allegato="la presentazione"/);
  const offer = src('pages/dashboard/offer.js');
  assert.match(offer, /🖨 PDF \/ Stampa/);
  assert.match(offer, /✉ Invia al referente/);
  const slide = src('components/presentazione/slide.jsx');
  assert.match(slide, /@page \{ size: A4 landscape; margin: 0; \}/);
  assert.match(slide, /\.stampa-slide \.foglio \{ width: 297mm; height: 210mm;/);
});

test('executive: non ripete adesione e prevalenza, che la slide mostra già come numeri (28/9)', () => {
  assert.match(istruzioniPresentazione(), /executive: la slide mostra già, come numeri, l'adesione al check-up e la prevalenza dei disturbi: non ripeterle\./);
});

test('legenda dei colori su una riga sola, nelle due slide (28/9)', () => {
  const slide = src('components/presentazione/slide.jsx');
  assert.match(slide, /<div className="flex flex-nowrap gap-x-6 text-gray-500" style=\{\{ fontSize: 'clamp\(11px, 1\.05vw, 15px\)' \}\}>/);
  assert.match(slide, /className="flex items-center gap-2 whitespace-nowrap"/);
  // nella pagina 2 fuori dal riquadro dei livelli (largo 1024 px), a tutta larghezza
  assert.match(src('pages/dashboard/presentazione/[clientId].js'), /<div className=\{`max-w-5xl grid gap-4 /);
  assert.ok(!/Welfare aziendale', testo/.test(src('lib/leve.js')), 'welfare tolto');
});

test('colore fisso del livello ovunque, anche nei cruscotti: Livello 1 sempre rosso (28/9, strada A)', async () => {
  const { CARTE_LIVELLO } = await import('../lib/livelli.js');
  assert.deepEqual(['l1', 'l2', 'l3'].map(k => CARTE_LIVELLO[k].semaforo), ['red', 'yellow', 'green']);
  const { TL_COLOR } = await import('../lib/scoring.js');
  assert.deepEqual(['l1', 'l2', 'l3'].map(k => CARTE_LIVELLO[k].color), [TL_COLOR.red, TL_COLOR.yellow, TL_COLOR.green], 'scheda e cruscotto, stesso colore');
  // nessun cruscotto colora più il Livello 1 in base alla percentuale
  for (const f of ['pages/dashboard/presentazione/[clientId].js', 'pages/dashboard/offer.js', 'components/ReportView.jsx']) {
    assert.ok(!/trafficLight\('nmq'|type="nmq"|type: 'nmq'/.test(src(f)), f);
  }
  assert.match(src('components/ReportView.jsx'), /<Semaphore key=\{c\.key\} colore=\{CARTE_LIVELLO\[c\.key\]\.semaforo\}/);
});

test('slide della proposta: l\'OT23 tra le leve, accanto alla deducibilità; nel documento resta la voce 12 (28/9)', async () => {
  const { leveEconomiche, leveEconomicheSlide, leveEconomichePreventivo } = await import('../lib/leve.js');
  const { TESTO_OT23_IN_VERIFICA } = await import('../lib/ot23-stato.mjs');
  const tutte = leveEconomiche({});
  assert.deepEqual(leveEconomicheSlide(tutte).map(l => l.id), ['ot23', 'deducibilita']);
  assert.equal(leveEconomicheSlide(tutte)[0].testo, TESTO_OT23_IN_VERIFICA, 'il testo «in verifica», senza percentuali');
  assert.ok(!/\d+\s?%/.test(leveEconomicheSlide(tutte)[0].testo));
  // il documento A4 non la ripete: c'è già la voce 12 con lo stesso testo
  assert.deepEqual(leveEconomichePreventivo(tutte, { conVoceOT23: true }).map(l => l.id), ['deducibilita']);
  const offer = src('pages/dashboard/offer.js');
  assert.match(offer, /slide: leveEconomicheSlide\(t\.leve\.economiche\) \}/);
  assert.match(offer, /leve: \(condivisi && condivisi\.leve && condivisi\.leve\.slide\) \|\| leveEconomiche,/);
});
