import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../../lib/auth';
import { etichettaData } from '../../../lib/checkup';

// Presentazione del Report di Attivazione (punto 7) — a schermo, nell'ordine di Enrico:
// fotografia → stratificazione → piano → preventivo dentro la forbice → leve (prima
// l'impatto, poi l'economia; sostenibilità solo per il binario B). Prima di iniziare, un
// controllo che vede solo Enrico. Numeri: stessa fonte dell'Offerta (lib/presentazione-server).
const eur = (x) => `€${Math.round(Number(x) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;

const LIVELLI = {
  l1: { nome: 'Livello 1', desc: 'Dolore con impatto funzionale', azione: 'Cicli clinici', color: '#dc2626', bg: '#fef2f2' },
  l2: { nome: 'Livello 2', desc: 'Segnali senza impatto', azione: 'Prevenzione', color: '#ca8a04', bg: '#fffbeb' },
  l3: { nome: 'Livello 3', desc: 'Nessun disturbo in atto', azione: 'Formazione', color: '#16a34a', bg: '#f0fdf4' },
};

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
        <p className="text-2xl text-gray-600">Risultati aggregati non pubblicabili: meno di 5 risposte. A tutela della riservatezza i risultati si mostrano solo con almeno 5 risposte.</p>
      ) : (
        <div className="space-y-8">
          <div className="text-3xl text-gray-800">
            <span className="text-6xl font-extrabold text-green-600">{d.checkup.risposte}</span>
            {d.dipendenti ? <> su {d.dipendenti} dipendenti <span className="text-gray-500">({Math.round((d.checkup.risposte / d.dipendenti) * 100)}%)</span></> : ' dipendenti'} hanno compilato il check-up
          </div>
          {v.zoneTop.length > 0 && (
            <div>
              <div className="text-lg font-semibold text-gray-500 mb-3">Zone più colpite negli ultimi 12 mesi</div>
              <div className="space-y-3 max-w-3xl">
                {v.zoneTop.map(z => (
                  <div key={z.zone} className="flex items-center gap-4">
                    <div className="w-44 text-xl text-gray-800">{z.zone}</div>
                    <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden"><div className="h-full bg-green-600 rounded-lg" style={{ width: `${Math.max(z.pct12, 4)}%` }} /></div>
                    <div className="w-16 text-xl font-bold text-gray-800 text-right">{z.pct12}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {v.prevalenza != null && <div className="text-xl text-gray-600">Il {v.prevalenza}% riporta almeno un disturbo negli ultimi 12 mesi.</div>}
          <div className="text-xl italic text-gray-500">È la fotografia da cui parte tutto il programma.</div>
        </div>
      )}
    </>
  );
}

function Stratificazione({ d }) {
  const v = d.vista;
  return (
    <>
      <Titolo k="2 · La stratificazione">Tre livelli, tre risposte diverse</Titolo>
      {!v.pubblicabile ? (
        <p className="text-2xl text-gray-600">Non pubblicabile: meno di 5 risposte.</p>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-6">
            {v.livelli.map(c => {
              const m = LIVELLI[c.key];
              const azione = c.key === 'l2' && d.nuovoProgramma ? 'Prevenzione dal primo anno' : c.key === 'l3' ? 'Formazione per tutti' : m.azione;
              return (
                <div key={c.key} className="rounded-3xl p-8 border-2" style={{ background: m.bg, borderColor: m.color }}>
                  <div className="text-6xl font-extrabold" style={{ color: m.color }}>{c.suppressed ? 'n.d.' : `${c.pct}%`}</div>
                  {!c.suppressed && <div className="text-lg text-gray-600 mt-1">{c.count} dipendenti</div>}
                  {c.suppressed && <div className="text-lg text-gray-500 mt-1">gruppo sotto le 5 persone</div>}
                  <div className="text-2xl font-bold mt-4" style={{ color: m.color }}>{m.nome}</div>
                  <div className="text-lg text-gray-700">{m.desc}</div>
                  <div className="text-lg font-semibold text-gray-900 mt-3">→ {azione}</div>
                </div>
              );
            })}
          </div>
          {v.livelli.some(c => c.suppressed) && <p className="text-lg text-gray-500 mt-6">Alcuni gruppi contano meno di 5 persone e non sono mostrati, a tutela della riservatezza.</p>}
        </>
      )}
    </>
  );
}

function Piano({ d }) {
  return (
    <>
      <Titolo k="3 · Il piano">Il vostro programma nel primo anno</Titolo>
      {d.quantita.length > 0 ? (
        <ul className="space-y-4">
          {d.quantita.map(q => <li key={q} className="text-2xl md:text-3xl text-gray-800 flex gap-4"><span className="text-green-600">●</span><span>{q}</span></li>)}
        </ul>
      ) : <p className="text-2xl text-gray-600">Il piano è descritto nell&apos;Offerta.</p>}
      <div className="mt-10 flex flex-wrap gap-2">
        {d.voci.map(v => <span key={v} className="text-sm px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">{v}</span>)}
      </div>
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
      <div className="text-2xl text-gray-700 mt-2">{eur(p.mese)} al mese · {eur(p.dipendente)} per dipendente</div>
      <div className="text-xl text-gray-600 mt-4">Anno 2 e successivi (indicativo): <strong>{eur(p.y2)}</strong> l&apos;anno</div>
      {barra}
    </>
  );
}

function Leve({ k, titolo, voci }) {
  return (
    <>
      <Titolo k={k}>{titolo}</Titolo>
      <div className="grid md:grid-cols-2 gap-5">
        {voci.map(l => (
          <div key={l.titolo} className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="text-2xl font-bold text-gray-900">{l.titolo}</div>
            <div className="text-lg text-gray-700 mt-2 leading-relaxed">{l.testo}</div>
            {l.dato && <div className="text-lg font-semibold text-green-700 mt-2">{l.dato}</div>}
            {l.evidenza && <div className="mt-3 inline-block text-base font-bold text-amber-900 bg-amber-100 border border-amber-300 rounded-lg px-3 py-1.5">⚠ {l.evidenza}</div>}
            {l.nota && <div className="text-base text-gray-500 mt-2">{l.nota}</div>}
          </div>
        ))}
      </div>
    </>
  );
}

export default function PresentazionePage({ d }) {
  const [i, setI] = useState(-1); // -1 = controllo per Enrico, poi le schermate
  const schermate = d && !d.errore ? [
    { id: 'fotografia', el: <Fotografia d={d} /> },
    { id: 'stratificazione', el: <Stratificazione d={d} /> },
    { id: 'piano', el: <Piano d={d} /> },
    { id: 'preventivo', el: <Preventivo d={d} /> },
    { id: 'impatto', el: <Leve k="5 · Perché riguarda l'azienda" titolo="Non è solo un problema del dipendente" voci={d.leve.impatto} /> },
    { id: 'economia', el: <Leve k="6 · Quanto vale" titolo="Le leve economiche" voci={d.leve.economiche} /> },
    ...(d.leve.sostenibilita ? [{ id: 'sostenibilita', el: <Leve k="7 · Standard e sostenibilità" titolo="Dati utilizzabili per la rendicontazione" voci={[d.leve.sostenibilita]} /> }] : []),
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
    else if (d.inRange === false) righe.push(['warn', `Fuori forbice: ${eur(d.prezzo.y1)} contro ${eur(d.forchetta.min)} – ${eur(d.forchetta.max)}. Prepara la motivazione: la schermata del preventivo lo mostra.`]);
    else righe.push(['info', 'Nessuna Stima di riferimento: la schermata del preventivo mostra solo il prezzo.']);
    righe.push(d.vista.pubblicabile ? ['ok', `${d.checkup.risposte} risposte al check-up.`] : ['warn', 'Meno di 5 risposte: fotografia e stratificazione non mostrano dati.']);
    if (d.checkup.stato === 'aperto') righe.push(['warn', `Il check-up è ancora aperto${d.checkup.chiude_il ? ` (chiude il ${etichettaData(d.checkup.chiude_il)})` : ''}: i numeri possono ancora cambiare.`]);
    righe.push(['info', d.leve.sostenibilita ? 'Binario B: inclusa la schermata «Standard e sostenibilità».' : 'La schermata «Standard e sostenibilità» è esclusa (solo per il binario B).']);
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
            <div className="text-sm text-gray-500">{tot} schermate: fotografia, stratificazione, piano, preventivo, perché riguarda l&apos;azienda, quanto vale{d.leve.sostenibilita ? ', standard e sostenibilità' : ''}. Frecce ← → per muoverti, Esc per tornare qui.</div>
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
