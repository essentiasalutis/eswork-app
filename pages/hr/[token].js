import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { CATEGORIE, CATEGORIE_BREVI, STATI, TESTO_MAX, AVVISO_PRIVACY } from '../../lib/comunicazioni';

// Pagina PUBBLICA HR (token-gated). MUTA sull'identità dell'azienda: nessun nome
// cliente, nessun logo cliente, nessun dato che colleghi il link a un'azienda
// specifica (l'azienda si risolve SOLO lato server dal token). Capacità HR:
// (1) SOLA SCRITTURA "aggiungi nuovo ingresso" (conferma neutra, nessun elenco/ritorno);
// (2) SOLA LETTURA aggregata (solo numeri k-anon);
// (3) SCRITTURA di una comunicazione a Essentia Salutis (categoria + testo);
// (4) LETTURA dello STATO delle proprie richieste — mai il testo (lib/comunicazioni.js).
export default function HrIngressoPage() {
  const router = useRouter();
  const token = router.query.token;
  const [nome, setNome] = useState('');
  const [data, setData] = useState('');
  const [area, setArea] = useState('');
  const [busy, setBusy] = useState(false);
  // Comunicazioni
  const [categoria, setCategoria] = useState('postazione_nuova');
  const [testo, setTesto] = useState('');
  const [busyCom, setBusyCom] = useState(false);
  const [msgCom, setMsgCom] = useState(null);
  const [richieste, setRichieste] = useState(null);
  const [msg, setMsg] = useState(null); // { ok, text }
  const [agg, setAgg] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/hr/aggregati?token=${encodeURIComponent(token)}`)
      .then(r => r.json()).then(j => { if (j.ok) setAgg(j.aggregati); }).catch(() => {});
  }, [token]);

  // Stato delle richieste: token nel BODY, non in URL.
  const caricaRichieste = useCallback(() => {
    if (!token) return;
    fetch('/api/hr/comunicazioni', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(r => r.json()).then(j => { if (j.ok) setRichieste(j.richieste || []); }).catch(() => {});
  }, [token]);
  useEffect(() => { caricaRichieste(); }, [caricaRichieste]);

  async function invia(e) {
    e.preventDefault();
    if (!testo.trim()) return;
    setBusyCom(true); setMsgCom(null);
    const ERR = 'Non è stato possibile inviare il messaggio, riprova.';
    try {
      const r = await fetch('/api/hr/comunicazione', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, categoria, testo: testo.trim() }),
      });
      const j = await r.json();
      setMsgCom({ ok: !!j.ok, text: j.message || (j.ok ? 'Messaggio inviato. Grazie.' : ERR) });
      if (j.ok) { setTesto(''); caricaRichieste(); }
    } catch {
      setMsgCom({ ok: false, text: ERR });
    }
    setBusyCom(false);
  }

  async function submit(e) {
    e.preventDefault();
    if (!nome.trim() || !data || !area) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/hr/ingresso', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nome: nome.trim(), data_ingresso: data, area }),
      });
      const j = await r.json();
      setMsg({ ok: !!j.ok, text: j.message || (j.ok ? 'Ingresso registrato. Grazie.' : 'Non è stato possibile registrare l\'ingresso, riprova.') });
      if (j.ok) { setNome(''); setData(''); setArea(''); } // nessun elenco, nessun ritorno del record
    } catch {
      setMsg({ ok: false, text: 'Non è stato possibile registrare l\'ingresso, riprova.' });
    }
    setBusy(false);
  }

  const num = v => (v == null ? '—' : v);
  const dataIt = d => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const box = 'bg-white rounded-2xl border border-gray-200';
  const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <>
      <Head><title>Area HR — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Branding PROVIDER (ES Work), MAI il cliente */}
          <div className="text-center mb-6">
            <div className="text-2xl font-bold text-gray-900">ES <span className="text-green-600">Work</span></div>
            <div className="text-sm text-gray-500 mt-1">Area HR</div>
          </div>

          {/* Aggregati (solo numeri) — sola lettura */}
          {agg && !agg.soppresso && (
            <div className={`${box} p-4 mb-4 grid grid-cols-2 gap-3 text-center`}>
              <div>
                <div className="text-xl font-bold text-green-700">{agg.pctBaseCompletata != null ? `${agg.pctBaseCompletata}%` : '—'}</div>
                <div className="text-xs text-gray-400 mt-0.5">Copertura formazione</div>
              </div>
              <div>
                <div className="text-xl font-bold text-amber-700">{agg.nNuoviInAttesaSoppresso ? `<${agg.sogliaK}` : num(agg.nNuoviInAttesa)}</div>
                <div className="text-xs text-gray-400 mt-0.5">Nuovi ingressi in attesa</div>
              </div>
            </div>
          )}

          {/* Form: SOLA SCRITTURA */}
          <form onSubmit={submit} className={`${box} p-5 space-y-4`}>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome e cognome *</label>
              <input value={nome} onChange={e => setNome(e.target.value)} className={inputCls} placeholder="Nome del nuovo ingresso" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Data di ingresso *</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Dove lavorerà *</label>
              <div className="grid grid-cols-2 gap-2">
                {[['ufficio', 'Ufficio'], ['reparto', 'Reparto / produzione']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setArea(v)}
                    className={`py-3 rounded-xl border text-sm font-semibold ${area === v ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-300 text-gray-700'}`}>{l}</button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Serve a preparare la consulenza ergonomica sulla sua postazione.</p>
            </div>
            <button type="submit" disabled={busy || !nome.trim() || !data || !area} className="w-full py-3.5 rounded-2xl bg-green-600 text-white font-bold disabled:opacity-50">
              {busy ? 'Invio…' : 'Registra ingresso'}
            </button>
            {msg && (
              <div className={`text-sm text-center px-3 py-2 rounded-xl ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
                {msg.text}
              </div>
            )}
          </form>
          <p className="text-[11px] text-gray-400 text-center mt-4">Il nominativo serve solo alla pianificazione della formazione e della consulenza ergonomica.</p>

          {/* Comunicazioni: l'HR SCRIVE (categoria + testo); rilegge solo lo STATO */}
          <form onSubmit={invia} className={`${box} p-5 space-y-4 mt-8`}>
            <div className="text-base font-bold text-gray-900">Scrivi a Essentia Salutis</div>
            <div className="space-y-2">
              {Object.entries(CATEGORIE).map(([v, l]) => (
                <label key={v} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer ${categoria === v ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                  <input type="radio" name="categoria" value={v} checked={categoria === v} onChange={() => setCategoria(v)} className="accent-green-600" />
                  <span className="text-sm text-gray-800">{l}</span>
                </label>
              ))}
            </div>
            <div>
              <textarea value={testo} onChange={e => setTesto(e.target.value.slice(0, TESTO_MAX))} rows={4}
                placeholder={categoria === 'postazione_nuova' ? 'Es. nuova linea di confezionamento dal 1° ottobre, 6 persone' : 'Il tuo messaggio'}
                className={`${inputCls} resize-none`} />
              <div className="flex justify-between items-start gap-3 mt-1">
                <p className="text-[11px] text-amber-700 leading-snug">⚠ {AVVISO_PRIVACY}</p>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">{testo.length}/{TESTO_MAX}</span>
              </div>
            </div>
            <button type="submit" disabled={busyCom || !testo.trim()} className="w-full py-3.5 rounded-2xl bg-gray-900 text-white font-bold disabled:opacity-50">
              {busyCom ? 'Invio…' : 'Invia messaggio'}
            </button>
            {msgCom && (
              <div className={`text-sm text-center px-3 py-2 rounded-xl ${msgCom.ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
                {msgCom.text}
              </div>
            )}
          </form>

          {richieste && richieste.length > 0 && (
            <div className={`${box} p-5 mt-4`}>
              <div className="text-sm font-bold text-gray-900 mb-3">Le tue richieste</div>
              <div className="divide-y divide-gray-100">
                {richieste.map((r, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{CATEGORIE_BREVI[r.categoria] || r.categoria}</div>
                      <div className="text-xs text-gray-400">inviata il {dataIt(r.inviata_il)}</div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${r.stato === 'chiusa' ? 'bg-gray-100 text-gray-500' : r.stato === 'programmata' ? 'bg-green-100 text-green-800' : r.stato === 'presa_in_carico' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                        {STATI[r.stato] || r.stato}
                      </span>
                      {r.stato === 'programmata' && r.data_programmata && (
                        <div className="text-xs text-green-700 mt-1">per il {dataIt(r.data_programmata)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-3">Per i dettagli ti contattiamo direttamente. Il testo dei messaggi non viene mostrato qui, per riservatezza.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Pagina PUBBLICA: nessun requireAuth. Nessuna risoluzione lato server dell'azienda
// qui (avviene solo negli endpoint /api/hr/*), così la pagina non espone il cliente.
export async function getServerSideProps() {
  return { props: {} };
}
