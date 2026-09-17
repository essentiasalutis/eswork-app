// Componente CONDIVISO del consenso GDPR — MUTO sull'azienda.
// Il testo NON sta nel codice: arriva dall'archivio `testi_legali` (prop `testo`,
// caricata lato server). Alla conferma invia al server IL VALORE REALE DI CIASCUNA
// CASELLA insieme all'identificativo della versione mostrata; il server verifica,
// registra una riga per consenso e restituisce l'identificativo della sessione,
// che la pagina consegna col check-up. Nessun consenso «scritto fisso nel codice».
// Usato da /q/c/[client_code] e da /invito/[token].
import { useState, useRef, useEffect } from 'react';

export function ConsentScreen({ testo, canale = 'checkup', onComplete }) {
  const [privacyOk, setPrivacyOk] = useState(false);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState('');
  const [healthOk, setHealthOk] = useState(false);
  const canContinue = privacyOk && healthOk && !invio;

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

  async function conferma() {
    setInvio(true); setErrore('');
    try {
      const r = await fetch('/api/consensi/sessione', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo_id: testo.id, canale, valori: { privacy: privacyOk, salute: healthOk } }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.sessione_id) { setErrore(j.error || 'Non è stato possibile registrare i consensi: riprova.'); setInvio(false); return; }
      onComplete(j.sessione_id);
    } catch { setErrore('Errore di rete: riprova.'); setInvio(false); }
  }

  // Senza testo dall'archivio non si mostra nulla da accettare: niente consensi
  // contro un testo che il server non può dimostrare di aver servito.
  if (!testo || !testo.contenuto) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 text-center">
        <p className="text-sm text-gray-600 max-w-sm">L&apos;informativa non è disponibile in questo momento. Riprova fra qualche minuto; se il problema continua scrivi a info@essentiasalutis.it.</p>
      </div>
    );
  }
  const T = testo.contenuto;

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
            {(T.sezioni || []).map(s => (
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
              {T.consensi?.privacy}
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
              {T.consensi?.salute}
            </span>
          </label>
        </div>

        {errore && <p className="text-sm text-red-600 mb-3">{errore}</p>}
        <button
          onClick={conferma}
          disabled={!canContinue}
          className="w-full py-4 rounded-2xl bg-green-600 text-white font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {invio ? 'Registrazione…' : 'Continua →'}
        </button>
        <p className="text-[11px] text-gray-400 text-center mt-2">Versione dell&apos;informativa: {testo.versione}</p>
      </div>
    </div>
  );
}
