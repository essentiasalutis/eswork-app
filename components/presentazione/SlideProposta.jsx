// La proposta di intervento a slide (Enrico, 28/9): si presenta subito dopo il Report,
// con un clic dal «Grazie», oppure da «Mostra al cliente» nella pagina della proposta.
// Stesso contenuto del documento che si firma, in sei schermate; il PDF resta il
// documento A4, quello con la firma.
//   p = { azienda, data, piano, quantita, nuovoProgramma, prezzo: { y1, mese, y2 }, anno2,
//         forchetta: { min, max } | null, inRange, tempo | null, leve, passi | null }
import { Titolo, Schede, Elenco } from './slide';
import { VOCI_PROGRAMMA } from '../../lib/programma';
import { DICITURA_IVA } from '../../lib/iva.mjs';

const eur = (x) => `€${Math.round(Number(x) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;
const K = 'Proposta di intervento';

function Copertina({ p }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-6 py-10">
      <img src="/logo-es.png" alt="Essentia Salutis" className="w-24 h-24 object-contain" />
      <div className="text-6xl md:text-7xl font-extrabold text-gray-900 leading-tight">Proposta di intervento</div>
      <div className="text-3xl text-gray-700">ES <span className="text-green-600 font-bold">Work</span> <span className="text-gray-300 font-light">×</span> {p.azienda}</div>
      {p.data && <div className="text-lg text-gray-400 uppercase tracking-[0.2em]">{p.data}</div>}
    </div>
  );
}

function Programma({ p }) {
  return (
    <>
      <Titolo k={K}>Il vostro programma nel primo anno</Titolo>
      {p.piano ? (
        <ul className="space-y-6 max-w-5xl">
          {p.piano.map(r => (
            <li key={r.testo} className="text-2xl md:text-3xl text-gray-800 flex gap-4 leading-snug">
              <span className="text-green-600">●</span>
              <span>{r.titolo && <strong className="text-gray-900">{r.titolo}: </strong>}{r.testo}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-4">
          {(p.quantita || []).map(q => <li key={q} className="text-2xl md:text-3xl text-gray-800 flex gap-4"><span className="text-green-600">●</span><span>{q}</span></li>)}
        </ul>
      )}
    </>
  );
}

function Comprende() {
  return (
    <>
      <Titolo k={K}>Cosa comprende il programma</Titolo>
      <div className="grid md:grid-cols-3 gap-x-8 gap-y-4 max-w-6xl">
        {VOCI_PROGRAMMA.map(v => (
          <div key={v.n} className="flex gap-3 text-xl text-gray-800 leading-snug">
            <span className="shrink-0 w-9 h-9 rounded-full bg-green-50 text-green-700 font-bold flex items-center justify-center text-base border border-green-200">{v.n}</span>
            <span className="pt-1">{v.nome}</span>
          </div>
        ))}
      </div>
      <div className="text-lg text-gray-500 mt-8">Il dettaglio di ogni voce è nel documento della proposta.</div>
    </>
  );
}

function Investimento({ p }) {
  const f = p.forchetta;
  // La forbice della Stima si mostra solo quando il prezzo ci sta dentro: fuori forbice
  // il cliente vede il totale (come nel documento).
  let barra = null;
  if (f && p.inRange === true) {
    const lo = Math.min(f.min, p.prezzo.y1), hi = Math.max(f.max, p.prezzo.y1);
    const span = Math.max(hi - lo, 1), pad = span * 0.12, a = lo - pad, b = hi + pad;
    const pos = (x) => `${((x - a) / (b - a)) * 100}%`;
    barra = (
      <div className="mt-8 max-w-3xl">
        <div className="text-lg text-gray-500 mb-6">Dentro la Stima di investimento presentata al colloquio</div>
        <div className="relative h-4 bg-gray-100 rounded-full">
          <div className="absolute h-4 bg-green-200 rounded-full" style={{ left: pos(f.min), width: `calc(${pos(f.max)} - ${pos(f.min)})` }} />
          <div className="absolute -top-3 w-10 h-10 rounded-full bg-green-600 border-4 border-white shadow" style={{ left: `calc(${pos(p.prezzo.y1)} - 20px)` }} />
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
      <Titolo k={K}>L&apos;investimento, sui vostri dati reali</Titolo>
      <div className="text-lg font-semibold text-gray-500">Anno 1 — programma completo</div>
      <div className="text-7xl font-extrabold text-green-600 mt-1">{eur(p.prezzo.y1)}</div>
      <div className="text-2xl text-gray-700 mt-2">{eur(p.prezzo.mese)} al mese</div>
      <div className="mt-6 max-w-4xl rounded-2xl bg-gray-50 border border-gray-200 p-5">
        <div className="text-xl text-gray-800">Anno 2 e successivi (indicativo): <strong>{eur(p.prezzo.y2)}</strong> l&apos;anno</div>
        {p.anno2 && <div className="text-lg text-gray-600 mt-2 leading-relaxed">{p.anno2}</div>}
      </div>
      {p.tempo && (
        <div className="mt-5 flex flex-wrap gap-3 text-lg text-gray-700">
          <span className="font-semibold text-gray-500">Tempo per persona nel primo anno:</span>
          <span>chi è in trattamento circa {p.tempo.trattamento} ore</span><span className="text-gray-300">·</span>
          <span>chi è in prevenzione circa {p.tempo.prevenzione} ore</span><span className="text-gray-300">·</span>
          <span>tutti gli altri {p.tempo.altri} ore, di formazione</span>
        </div>
      )}
      <div className="text-sm text-gray-500 mt-2">{DICITURA_IVA}</div>
      {barra}
    </>
  );
}

// `proposta: true` colora diversamente i pallini del lettore: si vede dove comincia.
export function slideProposta(p) {
  if (!p || !p.prezzo) return [];
  return [
    { id: 'p-copertina', proposta: true, el: <Copertina p={p} /> },
    { id: 'p-programma', proposta: true, el: <Programma p={p} /> },
    ...(p.nuovoProgramma ? [{ id: 'p-comprende', proposta: true, el: <Comprende /> }] : []),
    { id: 'p-investimento', proposta: true, el: <Investimento p={p} /> },
    ...(p.leve && p.leve.length ? [{ id: 'p-leve', proposta: true, el: <Schede k={K} titolo="Le leve economiche" voci={p.leve} /> }] : []),
    ...(p.passi && p.passi.length ? [{ id: 'p-accettazione', proposta: true, el: <Elenco k={K} titolo="Per accettare" voci={p.passi} /> }] : []),
  ];
}
