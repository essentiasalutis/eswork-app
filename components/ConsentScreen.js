// Componente CONDIVISO del consenso GDPR — SOLO PRESENTAZIONE, MUTO sull'azienda.
// Mostra l'informativa (INFORMATIVA_QUESTIONARIO) + i due consensi (dati personali +
// dati salute art.9) e restituisce la VERSIONE accettata via onComplete(version). NON
// riceve né mostra il nome cliente: il consenso è legato alla PERSONA, non all'azienda.
// Usato da self-declare (/q/c/[client_code]) e dal neoassunto (/invito/[token]) → una
// sola fonte di testo + versioning: il testo cambierà (37 punti legali aperti) e due
// copie sarebbero un buco di compliance garantito. NIENTE submit/routing/client dentro.
import { useState } from 'react';
import { INFORMATIVA_QUESTIONARIO } from '../lib/legal-texts';

export function ConsentScreen({ onComplete }) {
  const [privacyOk, setPrivacyOk] = useState(false);
  const [healthOk, setHealthOk] = useState(false);
  const canContinue = privacyOk && healthOk;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Fase 1 di 2</div>
          <h2 className="text-xl font-bold text-gray-900">Informativa e consensi</h2>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 max-h-64 overflow-y-auto">
          {INFORMATIVA_QUESTIONARIO.sezioni.map(s => (
            <div key={s.id} className="mb-4">
              <div className="font-semibold text-gray-800 text-sm mb-1">{s.titolo}</div>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{s.testo}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3 mb-6">
          <label className="flex items-start gap-3 bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyOk}
              onChange={e => setPrivacyOk(e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-green-600 flex-shrink-0"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              Ho letto l'informativa sul trattamento dei dati personali e presto il consenso al trattamento dei dati forniti.
            </span>
          </label>

          <label className="flex items-start gap-3 bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={healthOk}
              onChange={e => setHealthOk(e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-green-600 flex-shrink-0"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              Presto il consenso al trattamento dei dati relativi alla salute (art. 9 GDPR) per le finalità di prevenzione del programma ES Work.
            </span>
          </label>
        </div>

        <button
          onClick={() => onComplete(INFORMATIVA_QUESTIONARIO.version)}
          disabled={!canContinue}
          className="w-full py-4 rounded-2xl bg-green-600 text-white font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continua →
        </button>
      </div>
    </div>
  );
}
