import { useState, useEffect, useCallback } from 'react';
import { K_ANON, ND_POCHI, livelliLeggibili, nomeCella, NOTA_LIVELLI_UNITI, NOTA_NESSUNA_DISTRIBUZIONE } from '../../../lib/kanon';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../../lib/auth';
import { etichettaData } from '../../../lib/checkup';
import { CARTE_LIVELLO as LIVELLI, azioneLivello } from '../../../lib/livelli';
import { ilPct } from '../../../lib/articoli.mjs';
import { dataIt } from '../../../lib/date-it.mjs';
import { CONFIG } from '../../../lib/config';
import { Titolo, Frasi, Schede, Elenco, Lettore, StampaSlide, STILE_STAMPA_SLIDE } from '../../../components/presentazione/slide';
import { slideProposta } from '../../../components/presentazione/SlideProposta';
import EmailModal from '../../../components/EmailModal';
import { mailPresentazione } from '../../../lib/mail-referente.mjs';

// Presentazione del Report di Attivazione (Enrico, 28/9). Nasce dal Report: ne riassume
// le voci (Executive Summary, Mappa Clinica, Piano Operativo Proposto, Raccomandazioni)
// con i riassunti scritti insieme al Report (v81), accanto ai numeri del check-up. Poi
// «Perché riguarda l'azienda», i prossimi passi e il grazie; circa 5 minuti. Il prezzo
// non c'è: dal «Grazie», con un clic, si passa alla proposta di intervento a slide
// (components/presentazione/SlideProposta.jsx). Prima di iniziare, un controllo che vede
// solo Enrico, con «PDF / Stampa» e «Invia al referente».
const eur = (x) => `€${Math.round(Number(x) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;

function Copertina({ d }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-6 py-10">
      <img src="/logo-es.png" alt="Essentia Salutis" className="w-28 h-28 object-contain" />
      <div className="text-6xl md:text-7xl font-extrabold text-gray-900 leading-tight">
        ES <span className="text-green-600">Work</span> <span className="text-gray-300 font-light">×</span> {d.azienda}
      </div>
      <div className="text-2xl md:text-3xl text-gray-600">
        {d.dipendenti ? `${d.dipendenti} dipendenti · ` : ''}{d.ambito}
      </div>
      <div className="text-lg text-gray-400 uppercase tracking-[0.2em]">Report di Attivazione · {dataIt(d.reportAttivazione.il, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
  );
}

function InSintesi({ d, frasi }) {
  const v = d.vista;
  return (
    <>
      <Titolo k="1 · Executive summary">Il check-up di {d.azienda}</Titolo>
      <div className="flex flex-wrap gap-x-12 gap-y-3 mb-10 text-2xl text-gray-700">
        <div>
          <span className="text-5xl font-extrabold text-green-600">{d.checkup.risposte}</span>
          {d.dipendenti ? <> su {d.dipendenti} dipendenti <span className="text-gray-500">({Math.round((d.checkup.risposte / d.dipendenti) * 100)}%)</span></> : ' dipendenti'} hanno compilato il check-up
        </div>
        {v.pubblicabile && v.prevalenza != null && (
          <div><span className="text-5xl font-extrabold text-green-600">{v.prevalenza}%</span> riporta almeno un disturbo negli ultimi 12 mesi</div>
        )}
      </div>
      <Frasi frasi={frasi} />
    </>
  );
}

function Zone({ d }) {
  const v = d.vista;
  return (
    <>
      <Titolo k="2 · Mappa clinica">Dove si concentrano i disturbi</Titolo>
      {!v.pubblicabile ? (
        <p className="text-2xl text-gray-600">Risultati aggregati non pubblicabili: meno di {K_ANON} risposte. A tutela della riservatezza i risultati si mostrano solo con almeno {K_ANON} risposte.</p>
      ) : (
        <div className="space-y-5">
          {/* TUTTE le zone, come nel report (Enrico, 27/9): dalla più colpita, con la
              percentuale dove è pubblicabile; con una popolazione piccola i distretti. */}
          {v.zone && v.zone.righe.length > 0 && (
            <div>
              <div className="text-lg font-semibold text-gray-500 mb-3">Disturbi negli ultimi 12 mesi, per {v.zone.aggrega ? 'distretto' : 'zona'}</div>
              <div className="space-y-1.5 max-w-4xl">
                {v.zone.righe.map(z => (
                  <div key={z.zone} className="flex items-center gap-4">
                    <div className="w-60 text-lg text-gray-800">{z.zone}</div>
                    {z.soppressa ? (
                      <div className="flex-1 text-base italic text-gray-400">{ND_POCHI}</div>
                    ) : (
                      <>
                        <div className="flex-1 h-5 bg-gray-100 rounded-lg overflow-hidden"><div className="h-full bg-green-600 rounded-lg" style={{ width: `${z.pct12 > 0 ? Math.max(z.pct12, 3) : 0}%` }} /></div>
                        <div className="w-16 text-lg font-bold text-gray-800 text-right">{z.pct12}%</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {v.zone.nota && <div className="text-base text-gray-500 mt-3 max-w-4xl">{v.zone.nota}</div>}
            </div>
          )}
          {v.prevalenza != null && <div className="text-xl text-gray-600">{ilPct(v.prevalenza, { maiuscola: true })} riporta almeno un disturbo negli ultimi 12 mesi.</div>}
        </div>
      )}
    </>
  );
}

function Livelli({ d, frasi }) {
  const v = d.vista;
  // Livelli sotto soglia UNITI in un solo dato (Enrico, 27/9): mai due «n.d.» a schermo.
  const L = v.pubblicabile ? livelliLeggibili(v.livelli, v.n) : null;
  return (
    <>
      <Titolo k="3 · Mappa clinica">Tre livelli, tre risposte diverse</Titolo>
      {!v.pubblicabile ? (
        <p className="text-2xl text-gray-600">Non pubblicabile: meno di {K_ANON} risposte.</p>
      ) : L.nessunaDistribuzione ? (
        <p className="text-2xl text-gray-600">{NOTA_NESSUNA_DISTRIBUZIONE}</p>
      ) : (
        <>
          <div className={`grid gap-6 ${L.celle.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {L.celle.map(c => {
              const livelli = c.keys.map(k => LIVELLI[k]);
              const azioneDi = k => azioneLivello(k, { nuovoProgramma: d.nuovoProgramma });
              const colore = c.unite ? '#475569' : livelli[0].color;
              const sfondo = c.unite ? '#f8fafc' : livelli[0].bg;
              return (
                <div key={c.key} className="rounded-3xl p-7 border-2" style={{ background: sfondo, borderColor: colore }}>
                  <div className="text-6xl font-extrabold" style={{ color: colore }}>{c.pct}%</div>
                  <div className="text-lg text-gray-600 mt-1">{c.count} {c.count === 1 ? 'dipendente' : 'dipendenti'}</div>
                  <div className="text-2xl font-bold mt-4" style={{ color: colore }}>{nomeCella(c)}</div>
                  <div className="text-lg text-gray-700">{livelli.map(m => m.desc).join(' · ')}</div>
                  <div className="text-lg font-semibold text-gray-900 mt-3">→ {c.keys.map(azioneDi).join(' · ')}</div>
                  {c.unite && <div className="text-base text-gray-500 mt-3">Insieme, a tutela della riservatezza.</div>}
                </div>
              );
            })}
          </div>
          {L.unite && <p className="text-lg text-gray-500 mt-5">{NOTA_LIVELLI_UNITI}</p>}
        </>
      )}
      {frasi && <div className="mt-8"><Frasi frasi={frasi} grandi={false} /></div>}
    </>
  );
}

