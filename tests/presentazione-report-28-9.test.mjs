// La presentazione nasce dal Report di Attivazione (Enrico, 28/9): ne riassume le voci con
// i riassunti scritti nella stessa chiamata del Report (v81), accanto ai numeri.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { separaPresentazione, riassuntiValidi, istruzioniPresentazione, SEPARATORE_PRESENTAZIONE, VOCI_PRESENTAZIONE } from '../lib/presentazione-report.mjs';
import { controllaTesto } from '../lib/controllo-report.mjs';
import { ambitoAzienda } from '../lib/presentazione-testi.mjs';

const src = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const buoni = { executive: ['Il check-up ha coinvolto 9 dipendenti su 12.', 'Il programma proposto parte da questi dati.'], mappa: ['Collo e schiena bassa sono le zone più colpite.'], piano: ['Cicli di trattamento per il Livello 1.', 'Formazione per tutti.'], raccomandazioni: ['Formazione sulle zone più colpite.', 'Review al mese 3.'] };

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

test('riassunti ben formati o niente: tutte e quattro le voci, frasi brevi, senza markup', () => {
  assert.deepEqual(VOCI_PRESENTAZIONE.map(v => v.chiave), ['executive', 'mappa', 'piano', 'raccomandazioni']);
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
  assert.match(istruzioniPresentazione(), /Niente cifre in euro/);
  assert.match(src('lib/controllo-report.mjs'), /correzione \? `\$\{richiestaCorrezione\(problemi\)\}\\n\$\{correzione\}`/);
  // senza la v81 il Report si salva lo stesso, senza perdere prezzo e persone a contratto
  const store = src('lib/store.js');
  assert.match(store, /if \(error && fields\.presentazione !== undefined\) \{\n\s+const \{ presentazione, \.\.\.senza \} = fields;/);
  assert.match(src('supabase-schema-v81-presentazione-report.sql'), /ALTER TABLE public\.generated_reports ADD COLUMN IF NOT EXISTS presentazione jsonb;/);
});

test('presentazione: dal Report, 9 schermate, niente prezzo; «da rivedere» o senza riassunti non parte', () => {
  const pag = src('pages/dashboard/presentazione/[clientId].js');
  const ordine = ["id: 'copertina'", "id: 'sintesi'", "id: 'zone'", "id: 'livelli'", "id: 'piano'", "id: 'raccomandazioni'", "id: 'impatto'", "id: 'prossimi'", "id: 'grazie'"];
  const pos = ordine.map(t => pag.indexOf(t));
  assert.ok(pos.every(p => p > 0), JSON.stringify(pos));
  assert.deepEqual([...pos].sort((a, b) => a - b), pos);
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
