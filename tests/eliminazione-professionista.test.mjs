import test from 'node:test';
import assert from 'node:assert/strict';
import { TABELLE_TRACCE, esitoTracce, messaggioTracce } from '../lib/eliminazione-professionista.mjs';

const tuttiZero = () => Object.fromEntries(TABELLE_TRACCE.map(t => [t.tabella, 0]));

test('nessuna traccia in nessuna tabella: eliminabile', () => {
  const e = esitoTracce(tuttiZero());
  assert.equal(e.eliminabile, true);
  assert.deepEqual(e.elementi, []);
});

test('un solo login (una riga nel registro) basta a impedire l\'eliminazione', () => {
  const e = esitoTracce({ ...tuttiZero(), access_logs: 1 });
  assert.equal(e.eliminabile, false);
  assert.deepEqual(e.elementi, [{ etichetta: 'accessi registrati', n: 1 }]);
});

test('ogni tabella conta, comprese quelle senza chiave esterna', () => {
  for (const { tabella } of TABELLE_TRACCE) {
    assert.equal(esitoTracce({ ...tuttiZero(), [tabella]: 1 }).eliminabile, false, tabella);
  }
});

test('le colonne che puntano a un professionista ci sono tutte', () => {
  const chiavi = TABELLE_TRACCE.map(t => `${t.tabella}.${t.colonna}`).sort();
  assert.deepEqual(chiavi, [
    'access_logs.professional_id', 'accordi_trattamento_file.professional_id', 'acute_events.professional_id',
    'anamnesi_integrazioni.professional_id', 'copie_cartacee.professional_id', 'email_log.professional_id',
    'patient_documents.professional_id', 'patients.assigned_professional_id', 'pre_validations.professional_id',
    'pro_document_access_log.professional_id', 'pro_documents.professional_id', 'sessions.professional_id',
    'treatment_cycles.professional_id', 'waitlist.assigned_professional_id',
  ]);
});

test('nel dubbio si conserva: un conteggio mancante o non valido blocca', () => {
  const senza = tuttiZero(); delete senza.copie_cartacee;
  assert.equal(esitoTracce(senza).eliminabile, false);
  assert.equal(esitoTracce(senza).dubbio, true);
  assert.equal(esitoTracce({ ...tuttiZero(), sessions: null }).eliminabile, false);
  assert.equal(esitoTracce({ ...tuttiZero(), sessions: -1 }).eliminabile, false);
  assert.equal(esitoTracce(null).eliminabile, false);
});

test('il messaggio dice cosa c\'è e che resta solo la disattivazione', () => {
  const e = esitoTracce({ ...tuttiZero(), sessions: 352, access_logs: 57 });
  const m = messaggioTracce(e, { nome: 'Mario Rossi', attivo: true });
  assert.match(m, /Mario Rossi ha lasciato traccia/);
  assert.match(m, /sedute \(352\), accessi registrati \(57\)/);
  assert.match(m, /Si può solo disattivare/);
});

test('se è già disattivato il messaggio non chiede di disattivarlo', () => {
  const e = esitoTracce({ ...tuttiZero(), access_logs: 2 });
  const m = messaggioTracce(e, { nome: 'Mario Rossi', attivo: false });
  assert.match(m, /È già disattivato/);
  assert.doesNotMatch(m, /Si può solo disattivare/);
});

test('messaggio del dubbio', () => {
  const m = messaggioTracce(esitoTracce(null), { nome: 'Mario Rossi' });
  assert.match(m, /nel dubbio si conserva/);
});
