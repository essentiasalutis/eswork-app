import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { testoMailStima } from '../../lib/stima-mail';
import ArgomentarioVoci from '../../components/ArgomentarioVoci';

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
  const [snapMeta, setSnapMeta] = useState(null); // { exists, frozen, source, preview, at }
  // Variante "Pacchetto d'ingresso" mostrata al cliente SENZA cambiare il prodotto
  // dell'azienda: il prodotto si cambia nel colloquio solo se il cliente lo sceglie.
  const [variante, setVariante] = useState('programma');
  const [variantePacchetto, setVariantePacchetto] = useState(false);
  const iframeRef = useRef(null);

  function buildBody(store, v = variante) {
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
      // v2: input ergonomia + prodotto (la versione del listino resta risolta
      // server-side dal clientId; questi sono solo input di calcolo)
      ergonomiaUfficio: q.ergu != null ? Number(q.ergu) : undefined,
      ergonomiaAddetti: q.erga != null ? Number(q.erga) : undefined,
      ergonomiaPostazioni: q.ergp != null ? Number(q.ergp) : undefined,
      tipoProdotto: q.prodotto === 'pacchetto_prevenzione' || v === 'pacchetto' ? 'pacchetto_prevenzione' : undefined,
      store,
    };
  }

  useEffect(() => {
    if (!router.isReady) return;
    (async () => {
      try {
        const r = await fetch('/api/stima', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildBody(false)) });
        const j = await r.json();
        setSnapMeta(j.snapshot ?? null);
        setVariantePacchetto(!!j.variantePacchetto);
        if (j.html) setHtml(j.html); else setErr(j.error || 'Errore nella generazione');
      } catch { setErr('Errore di rete'); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  function stampa() {
    const w = iframeRef.current?.contentWindow;
    if (w) { w.focus(); w.print(); }
  }

  // "Invia al referente": genera il PDF (così la forbice diventa la promessa fatta
  // al cliente) e apre la posta di Enrico con il testo pronto. Testo = paragrafo
  // "Stima di investimento" della mail di riepilogo di Enrico; al punto 4 del funnel
  // verrà sostituito dalla mail di riepilogo completa (check-up, date, kit).
  async function mostraVariante(v) {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/stima', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildBody(false, v)) });
      const j = await r.json();
      if (!r.ok || !j.html) { setErr(j.error || 'Variante non disponibile'); setBusy(false); return; }
      setVariante(v); setHtml(j.html); setSnapMeta(j.snapshot ?? null);
    } catch { setErr('Errore di rete'); }
    setBusy(false);
  }

  async function inviaAlReferente() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/stima', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildBody(true)) });
      const j = await r.json();
      setSnapMeta(j.snapshot ?? snapMeta);
      if (j.html) setHtml(j.html);
      if (!j.ok) { setErr(j.error || 'Stima non generata'); setBusy(false); return; }
      const ref = j.referente || {};
      const { oggetto, corpo } = testoMailStima({ azienda: q.name, referente: ref.nome || q.contact, forchetta: j.forchetta, pacchetto: j.pacchetto, url: j.url });
      if (!j.url) setErr(j.message || j.error || 'PDF non disponibile: allegalo alla mail dopo averlo salvato con Stampa.');
      window.location.href = `mailto:${encodeURIComponent(ref.email || '')}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`;
    } catch { setErr('Errore di rete'); }
    setBusy(false);
  }

  async function scaricaPdf() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/stima', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildBody(true)) });
      const j = await r.json();
      setSnapMeta(j.snapshot ?? snapMeta);
      if (j.html) setHtml(j.html);
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
              <button onClick={inviaAlReferente} disabled={busy || !html} className="text-sm font-semibold text-white bg-gray-900 px-4 py-2 rounded-xl hover:bg-gray-700 disabled:opacity-50">✉️ Invia al referente</button>
              {variantePacchetto && q.prodotto !== 'pacchetto_prevenzione' && (
                <button onClick={() => mostraVariante(variante === 'programma' ? 'pacchetto' : 'programma')} disabled={busy}
                  className="text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl hover:bg-blue-100 disabled:opacity-50">
                  {variante === 'programma' ? 'Mostra anche il Pacchetto d\'ingresso' : '← Torna al programma completo'}
                </button>
              )}
            </div>
          </div>
          {variante === 'pacchetto' && (
            <div className="max-w-4xl mx-auto px-5 pb-2"><div className="text-xs px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-800 border-blue-200">
              Variante Pacchetto d&apos;ingresso: il prodotto dell&apos;azienda resta il programma completo. Lo cambi nel colloquio solo se il cliente sceglie il Pacchetto; la forbice del programma resta impegnata.
            </div></div>
          )}
          {variante === 'programma' && snapMeta && (() => {
            const s = snapMeta;
            const fmt = s.at ? new Date(s.at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
            let text, cls, icon;
            if (s.frozen) { icon = '🔒'; text = 'Forbice congelata — la catena Stima→Report è chiusa: non più modificabile.'; cls = 'bg-gray-100 text-gray-600 border-gray-200'; }
            else if (s.preview && !s.exists) { icon = '⚠'; text = 'ANTEPRIMA — forbice non impegnata: genera il PDF per fissarla.'; cls = 'bg-amber-50 text-amber-900 border-amber-300 font-semibold'; }
            else if (s.preview && s.exists) { icon = '⚠'; text = `ANTEPRIMA — genera il PDF per aggiornare la forbice impegnata${fmt ? ` (attuale: del ${fmt})` : ''}.`; cls = 'bg-amber-50 text-amber-800 border-amber-200'; }
            else if (s.exists) { icon = '✓'; text = `Forbice impegnata${fmt ? ` — Stima del ${fmt}` : ''}: è la promessa fatta al prospect.`; cls = 'bg-green-50 text-green-700 border-green-200'; }
            else return null;
            return <div className="max-w-4xl mx-auto px-5 pb-2"><div className={`text-xs px-3 py-1.5 rounded-lg border ${cls}`}>{icon} {text}</div></div>;
          })()}
          {err && <div className="max-w-4xl mx-auto px-5 pb-2 text-xs text-amber-700">{err}</div>}
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto p-4">
          <div className="mb-3"><ArgomentarioVoci /></div>
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
