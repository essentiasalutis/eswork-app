// I mattoni delle slide, uguali per la presentazione del Report e per la proposta di
// intervento: stesso aspetto, «in parure» (Enrico, 28/9).
import { useEffect, useCallback } from 'react';
import { CONFIG } from '../../lib/config';
import { LEGENDA_SEMAFORO, TL_COLOR } from '../../lib/scoring';

export function Titolo({ k, children }) {
  return (
    <div className="mb-8">
      <div className="text-sm font-bold uppercase tracking-[0.2em] text-green-600">{k}</div>
      <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mt-2 leading-tight">{children}</h1>
    </div>
  );
}

// Le frasi, una per riga.
export function Frasi({ frasi, grandi = true }) {
  if (!frasi || !frasi.length) return null;
  return (
    <ul className="space-y-5 max-w-5xl">
      {frasi.map(f => (
        <li key={f} className={`${grandi ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'} text-gray-800 flex gap-4 leading-snug`}>
          <span className="text-green-600">●</span><span>{f}</span>
        </li>
      ))}
    </ul>
  );
}

export function Schede({ k, titolo, voci }) {
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

export function Elenco({ k, titolo, voci }) {
  return (
    <>
      <Titolo k={k}>{titolo}</Titolo>
      <ol className="space-y-5 max-w-5xl">
        {voci.map((t, n) => (
          <li key={t} className="flex gap-5 text-2xl md:text-3xl text-gray-800 leading-snug">
            <span className="shrink-0 w-12 h-12 rounded-full bg-green-600 text-white font-extrabold flex items-center justify-center text-2xl">{n + 1}</span>
            <span className="pt-1.5">{t}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

// Come si leggono i colori: la legenda del Report (lib/scoring.js).
export function Legenda() {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-base text-gray-500">
      {LEGENDA_SEMAFORO.map(l => (
        <span key={l.colore} className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: TL_COLOR[l.colore] }} />{l.nome}: {l.testo}
        </span>
      ))}
    </div>
  );
}

// L'ultima schermata, sempre (Enrico, 28/9): dopo la proposta di intervento, o dopo i
// prossimi passi quando la proposta non segue.
export function Grazie() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-6 py-10">
      <img src="/logo-es.png" alt="Essentia Salutis" className="w-24 h-24 object-contain" />
      <div className="text-6xl md:text-7xl font-extrabold text-gray-900">Grazie per l&apos;attenzione</div>
      <div className="text-2xl text-gray-700">Dott. Enrico Maiolo · Essentia Salutis · ES <span className="text-green-600 font-bold">Work</span></div>
      <div className="text-xl text-gray-500 flex flex-wrap justify-center gap-x-8 gap-y-1">
        {CONFIG.contact_phone && <span>{CONFIG.contact_phone}</span>}
        {CONFIG.contact_email && <span>{CONFIG.contact_email}</span>}
        {CONFIG.contact_website && <span>{CONFIG.contact_website}</span>}
      </div>
    </div>
  );
}
export const SLIDE_GRAZIE = { id: 'grazie', el: <Grazie /> };

// Il lettore: una schermata alla volta, frecce ← → (o spazio), Esc per uscire.
export function Lettore({ schermate, i, setI, onEsci }) {
  const tot = schermate.length;
  const vai = useCallback((n) => setI(x => Math.max(0, Math.min(tot - 1, n(x)))), [tot, setI]);
  useEffect(() => {
    const onKey = (e) => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); vai(x => x + 1); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); vai(x => x - 1); }
      else if (e.key === 'Escape') onEsci();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [vai, onEsci]);
  const s = schermate[i] || schermate[0];
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 px-8 md:px-20 py-12 max-w-7xl w-full mx-auto">{s.el}</div>
      <div className="flex items-center justify-between px-8 md:px-20 py-5 border-t border-gray-100">
        <div className="text-sm text-gray-400"><span className="font-bold text-gray-700">ES <span className="text-green-600">Work</span></span> · Essentia Salutis</div>
        <div className="flex items-center gap-2">
          {schermate.map((x, n) => <button key={x.id} onClick={() => setI(n)} className={`w-2.5 h-2.5 rounded-full ${n === i ? 'bg-green-600' : x.proposta ? 'bg-green-100' : 'bg-gray-200'}`} aria-label={`schermata ${n + 1}`} />)}
        </div>
        <div className="flex gap-2">
          <button onClick={() => vai(x => x - 1)} disabled={i === 0} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 disabled:opacity-30">←</button>
          <button onClick={() => vai(x => x + 1)} disabled={i === tot - 1} className="px-4 py-2 rounded-xl bg-gray-900 text-white disabled:opacity-30">→</button>
        </div>
      </div>
    </div>
  );
}

// Le slide in PDF (Enrico, 28/9): una per pagina A4 orizzontale, solo in stampa.
export const STILE_STAMPA_SLIDE = `
  @media screen { .stampa-slide { display: none; } }
  @media print {
    @page { size: A4 landscape; margin: 0; }
    body { background: #fff; }
    .no-print { display: none !important; }
    .stampa-slide .foglio { width: 297mm; height: 210mm; padding: 12mm 16mm; overflow: hidden; break-after: page; page-break-after: always; }
    .stampa-slide .foglio:last-child { break-after: auto; page-break-after: auto; }
    /* zoom per stare nel foglio; l'altezza in percentuale non si rimpicciolisce con lo
       zoom (prova del 28/9: copertina e «Grazie» uscivano dal foglio con calc(100%/0.72)) */
    .stampa-slide .foglio > div { zoom: 0.72; height: 100%; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
`;

export function StampaSlide({ schermate }) {
  return (
    <div className="stampa-slide">
      {schermate.map(s => <div key={s.id} className="foglio"><div>{s.el}</div></div>)}
    </div>
  );
}