function Grazie({ poi = false }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-6 py-10">
      <div className="text-7xl md:text-8xl font-extrabold text-gray-900">Grazie</div>
      <div className="text-2xl text-gray-700">Dott. Enrico Maiolo · Essentia Salutis · ES <span className="text-green-600 font-bold">Work</span></div>
      <div className="text-xl text-gray-500 space-x-6">
        {CONFIG.contact_phone && <span>{CONFIG.contact_phone}</span>}
        {CONFIG.contact_email && <span>{CONFIG.contact_email}</span>}
        {CONFIG.contact_website && <span>{CONFIG.contact_website}</span>}
      </div>
      {poi && <div className="no-print text-base text-gray-300 mt-6">→ Proposta di intervento</div>}
    </div>
  );
}

export default function PresentazionePage({ d }) {
  const [i, setI] = useState(-1); // -1 = controllo per Enrico, poi le schermate
  // «Standard e sostenibilità»: si decide caso per caso, qui, prima di presentare
  // (default spento). È una scelta di chi presenta (Enrico, 13/9).
  const [conSostenibilita, setConSostenibilita] = useState(false);
  const R = d && !d.errore ? d.reportAttivazione : null;
  const [validato, setValidato] = useState(!!(R && R.validato));
  const [validando, setValidando] = useState(false);
  const [erroreValida, setErroreValida] = useState('');
  const [mail, setMail] = useState(null);
  const esci = useCallback(() => {
    setI(-1);
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {}
  }, []);
  const r = (R && R.riassunti) || {};
  const conSost = conSostenibilita && d && d.leve && d.leve.sostenibilita;
  const proposta = R ? slideProposta(d.proposta) : [];
  const slideReport = R ? [
    { id: 'copertina', el: <Copertina d={d} /> },
    { id: 'sintesi', el: <InSintesi d={d} frasi={r.executive} /> },
    { id: 'zone', el: <Zone d={d} /> },
    { id: 'livelli', el: <Livelli d={d} frasi={r.mappa} /> },
    { id: 'piano', el: <><Titolo k="4 · Piano operativo proposto">Come si interviene</Titolo><Frasi frasi={r.piano} /></> },
    { id: 'raccomandazioni', el: <><Titolo k="5 · Raccomandazioni">Le raccomandazioni</Titolo><Frasi frasi={r.raccomandazioni} /></> },
    // «Assolutamente teniamo Perché riguarda l'azienda» (Enrico, 28/9): l'unica slide che
    // non viene dal Report.
    { id: 'impatto', el: <Schede k="6 · Perché riguarda l'azienda" titolo="Non è solo un problema del dipendente" voci={d.leve.impatto} /> },
    ...(conSost ? [{ id: 'sostenibilita', el: <Schede k="7 · Standard e sostenibilità" titolo="Dati utilizzabili per la rendicontazione" voci={[d.leve.sostenibilita]} /> }] : []),
    ...(d.prossimiPassi ? [{ id: 'prossimi', el: <Elenco k={`${conSost ? 8 : 7} · Dopo oggi`} titolo="I prossimi passi" voci={d.prossimiPassi} /> }] : []),
    { id: 'grazie', el: <Grazie poi={proposta.length > 0} /> },
  ] : [];
  // Dal «Grazie», con un clic, la proposta di intervento (Enrico, 28/9).
  const schermate = [...slideReport, ...proposta];
  const schermoIntero = () => { try { document.documentElement.requestFullscreen(); } catch (_) {} };
  useEffect(() => {
    if (i < 0) return undefined;
    // Chrome usa Esc per uscire dallo schermo intero senza passarlo alla pagina.
    const schermo = () => { if (!document.fullscreenElement) setI(-1); };
    document.addEventListener('fullscreenchange', schermo);
    return () => document.removeEventListener('fullscreenchange', schermo);
  }, [i]);

  if (!d || d.errore) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-gray-600 p-8 text-center">
        <p>{(d && d.errore) || 'Dati non disponibili.'}</p>
        {d && d.clientId && <Link href={`/dashboard/${d.clientId}`} className="text-green-700 underline">← Torna alla scheda azienda</Link>}
      </div>
    );
  }

  // Il Report «da rivedere» non si presenta finché non lo rigeneri o lo validi (Enrico,
  // 28/9: la presentazione porta i suoi testi). Senza riassunti non c'è presentazione.
  const senzaRiassunti = !R.riassunti;
  const daRivedere = R.stato === 'ai_da_rivedere' && !validato;
  const bloccata = senzaRiassunti || daRivedere;

  async function valida() {
    setValidando(true); setErroreValida('');
    const res = await fetch(`/api/clients/${d.clientId}/reports/${R.id}/valida`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione: 'valida' }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setValidando(false);
    if (res && (res.ok || res.status === 409)) setValidato(true);
    else setErroreValida(j.error || 'Validazione non registrata: riprova.');
  }

  function apriMail() {
    const m = mailPresentazione({ azienda: d.azienda, referente: d.referente && d.referente.nome });
    setMail({ to: (d.referente && d.referente.email) || '', subject: m.oggetto, body: m.corpo });
  }

  // ── Le schermate ──
  if (i >= 0) {
    return (
      <>
        <Head><title>{`Presentazione — ${d.azienda}`}</title></Head>
        <Lettore schermate={schermate} i={i} setI={setI} onEsci={esci} />
      </>
    );
  }

  // ── Controllo prima di presentare (solo per Enrico) ──
  const righe = [];
  const quando = dataIt(R.il, { day: 'numeric', month: 'long', year: 'numeric' });
  if (validato) righe.push(['ok', `Report di Attivazione del ${quando}, validato.`]);
  else if (R.stato === 'ai') righe.push(['ok', `Report di Attivazione del ${quando}: ha passato il controllo automatico.`]);
  else if (R.stato === 'ai_da_rivedere') righe.push(['warn', `Report di Attivazione del ${quando}: «da rivedere», il controllo automatico ha trovato frasi da correggere.`]);
  else righe.push(['warn', `Report di Attivazione del ${quando}: è il testo di riserva (l'AI non ha risposto).`]);
  if (d.inRange === true) righe.push(['ok', `Prezzo dentro la forbice presentata al colloquio (${eur(d.forchetta.min)} – ${eur(d.forchetta.max)}).`]);
  else if (d.posizione === 'sotto_per_sconto') righe.push(['info', `Sotto la forbice per il prezzo applicato che hai registrato: ${eur(d.prezzo.y1)} contro ${eur(d.forchetta.min)} – ${eur(d.forchetta.max)}. Il cliente vede solo il totale.`]);
  else if (d.inRange === false) righe.push(['warn', `Fuori forbice: ${eur(d.prezzo.y1)} contro ${eur(d.forchetta.min)} – ${eur(d.forchetta.max)}. Il cliente vede solo il totale: prepara la motivazione.`]);
  else righe.push(['info', 'Nessuna Stima registrata: prezzo pieno, senza forbice e senza tetto.']);
  righe.push(d.vista.pubblicabile ? ['ok', `${d.checkup.risposte} risposte al check-up.`] : ['warn', `Meno di ${K_ANON} risposte: zone e livelli non mostrano dati.`]);
  if (d.scontoStato === 'sospeso') righe.push(['warn', 'Il prezzo applicato registrato è sospeso: i dati sono cambiati. Riconfermalo dalla proposta di intervento, altrimenti vale il prezzo pieno.']);
  if (d.checkup.stato === 'aperto') righe.push(['warn', `Il check-up è ancora aperto${d.checkup.chiude_il ? ` (chiude il ${etichettaData(d.checkup.chiude_il)})` : ''}: i numeri possono ancora cambiare.`]);
  if (proposta.length) righe.push(['ok', `Dopo il «Grazie», con → si passa alla proposta di intervento (${proposta.length} schermate).`]);
  else if (d.motivoSenzaProposta === 'prezzo_diverso') righe.push(['warn', 'La proposta di intervento non si presenta: il prezzo di oggi non è quello scritto nel Report. Rigenera il Report dalla scheda.']);
  else if (d.motivoSenzaProposta === 'firmato') righe.push(['info', 'Contratto già firmato: dopo il «Grazie» non segue la proposta di intervento.']);

  const icona = { ok: '✓', warn: '⚠', info: 'ℹ' };
  const colore = { ok: 'text-green-700', warn: 'text-amber-700', info: 'text-gray-600' };
  return (
    <>
      <Head><title>{`Presentazione — ${d.azienda}`}</title></Head>
      <style>{STILE_STAMPA_SLIDE}</style>
      <div className="no-print min-h-screen bg-gray-50 p-6 md:p-12">
        <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-gray-200 p-8 space-y-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Prima di presentare — solo per te</div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Report di Attivazione — {d.azienda}</h1>
          </div>
          <ul className="space-y-2">
            {righe.map(([t, testo]) => <li key={testo} className={`text-sm ${colore[t]}`}>{icona[t]} {testo}</li>)}
          </ul>
          {bloccata && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-3 text-sm text-red-800">
              {senzaRiassunti && <p><strong>Questo Report non ha i riassunti per le slide</strong> ({String(R.stato || '').startsWith('fallback') ? 'è il testo di riserva: l\'AI non ha risposto' : 'è stato generato prima che il Report li scrivesse, oppure non erano leggibili'}). La presentazione nasce dal Report: rigeneralo dalla scheda dell&apos;azienda.</p>}
              {!senzaRiassunti && daRivedere && (
                <>
                  <p><strong>Il Report è «da rivedere»</strong> e la presentazione porta i suoi testi: leggilo nella scheda dell&apos;azienda. Se va bene, validalo qui; altrimenti rigeneralo.</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={valida} disabled={validando}
                      title="Registra che l'hai letto e validato: chi e quando. La riga compare nel documento e il PDF si rigenera."
                      className="text-sm font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl disabled:opacity-50">
                      {validando ? '…' : '✅ Valido questo report'}
                    </button>
                    <Link href={`/dashboard/${d.clientId}`} className="text-red-700 underline">Leggilo nella scheda</Link>
                  </div>
                  {erroreValida && <p>{erroreValida}</p>}
                </>
              )}
            </div>
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-800 mb-2">Note per te sulle leve</div>
            <ul className="space-y-1.5">{d.noteEnrico.map(n => <li key={n} className="text-sm text-amber-900">• {n}</li>)}</ul>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-2xl p-3 cursor-pointer">
            <input type="checkbox" checked={conSostenibilita} onChange={e => setConSostenibilita(e.target.checked)} className="mt-0.5" />
            <span>
              Aggiungi la schermata <strong>«Standard e sostenibilità»</strong> (GRI 403, ESRS S1, ISO 45001, B Corp).
              <span className="block text-xs text-gray-500">Serve a chi redige la rendicontazione di sostenibilità. A un titolare di micro-impresa non dice nulla: lascia spento.</span>
            </span>
          </label>
          <div className="text-sm text-gray-500">{slideReport.length} schermate, circa 5 minuti: copertina, executive summary, zone, livelli, piano operativo, raccomandazioni, perché riguarda l&apos;azienda{conSost ? ', standard e sostenibilità' : ''}{d.prossimiPassi ? ', prossimi passi' : ''}, grazie{proposta.length ? '; poi la proposta di intervento' : ''}. Frecce ← → per muoverti, Esc per tornare qui.</div>
          <div className="flex gap-3 flex-wrap items-center">
            <button onClick={() => { schermoIntero(); setI(0); }} disabled={bloccata}
              className="text-base font-semibold text-white bg-green-600 px-5 py-3 rounded-2xl hover:bg-green-700 disabled:opacity-40 disabled:hover:bg-green-600">▶ Inizia la presentazione</button>
            {/* I due tasti (Enrico, 28/9): il PDF delle slide del Report e la mail al referente. */}
            <button onClick={() => window.print()} disabled={bloccata}
              className="text-sm font-semibold text-green-700 border border-green-300 bg-green-50 px-4 py-3 rounded-2xl disabled:opacity-40">🖨 PDF / Stampa</button>
            <button onClick={apriMail} disabled={bloccata}
              className="text-sm font-semibold text-blue-700 border border-blue-300 bg-blue-50 px-4 py-3 rounded-2xl disabled:opacity-40">✉ Invia al referente</button>
            <Link href={`/dashboard/${d.clientId}`} className="text-base text-gray-500 px-3 py-3">← Scheda azienda</Link>
          </div>
        </div>
      </div>
      {!bloccata && <StampaSlide schermate={slideReport} />}
      {mail && <EmailModal modal={mail} allegato="la presentazione" onClose={() => setMail(null)} />}
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => {
  const { datiPresentazione } = await import('../../../lib/presentazione-server');
  const d = await datiPresentazione(ctx.params.clientId).catch(e => ({ errore: `Errore: ${e.message}` }));
  // La presentazione nasce dal Report di Attivazione (Enrico, 28/9: chiudo il check-up →
  // creo il Report → da lì presentazione e proposta di intervento).
  if (d && !d.errore && !d.reportAttivazione) {
    return { props: { d: { errore: 'La presentazione nasce dal Report di Attivazione: generalo dalla scheda dell\'azienda, poi torna qui.', azienda: d.azienda, clientId: d.clientId } } };
  }
  return { props: { d: JSON.parse(JSON.stringify(d)) } };
});
