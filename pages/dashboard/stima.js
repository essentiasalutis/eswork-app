import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';

// Pagina STIMA (pre-assessment, cliente-facing). Mostra l'output di buildQuoteHtml
// (UNICA fonte) in un iframe stampabile, con Scarica PDF (server). I numeri della
// forbice arrivano da computeForchetta() lato server (/api/stima).
function ratesFromQuery(q) {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };
  return {
    sportello_sell: num(q.rs), sportello_cost: num(q.rsc),
    prevalidation_sell: num(q.rps), prevalidation_cost: num(q.rpc),
    training_sell: num(q.rts), training_cost: num(q.rtc),
  };
}

export default function StimaPage() {
  const router = useRouter();
  const q = router.query;
  const [html, setHtml] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const iframeRef = useRef(null);

  function buildBody(store) {
    return {
      clientId: q.clientId || null,
      name: q.name || '—',
      contact_name: q.contact || null,
      sector: q.sector || 'services',
      employees: q.n || 0,
      tier: q.tier || undefined,
      groups: q.groups != null ? Number(q.groups) : undefined,
      vatExempt: q.vat === '1',
      l2Mult: q.l2mult != null ? Number(q.l2mult) : undefined,
      rates: ratesFromQuery(q),
      store,
    };
  }

  useEffect(() => {
    if (!router.isReady) return;
    (async () => {
      try {
        const r = await fetch('/api/stima', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildBody(false)) });
        const j = await r.json();
        if (j.html) setHtml(j.html); else setErr(j.error || 'Errore nella generazione');
      } catch { setErr('Errore di rete'); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  function stampa() {
    const w = iframeRef.current?.contentWindow;
    if (w) { w.focus(); w.print(); }
  }

  async function scaricaPdf() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/stima', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildBody(true)) });
      const j = await r.json();
      if (j.url) window.open(j.url, '_blank');
      else setErr(j.message || j.error || 'PDF non disponibile — usa Stampa per salvare in PDF.');
    } catch { setErr('Errore di rete'); }
    setBusy(false);
  }

  return (
    <>
      <Head><title>Stima — ES Work</title></Head>
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
            <Link href={q.clientId ? `/dashboard/${q.clientId}` : '/dashboard'} className="text-sm text-gray-500 hover:text-gray-800">← Indietro</Link>
            <div className="flex items-center gap-2">
              <button onClick={stampa} disabled={!html} className="text-sm font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-200 disabled:opacity-50">🖨 Stampa</button>
              <button onClick={scaricaPdf} disabled={busy || !html} className="text-sm font-semibold text-white bg-green-600 px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50">{busy ? '…' : '⬇ Scarica PDF'}</button>
            </div>
          </div>
          {err && <div className="max-w-4xl mx-auto px-5 pb-2 text-xs text-amber-700">{err}</div>}
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto p-4">
          {html ? (
            <iframe ref={iframeRef} srcDoc={html} title="Stima ES Work" className="w-full bg-white rounded-xl shadow" style={{ height: 'calc(100vh - 110px)', border: 'none' }} />
          ) : (
            <div className="text-center text-gray-400 py-20 text-sm">{err || 'Generazione stima…'}</div>
          )}
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async () => ({ props: {} }));
