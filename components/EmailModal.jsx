// Mail al referente, scritta e modificabile prima di aprirla nella posta (mailto).
// mailto non allega file: l'allegato lo aggiunge Enrico, e la riga lo ricorda.
//   modal = { to, subject, body }; nota = riga in più (per esempio cosa succede in Pipeline).
import { useState } from 'react';

export default function EmailModal({ modal, onClose, onInvia, nota = null, allegato = 'il PDF' }) {
  const [to, setTo] = useState(modal.to);
  const [subject, setSubject] = useState(modal.subject);
  const [body, setBody] = useState(modal.body);

  const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const campo = 'w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4 no-print">
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-3 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Invia al referente</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">A</label>
          <input value={to} onChange={e => setTo(e.target.value)} className={campo} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Oggetto</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} className={campo} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Testo</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={10} className={`${campo} font-mono resize-none`} />
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          📎 La mail non allega il documento da sola: salva {allegato} con «PDF / Stampa» e allegalo.
          {nota}
        </p>
        <div className="flex gap-3">
          <a href={href} onClick={() => { if (onInvia) onInvia(); }}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold text-center hover:bg-green-700">
            Apri in Mail
          </a>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
