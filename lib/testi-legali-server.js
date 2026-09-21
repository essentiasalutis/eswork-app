// ─────────────────────────────────────────────────────────────────────────────
// Archivio dei testi legali e registro dei consensi — accesso dal server.
// Regole pure in lib/testi-legali.mjs; garanzie dure nella banca dati (v64).
//
// Tre principi:
//   · il testo si legge SOLO da qui (nessuna copia nel codice);
//   · a ogni lettura si ricontrolla che contenuto e impronta tornino: un testo
//     alterato non si serve;
//   · la versione registrata su un consenso la decide il server.
// ─────────────────────────────────────────────────────────────────────────────
import crypto from 'crypto';
import supabase from './db';
import { testoCanonico, versioneAccettabile, consensiMancanti, DOCUMENTI } from './testi-legali.mjs';

const sha256 = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');

function verifica(riga) {
  if (!riga) return null;
  const canonico = testoCanonico(riga.contenuto);
  if (canonico !== riga.testo_canonico || sha256(canonico) !== riga.impronta) {
    // Non si serve un testo che non corrisponde alla sua impronta: meglio una
    // pagina ferma che un consenso registrato contro un testo diverso.
    throw new Error(`Testo legale ${riga.codice} ${riga.versione}: contenuto e impronta non coincidono`);
  }
  return riga;
}

const CAMPI = 'id, codice, titolare, versione, contenuto, testo_canonico, impronta, stato, pubblicato_il, ritirato_il';

// La versione in vigore di un documento, verificata. Per mostrarla a schermo.
export async function testoInVigore(codice) {
  const { data, error } = await supabase.from('testi_legali').select(CAMPI)
    .eq('codice', codice).eq('stato', 'in_vigore').maybeSingle();
  if (error) throw error;
  return verifica(data);
}

// Quello che serve al browser: il testo e l'identificativo da rimandare. Niente
// testo canonico (si ricostruisce), niente altro.
export function perIlBrowser(riga) {
  if (!riga) return null;
  return { id: riga.id, codice: riga.codice, versione: riga.versione, impronta: riga.impronta, contenuto: riga.contenuto };
}

// Una versione rimandata dal browser: si accetta solo se è quella in vigore o
// appena ritirata. Ritorna la riga d'archivio, oppure null.
export async function testoAccettabile(id, codiceAtteso) {
  if (!id || typeof id !== 'string') return null;
  const { data, error } = await supabase.from('testi_legali').select(CAMPI).eq('id', id).maybeSingle();
  if (error || !data || data.codice !== codiceAtteso) return null;
  if (!versioneAccettabile(data)) return null;
  return verifica(data);
}

// Registra i consensi di una schermata, UNA RIGA PER CONSENSO. I valori sono
// quelli delle caselle; ciascuno obbligatorio deve essere `true` esplicito.
// Ritorna { ok, sessione_id } oppure { ok:false, errore }.
export async function registraConsensiSessione({ codice, testoId, valori, canale, ipHash, userAgent }) {
  const testo = await testoAccettabile(testoId, codice);
  if (!testo) return { ok: false, errore: 'versione_non_valida' };
  const mancanti = consensiMancanti(codice, valori);
  if (mancanti.length) return { ok: false, errore: 'consensi_mancanti', mancanti };

  const sessione_id = crypto.randomBytes(24).toString('hex');
  const adesso = new Date().toISOString();
  const righe = DOCUMENTI[codice].consensi.map(consenso => ({
    id: `cr_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`,
    soggetto_tipo: 'paziente', soggetto_id: null, sessione_id,
    consenso, valore: 'dato',
    testo_legale_id: testo.id, codice: testo.codice, versione: testo.versione, impronta: testo.impronta,
    atto_at: adesso, canale, ip_hash: ipHash || null, user_agent: userAgent || null,
  }));
  const { error } = await supabase.from('consensi_registrati').insert(righe);
  if (error) throw error;
  return { ok: true, sessione_id, versione: testo.versione };
}

// Alla consegna del check-up: la sessione dei consensi deve esistere, essere
// recente, completa e non ancora collegata. Ritorna le righe o null.
export async function sessioneConsensiValida(sessioneId, codice, maxOre = 24) {
  if (!sessioneId || typeof sessioneId !== 'string' || sessioneId.length < 32) return null;
  const { data, error } = await supabase.from('consensi_registrati')
    .select('id, consenso, valore, versione, atto_at, codice, soggetto_id, canale')
    .eq('sessione_id', sessioneId).is('soggetto_id', null);
  if (error || !data || !data.length) return null;
  const limite = Date.now() - maxOre * 3600000;
  if (data.some(r => r.codice !== codice || r.valore !== 'dato' || new Date(r.atto_at).getTime() < limite)) return null;
  const dati = Object.fromEntries(data.map(r => [r.consenso, true]));
  if (consensiMancanti(codice, dati).length) return null;
  return data;
}

// Collega la sessione al paziente appena creato (l'unico aggiornamento ammesso).
export async function collegaSessioneAPaziente(sessioneId, patientId) {
  const { error } = await supabase.from('consensi_registrati')
    .update({ soggetto_id: patientId }).eq('sessione_id', sessioneId).is('soggetto_id', null);
  if (error) throw error;
}

// Firma in cartella: la riga d'archivio si sceglie dal server; l'impronta è quella
// del testo archiviato, MAI calcolata su un testo arrivato dal browser.
export async function testiPerFirmaInCartella() {
  const [consenso, informativa] = await Promise.all([
    testoInVigore('consenso_trattamento'),
    testoInVigore('informativa_estesa'),
  ]);
  return { consenso, informativa };
}

// Registra un consenso già legato al soggetto (firma in cartella): una riga per
// documento, contro la versione d'archivio scelta dal server.
export async function registraConsensoSoggetto({ soggettoTipo = 'paziente', soggettoId, testo, consenso, canale, ipHash, userAgent, nota = null }) {
  const riga = {
    id: `cr_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`,
    soggetto_tipo: soggettoTipo, soggetto_id: soggettoId, sessione_id: null,
    consenso, valore: 'dato',
    testo_legale_id: testo.id, codice: testo.codice, versione: testo.versione, impronta: testo.impronta,
    canale, ip_hash: ipHash || null, user_agent: userAgent || null, nota,
  };
  const { error } = await supabase.from('consensi_registrati').insert(riga);
  if (error) throw error;
  return riga;
}

// Un testo d'archivio per identificativo, verificato (qualunque stato): serve a
// ristampare ESATTAMENTE la versione firmata, anche se oggi è ritirata.
export async function testoPerId(id) {
  if (!id) return null;
  const { data, error } = await supabase.from('testi_legali').select(CAMPI).eq('id', id).maybeSingle();
  if (error) throw error;
  return verifica(data);
}

// Le versioni PUBBLICATE di un documento (in vigore e ritirate, mai bozze), dalla
// più recente. Per scegliere su carta quale versione è stata fatta firmare.
// Solo i dati d'identificazione: il testo si legge con testoPerId.
export async function versioniPubblicate(codice) {
  const { data, error } = await supabase.from('testi_legali')
    .select('id, codice, versione, stato, pubblicato_il, ritirato_il, impronta')
    .eq('codice', codice).neq('stato', 'bozza')
    .order('pubblicato_il', { ascending: false });
  if (error) throw error;
  return data || [];
}
