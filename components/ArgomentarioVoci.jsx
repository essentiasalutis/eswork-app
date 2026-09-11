import { VOCI_PROGRAMMA } from '../lib/programma';

// Argomentario delle 12 voci (testi [A] di Enrico): SOLO per lui, mai stampato.
// Stesso elenco della sezione "Cosa comprende il programma" (lib/programma.js).
export default function ArgomentarioVoci({ aperto = false }) {
  return (
    <details open={aperto} className="no-print bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-900">
      <summary className="cursor-pointer font-semibold">📖 Argomentario — le 12 voci del programma (solo per te, non si stampa)</summary>
      <ol className="mt-2 space-y-2">
        {VOCI_PROGRAMMA.map(v => (
          <li key={v.n}>
            <div className="font-semibold">{v.n} · {v.nome}</div>
            <div className="text-amber-800 mt-0.5 leading-relaxed">{v.argomentario}</div>
          </li>
        ))}
      </ol>
    </details>
  );
}
