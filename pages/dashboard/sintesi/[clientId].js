import { useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../../lib/auth';

// Sintesi del Report di Attivazione (punto 7): la pagina da lasciare al cliente, in PDF.
// Stessi numeri dell'Offerta e della Presentazione (lib/presentazione-server + lib/sintesi).
export default function SintesiPage({ clientId, azienda, html, errore }) {
  const iframeRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  function stampa() {
    const w = iframeRef.current && iframeRef.current.contentWindow;
    if (w) { w.focus(); w.print(); }
  }
  async function scaricaPdf() {
    setBusy(true); setMsg('');
    const r = await fetch(`/api/clients/${clientId}/sintesi`, { method: 'POST' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (j.url) window.open(j.url, '_blank');
    else setMsg(j.error || j.message || 'PDF non disponibile: usa «Stampa / Salva PDF».');
    setBusy(false);
  }

  return (
    <>
      <Head><title>{`Sintesi — ${azienda || 'ES Work'}`}</title></Head>
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
            <Link href={`/dashboard/${clientId}`} className="text-sm text-gray-500 hover:text-gray-800">← Scheda azienda</Link>
            <div className="flex items-center gap-2">
              <Link href={`/dashboard/presentazione/${clientId}`} className="text-sm font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-200">🖥 Presenta</Link>
              <button onClick={stampa} disabled={!html} className="text-sm font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-200 disabled:opacity-50">🖨 Stampa / Salva PDF</button>
              <button onClick={scaricaPdf} disabled={busy || !html} className="text-sm font-semibold text-white bg-green-600 px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50">{busy ? '…' : '⬇ Scarica PDF'}</button>
            </div>
          </div>
          {msg && <div className="max-w-4xl mx-auto px-5 pb-2 text-xs text-amber-700">{msg}</div>}
        </header>
        <main className="flex-1 max-w-4xl w-full mx-auto p-4">
          {html
            ? <iframe ref={iframeRef} srcDoc={html} title="Sintesi" className="w-full bg-white rounded-xl shadow" style={{ height: 'calc(100vh - 110px)', border: 'none' }} />
            : <div className="text-center text-gray-500 py-20 text-sm">{errore || 'Sintesi non disponibile.'}</div>}
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => {
  const { datiPresentazione } = await import('../../../lib/presentazione-server');
  const { buildSintesiHtml } = await import('../../../lib/sintesi');
  const clientId = ctx.params.clientId;
  const d = await datiPresentazione(clientId).catch(e => ({ errore: `Errore: ${e.message}` }));
  if (d.errore) return { props: { clientId, azienda: d.azienda || null, html: null, errore: d.errore } };
  return { props: { clientId, azienda: d.azienda, html: buildSintesiHtml(d), errore: null } };
});
