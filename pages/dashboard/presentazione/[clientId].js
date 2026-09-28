import { useState, useEffect, useCallback } from 'react';
import { K_ANON, ND_POCHI, livelliLeggibili, nomeCella, NOTA_LIVELLI_UNITI, NOTA_NESSUNA_DISTRIBUZIONE } from '../../../lib/kanon';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../../lib/auth';
import { etichettaData } from '../../../lib/checkup';
import { DICITURA_IVA } from '../../../lib/iva.mjs';
import { CARTE_LIVELLO as LIVELLI, azioneLivello } from '../../../lib/livelli';
import { ilPct } from '../../../lib/articoli.mjs';

// Presentazione del Report di Attivazione (punto 7) — a schermo, nell'ordine di Enrico:
// fotografia → stratificazione → piano → preventivo dentro la forbice → leve (prima
// l'impatto, poi l'economia; sostenibilità con la spunta). Prima di iniziare, un
// controllo che vede solo Enrico. Numeri: stessa fonte dell'Offerta (lib/presentazione-server).
const eur = (x) => `€${Math.round(Number(x) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;

function Titolo({ k, children }) {
  return (
    <div className="mb-8">
      <div className="text-sm font-bold uppercase tracking-[0.2em] text-green-600">{k}</div>
      <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mt-2 leading-tight">{children}</h1>
    </div>
  );
}

function Fotografia({ d }) {
  const v = d.vista;
  return (
    <>
      <Titolo k="1 · La fotografia">Il check-up di {d.azienda}</Titolo>
      {!v.pubblicabile ? (
        <p className="text-2xl text-gray-600">Risultati aggregati non pubblicabili: meno di {K_ANON} risposte. A tutela della riservatezza i risultati si mostrano solo con almeno {K_ANON} risposte.</p>
      ) : (
        <div className="space-y-5">
          <div className="text-3xl text-gray-800">
            <span className="text-5xl font-extrabold text-green-600">{d.checkup.risposte}</span>
            {d.dipendenti ? <> su {d.dipendenti} dipendenti <span className="text-gray-500">({Math.round((d.checkup.risposte / d.dipendenti) * 100)}%)</span></> : ' dipendenti'} hanno compilato il check-up
          </div>
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
          <div className="text-xl italic text-gray-500">È la fotografia da cui parte tutto il programma.</div>
        </div>
      )}
    </>
  );
}

function Stratificazione({ d }) {
  const v = d.vista;
  // Livelli sotto soglia UNITI in un solo dato (Enrico, 27/9): mai due «n.d.» a schermo.
  const L = v.pubblicabile ? livelliLeggibili(v.livelli, v.n) : null;
  return (
    <>
      <Titolo k="2 · La stratificazione">Tre livelli, tre risposte diverse</Titolo>
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
                <div key={c.key} className="rounded-3xl p-8 border-2" style={{ background: sfondo, borderColor: colore }}>
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
          {L.unite && <p className="text-lg text-gray-500 mt-6">{NOTA_LIVELLI_UNITI}</p>}
        </>
      )}
    </>
  );
}

function Piano({ d }) {
  // Cosa riceve ciascun livello (Enrico, 27/9): niente «giornate di sportello», che sono
  // una misura interna, e niente elenco ripetuto delle voci del programma.
  return (
    <>
      <Titolo k="3 · Il piano">Il vostro programma nel primo anno</Titolo>
      {d.piano ? (
        <ul className="space-y-6 max-w-5xl">
          {d.piano.map(r => (
            <li key={r.testo} className="text-2xl md:text-3xl text-gray-800 flex gap-4 leading-snug">
              <span className="text-green-600">●</span>
              <span>{r.titolo && <strong className="text-gray-900">{r.titolo}: </strong>}{r.testo}</span>
            </li>
          ))}
        </ul>
      ) : d.quantita.length > 0 ? (
        <ul className="space-y-4">
          {d.quantita.map(q => <li key={q} className="text-2xl md:text-3xl text-gray-800 flex gap-4"><span className="text-green-600">●</span><span>{q}</span></li>)}
        </ul>
      ) : <p className="text-2xl text-gray-600">Il piano è descritto nell&apos;Offerta.</p>}
    </>
  );
}

function Preventivo({ d }) {
  const p = d.prezzo;
  if (!p) return <><Titolo k="4 · Il preventivo">Investimento</Titolo><p className="text-2xl text-gray-600">Preventivo non disponibile.</p></>;
  const f = d.forchetta;
  // Barra della forbice: il prezzo è un punto sulla barra (se fuori, cade fuori dal tratto verde).
  let barra = null;
  if (f) {
    const lo = Math.min(f.min, p.y1), hi = Math.max(f.max, p.y1);
    const span = Math.max(hi - lo, 1), pad = span * 0.12, a = lo - pad, b = hi + pad;
    const pos = (x) => `${((x - a) / (b - a)) * 100}%`;
    barra = (
      <div className="mt-10 max-w-3xl">
        <div className="text-lg text-gray-500 mb-6">La forbice della Stima di investimento presentata al colloquio</div>
        <div className="relative h-4 bg-gray-100 rounded-full">
          <div className="absolute h-4 bg-green-200 rounded-full" style={{ left: pos(f.min), width: `calc(${pos(f.max)} - ${pos(f.min)})` }} />
          <div className="absolute -top-3 w-10 h-10 rounded-full bg-green-600 border-4 border-white shadow" style={{ left: `calc(${pos(p.y1)} - 20px)` }} />
        </div>
        <div className="relative h-8 mt-3 text-lg text-gray-600">
          <span className="absolute" style={{ left: pos(f.min), transform: 'translateX(-50%)' }}>{eur(f.min)}</span>
          <span className="absolute" style={{ left: pos(f.max), transform: 'translateX(-50%)' }}>{eur(f.max)}</span>
        </div>
      </div>
    );
  }
  return (
    <>
      <Titolo k="4 · Il preventivo">L&apos;investimento, sui vostri dati reali</Titolo>
      <div className="text-lg font-semibold text-gray-500">Anno 1 — programma completo</div>
      <div className="text-7xl font-extrabold text-green-600 mt-1">{eur(p.y1)}</div>
      <div className="text-2xl text-gray-700 mt-2">{eur(p.mese)} al mese</div>
      <div className="mt-6 max-w-4xl rounded-2xl bg-gray-50 border border-gray-200 p-5">
        <div className="text-xl text-gray-800">Anno 2 e successivi (indicativo): <strong>{eur(p.y2)}</strong> l&apos;anno</div>
        {d.anno2 && <div className="text-lg text-gray-600 mt-2 leading-relaxed">{d.anno2}</div>}
      </div>
      <div className="text-sm text-gray-500 mt-2">{DICITURA_IVA}</div>
      {barra}
    </>
  );
}

function Leve({ k, titolo, voci }) {
  // Una sola scheda (Standard e sostenibilità) occupa tutta la pagina (Enrico, 27/9).
  const unica = voci.length === 1;
  return (
    <>
      <Titolo k={k}>{titolo}</Titolo>
      <div className={unica ? '' : 'grid md:grid-cols-2 gap-5'}>
        {voci.map(l => (
          <div key={l.titolo} className={`rounded-2xl border border-gray-200 bg-white ${unica ? 'p-10' : 'p-6'}`}>
            <div className={`${unica ? 'text-4xl' : 'text-2xl'} font-bold text-gray-900`}>{l.titolo}</div>
            <div className={`${unica ? 'text-3xl mt-5' : 'text-lg mt-2'} text-gray-700 leading-relaxed`}>{l.testo}</div>
            {l.dato && <div className="text-lg font-semibold text-green-700 mt-2">{l.dato}</div>}
            {l.nota && <div className={`${unica ? 'text-2xl mt-6' : 'text-base mt-2'} text-gray-500`}>{l.nota}</div>}
          </div>
        ))}
      </div>
    </>
  );
}

function ProssimiPassi({ k, passi }) {
  return (
    <>
      <Titolo k={k}>I prossimi passi</Titolo>
      <ol className="space-y-5 max-w-5xl">
        {passi.map((t, n) => (
          <li key={t} className="flex gap-5 text-2xl md:text-3xl text-gray-800 leading-snug">
            <span className="shrink-0 w-12 h-12 rounded-full bg-green-600 text-white font-extrabold flex items-center justify-center text-2xl">{n + 1}</span>
            <span className="pt-1.5">{t}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

export default function PresentazionePage({ d }) {
  const [i, setI] = useState(-1); // -1 = controllo per Enrico, poi le schermate
  // «Standard e sostenibilità»: si decide caso per caso, qui, prima di presentare
  // (default spento). Prima usciva per le aziende del binario B, che è caduto: a un
  // titolare di micro-impresa quel blocco non dice nulla, ma non è un attributo
  // dell'azienda a doverlo sapere — è una scelta di chi presenta (Enrico, 13/9).
  const [conSostenibilita, setConSostenibilita] = useState(false);
  const schermate = d && !d.errore ? [
    { id: 'fotografia', el: <Fotografia d={d} /> },
    { id: 'stratificazione', el: <Stratificazione d={d} /> },
    { id: 'piano', el: <Piano d={d} /> },
    { id: 'preventivo', el: <Preventivo d={d} /> },
    { id: 'impatto', el: <Leve k="5 · Perché riguarda l'azienda" titolo="Non è solo un problema del dipendente" voci={d.leve.impatto} /> },
    { id: 'economia', el: <Leve k="6 · Quanto vale" titolo="Le leve economiche" voci={d.leve.economiche} /> },
    ...(conSostenibilita && d.leve.sostenibilita ? [{ id: 'sostenibilita', el: <Leve k="7 · Standard e sostenibilità" titolo="Dati utilizzabili per la rendicontazione" voci={[d.leve.sostenibilita]} /> }] : []),
    ...(d.prossimiPassi ? [{ id: 'prossimi', el: <ProssimiPassi k={`${conSostenibilita && d.leve.sostenibilita ? 8 : 7} · Dopo oggi`} passi={d.prossimiPassi} /> }] : []),
  ] : [];
  const tot = schermate.length;
  const vai = useCallback((n) => setI(x => Math.max(-1, Math.min(tot - 1, n(x)))), [tot]);
  useEffect(() => {
    const onKey = (e) => {
      if (i < 0) return;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); vai(x => x + 1); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); vai(x => x - 1); }
      else if (e.key === 'Escape') setI(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, vai]);
  const schermoIntero = () => { try { document.documentElement.requestFullscreen(); } catch (_) {} };

  if (!d || d.errore) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-gray-600 p-8 text-center">
        <p>{(d && d.errore) || 'Dati non disponibili.'}</p>
        {d && d.clientId && <Link href={`/dashboard/${d.clientId}`} className="text-green-700 underline">← Torna alla scheda azienda</Link>}
      </div>
    );
  }

  // ── Controllo prima di presentare (solo per Enrico) ──
  if (i < 0) {
    const righe = [];
    if (d.inRange === true) righe.push(['ok', `Prezzo dentro la forbice presentata al colloquio (${eur(d.forchetta.min)} – ${eur(d.forchetta.max)}).`]);
    else if (d.posizione === 'sotto_per_sconto') righe.push(['info', `Sotto la forbice per il prezzo applicato che hai registrato: ${eur(d.prezzo.y1)} contro ${eur(d.forchetta.min)} – ${eur(d.forchetta.max)}. Il cliente vede solo il totale.`]);
    else if (d.inRange === false) righe.push(['warn', `Fuori forbice: ${eur(d.prezzo.y1)} contro ${eur(d.forchetta.min)} – ${eur(d.forchetta.max)}. Prepara la motivazione: la schermata del preventivo lo mostra.`]);
    else righe.push(['info', 'Nessuna Stima registrata: prezzo pieno, senza forbice e senza tetto. La schermata del preventivo mostra solo il prezzo.']);
    righe.push(d.vista.pubblicabile ? ['ok', `${d.checkup.risposte} risposte al check-up.`] : ['warn', `Meno di ${K_ANON} risposte: fotografia e stratificazione non mostrano dati.`]);
    if (d.scontoStato === 'sospeso') righe.push(['warn', 'Il prezzo applicato registrato è sospeso: i dati sono cambiati. Riconfermalo dall\'Offerta, altrimenti vale il prezzo pieno.']);
    if (d.checkup.stato === 'aperto') righe.push(['warn', `Il check-up è ancora aperto${d.checkup.chiude_il ? ` (chiude il ${etichettaData(d.checkup.chiude_il)})` : ''}: i numeri possono ancora cambiare.`]);

    const icona = { ok: '✓', warn: '⚠', info: 'ℹ' };
    const colore = { ok: 'text-green-700', warn: 'text-amber-700', info: 'text-gray-600' };
    return (
      <>
        <Head><title>{`Presentazione — ${d.azienda}`}</title></Head>
        <div className="min-h-screen bg-gray-50 p-6 md:p-12">
          <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-gray-200 p-8 space-y-6">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Prima di presentare — solo per te</div>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">Report di Attivazione — {d.azienda}</h1>
            </div>
            <ul className="space-y-2">
              {righe.map(([t, testo]) => <li key={testo} className={`text-sm ${colore[t]}`}>{icona[t]} {testo}</li>)}
            </ul>
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
            <div className="text-sm text-gray-500">{tot} schermate: fotografia, stratificazione, piano, preventivo, perché riguarda l&apos;azienda, quanto vale{conSostenibilita ? ', standard e sostenibilità' : ''}{d.prossimiPassi ? ', prossimi passi' : ''}. Frecce ← → per muoverti, Esc per tornare qui.</div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => { schermoIntero(); setI(0); }} className="text-base font-semibold text-white bg-green-600 px-5 py-3 rounded-2xl hover:bg-green-700">▶ Inizia la presentazione</button>
              <Link href={`/dashboard/sintesi/${d.clientId}`} className="text-base font-semibold text-gray-700 border border-gray-300 px-5 py-3 rounded-2xl hover:bg-gray-50">📄 Sintesi</Link>
              <Link href={`/dashboard/${d.clientId}`} className="text-base text-gray-500 px-3 py-3">← Scheda azienda</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>{`Presentazione — ${d.azienda}`}</title></Head>
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex-1 px-8 md:px-20 py-12 max-w-7xl w-full mx-auto">{schermate[i].el}</div>
        <div className="flex items-center justify-between px-8 md:px-20 py-5 border-t border-gray-100">
          <div className="text-sm text-gray-400"><span className="font-bold text-gray-700">ES <span className="text-green-600">Work</span></span> · Essentia Salutis</div>
          <div className="flex items-center gap-2">
            {schermate.map((s, n) => <button key={s.id} onClick={() => setI(n)} className={`w-2.5 h-2.5 rounded-full ${n === i ? 'bg-green-600' : 'bg-gray-200'}`} aria-label={`schermata ${n + 1}`} />)}
          </div>
          <div className="flex gap-2">
            <button onClick={() => vai(x => x - 1)} disabled={i === 0} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 disabled:opacity-30">←</button>
            <button onClick={() => vai(x => x + 1)} disabled={i === tot - 1} className="px-4 py-2 rounded-xl bg-gray-900 text-white disabled:opacity-30">→</button>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => {
  const { datiPresentazione } = await import('../../../lib/presentazione-server');
  const d = await datiPresentazione(ctx.params.clientId).catch(e => ({ errore: `Errore: ${e.message}` }));
  return { props: { d: JSON.parse(JSON.stringify(d)) } };
});
