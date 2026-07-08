import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

// Pagina PUBBLICA HR (token-gated). MUTA sull'identità dell'azienda: nessun nome
// cliente, nessun logo cliente, nessun dato che colleghi il link a un'azienda
// specifica (l'azienda si risolve SOLO lato server dal token). Due capacità HR:
// (1) SOLA SCRITTURA "aggiungi nuovo ingresso" (conferma neutra, nessun elenco/ritorno);
// (2) SOLA LETTURA aggregata (solo numeri k-anon).
export default function HrIngressoPage() {
  const router = useRouter();
  const token = router.query.token;
  const [nome, setNome] = useState('');
  const [data, setData] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const [agg, setAgg] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/hr/aggregati?token=${encodeURIComponent(token)}`)
      .then(r => r.json()).then(j => { if (j.ok) setAgg(j.aggregati); }).catch(() => {});
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/hr/ingresso', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nome: nome.trim(), data_ingresso: data || null }),
      });
      const j = await r.json();
      setMsg({ ok: !!j.ok, text: j.message || (j.ok ? 'Ingresso registrato. Grazie.' : 'Non è stato possibile registrare l\'ingresso, riprova.') });
      if (j.ok) { setNome(''); setData(''); } // nessun elenco, nessun ritorno del record
    } catch {
      setMsg({ ok: false, text: 'Non è stato possibile registrare l\'ingresso, riprova.' });
    }
    setBusy(false);
  }

  const num = v => (v == null ? '—' : v);
  const box = 'bg-white rounded-2xl border border-gray-200';
  const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <>
      <Head><title>Registrazione nuovo ingresso</title></Head>
      <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Branding PROVIDER (ES Work), MAI il cliente */}
          <div className="text-center mb-6">
            <div className="text-2xl font-bold text-gray-900">ES <span className="text-green-600">Work</span></div>
            <div className="text-sm text-gray-500 mt-1">Registrazione nuovo ingresso</div>
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
              <label className="block text-sm font-semibold text-gray-700 mb-1">Data di ingresso</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
            </div>
            <button type="submit" disabled={busy || !nome.trim()} className="w-full py-3.5 rounded-2xl bg-green-600 text-white font-bold disabled:opacity-50">
              {busy ? 'Invio…' : 'Registra ingresso'}
            </button>
            {msg && (
              <div className={`text-sm text-center px-3 py-2 rounded-xl ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
                {msg.text}
              </div>
            )}
          </form>
          <p className="text-[11px] text-gray-400 text-center mt-4">Il nominativo serve solo alla pianificazione della formazione.</p>
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
