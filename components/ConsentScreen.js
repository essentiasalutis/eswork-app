// Componente CONDIVISO del consenso GDPR — SOLO PRESENTAZIONE, MUTO sull'azienda.
// Mostra l'informativa (INFORMATIVA_QUESTIONARIO) + i due consensi (dati personali +
// dati salute art.9) e restituisce la VERSIONE accettata via onComplete(version). NON
// riceve né mostra il nome cliente: il consenso è legato alla PERSONA, non all'azienda.
// Usato da self-declare (/q/c/[client_code]) e dal neoassunto (/invito/[token]) → una
// sola fonte di testo + versioning: il testo cambierà (37 punti legali aperti) e due
// copie sarebbero un buco di compliance garantito. NIENTE submit/routing/client dentro.
import { useState, useRef, useEffect } from 'react';
import { INFORMATIVA_QUESTIONARIO } from '../lib/legal-texts';

export function ConsentScreen({ onComplete }) {
  const [privacyOk, setPrivacyOk] = useState(false);
  const [healthOk, setHealthOk] = useState(false);
  const canContinue = privacyOk && healthOk;

  // L'informativa è lunga e sta in un riquadro che scorre: senza un segnale, chi legge
  // da telefono non capisce che c'è altro testo sotto (Enrico, 13/9). Il segnale
  // compare solo se il testo eccede davvero il riquadro e sparisce arrivati in fondo.
  const boxRef = useRef(null);
  const [altroDaLeggere, setAltroDaLeggere] = useState(false);
  const controllaScorrimento = () => {
    const el = boxRef.current;
    if (!el) return;
    setAltroDaLeggere(el.scrollHeight - el.scrollTop - el.clientHeight > 12);
  };
  useEffect(() => {
    controllaScorrimento();
    window.addEventListener('resize', controllaScorrimento);
    return () => window.removeEventListener('resize', controllaScorrimento);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Fase 1 di 2</div>
          <h2 className="text-xl font-bold text-gray-900">Informativa e consensi</h2>
          <p className="text-xs text-gray-500 mt-1">Entrambe le caselle sono obbligatorie per proseguire.</p>
        </div>

        <div className="relative mb-4">
          <div ref={boxRef} onScroll={controllaScorrimento}
            className="bg-white rounded-2xl border border-gray-200 p-4 max-h-80 overflow-y-auto">
            {INFORMATIVA_QUESTIONARIO.sezioni.map(s => (
              <div key={s.id} className="mb-4">
                <div className="font-semibold text-gray-800 text-sm mb-1">{s.titolo}</div>
                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{s.testo}</p>
              </div>
            ))}
            <div className="text-[11px] text-gray-300 text-center pt-1">— fine dell&apos;informativa —</div>
          </div>
          {altroDaLeggere && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-2xl">
              <div className="h-12 bg-gradient-to-t from-white to-transparent rounded-b-2xl" />
              <div className="flex justify-center -mt-4 pb-2">
                <span className="pointer-events-none text-[11px] font-semibold text-gray-600 bg-white border border-gray-200 shadow-sm rounded-full px-3 py-1">
                  ↓ scorri per leggere tutta l&apos;informativa
                </span>
              </div>
            </div>
          )}
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
              {INFORMATIVA_QUESTIONARIO.consensi.privacy}
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
              {INFORMATIVA_QUESTIONARIO.consensi.salute}
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
