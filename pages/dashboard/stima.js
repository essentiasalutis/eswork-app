import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { testoMailStima } from '../../lib/stima-mail';
import ArgomentarioVoci from '../../components/ArgomentarioVoci';
import MailRiepilogo from '../../components/MailRiepilogo';
import { dataIt } from '../../lib/date-it.mjs';

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
  const [riepilogo, setRiepilogo] = useState(null); // { forchetta: {min, max}, url } → finestra aperta
  const iframeRef = useRef(null);
  // Mail di riepilogo (punto 4+5) per il programma completo di un'azienda esistente; per
  // il Pacchetto (o una Stima senza azienda) resta la mail breve di prima.
  const conRiepilogo = !!q.clientId && variante === 'programma' && q.prodotto !== 'pacchetto_prevenzione';
  // Si registra solo la Stima di un'azienda, e solo il suo prodotto: la variante Pacchetto
  // mostrata a un'azienda del programma completo non diventa una promessa.
  // snapMeta arriva solo per le aziende del listino v2 (le Stime v1 non si registrano).
  const puoRegistrare = !!q.clientId && !!snapMeta && (variante === 'programma' || q.prodotto === 'pacchetto_prevenzione');

  function buildBody(store, v = variante, registra = false) {
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
      registra,
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

  // «Registra Stima» (Enrico, 27/9): l'UNICO modo in cui la forbice diventa la promessa
  // fatta al cliente (tetto dell'Anno 1 dopo il check-up) e la pipeline passa a «Stima
  // inviata». Scaricare, inviare o aprire il riepilogo non registrano niente.
  async function registraStima() {
    const eurR = (x) => `€${Math.round(Number(x) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;
    const promessaR = snapMeta && snapMeta.forbice ? ` (forbice ${eurR(snapMeta.forbice.min)} – ${eurR(snapMeta.forbice.max)}, il tetto promesso al cliente)` : '';
    if (snapMeta && snapMeta.exists && !window.confirm(`Sostituisce la Stima registrata${snapMeta.at ? ` il ${dataIt(snapMeta.at, { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}${promessaR} con i numeri di adesso. Procedo?`)) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/stima', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildBody(false, variante, true)) });
      const j = await r.json();
      if (!r.ok || !j.ok) { setErr(j.error || 'Stima non registrata: riprova.'); setBusy(false); return; }
      setSnapMeta(j.snapshot ?? snapMeta);
      if (j.html) setHtml(j.html);
    } catch { setErr('Errore di rete: Stima non registrata.'); }
    setBusy(false);
  }

  // "Invia al referente" (Pacchetto o Stima senza azienda): genera il PDF e apre la posta
  // con la mail breve. Per il programma completo c'è la mail di riepilogo (qui sotto).
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

  // "Mail di riepilogo": come sopra genera il PDF, poi apre la finestra con la mail
  // completa di Enrico. Non registra la Stima.
  async function apriRiepilogo() {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/stima', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildBody(true)) });
      const j = await r.json();
      setSnapMeta(j.snapshot ?? snapMeta);
      if (j.html) setHtml(j.html);
      if (!j.ok || !j.forchetta) { setErr(j.error || 'Stima non generata'); setBusy(false); return; }
      if (!j.url) setErr(j.message || j.error || 'PDF non disponibile: allegalo alla mail dopo averlo salvato con Stampa.');
      setRiepilogo({ forchetta: { min: j.forchetta.min && j.forchetta.min.price_y1, max: j.forchetta.max && j.forchetta.max.price_y1 }, url: j.url || null });
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
          <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
            <Link href={q.clientId ? `/dashboard/${q.clientId}` : '/dashboard'} className="text-sm text-gray-500 hover:text-gray-800">← Indietro</Link>
            <div className="flex items-center gap-2">
              {puoRegistrare && (
                <button onClick={registraStima} disabled={busy || !html || (snapMeta && snapMeta.frozen)}
                  title="La forbice diventa la promessa fatta al cliente: dopo il check-up il prezzo dell'Anno 1 non la supera."
                  className="text-sm font-semibold text-emerald-800 bg-emerald-50 border-2 border-emerald-500 px-4 py-2 rounded-xl hover:bg-emerald-100 disabled:opacity-50">
                  📌 {snapMeta && snapMeta.exists ? 'Registra di nuovo' : 'Registra Stima'}
                </button>
              )}
              <button onClick={stampa} disabled={!html} className="text-sm font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-200 disabled:opacity-50">🖨 Stampa</button>
              <button onClick={scaricaPdf} disabled={busy || !html} className="text-sm font-semibold text-white bg-green-600 px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50">{busy ? '…' : '⬇ Scarica PDF'}</button>
              {conRiepilogo
                ? <button onClick={apriRiepilogo} disabled={busy || !html} className="text-sm font-semibold text-white bg-gray-900 px-4 py-2 rounded-xl hover:bg-gray-700 disabled:opacity-50">✉️ Mail di riepilogo</button>
                : <button onClick={inviaAlReferente} disabled={busy || !html} className="text-sm font-semibold text-white bg-gray-900 px-4 py-2 rounded-xl hover:bg-gray-700 disabled:opacity-50">✉️ Invia al referente</button>}
              {variantePacchetto && q.prodotto !== 'pacchetto_prevenzione' && (
                <button onClick={() => mostraVariante(variante === 'programma' ? 'pacchetto' : 'programma')} disabled={busy}
                  className="text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl hover:bg-blue-100 disabled:opacity-50">
                  {variante === 'programma' ? 'Mostra anche il Pacchetto d\'ingresso' : '← Torna al programma completo'}
                </button>
              )}
            </div>
          </div>
          {variante === 'pacchetto' && (
            <div className="max-w-6xl mx-auto px-5 pb-2"><div className="text-xs px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-800 border-blue-200">
              Variante Pacchetto d&apos;ingresso: il prodotto dell&apos;azienda resta il programma completo. Lo cambi nel colloquio solo se il cliente sceglie il Pacchetto; la forbice del programma resta impegnata.
            </div></div>
          )}
          {puoRegistrare && (() => {
            const s = snapMeta;
            const fmt = s.at ? dataIt(s.at, { day: '2-digit', month: 'short', year: 'numeric' }) : null;
            const eurB = (x) => `€${Math.round(Number(x) || 0).toLocaleString('it-IT', { useGrouping: 'always' })}`;
            const forbiceReg = s.forbice ? ` (forbice ${eurB(s.forbice.min)} – ${eurB(s.forbice.max)})` : '';
            let text, cls, icon;
            if (s.frozen) { icon = '🔒'; text = `Stima registrata${fmt ? ` il ${fmt}` : ''}${forbiceReg} e congelata: il Report di Attivazione è già stato generato, non si modifica più.`; cls = 'bg-gray-100 text-gray-600 border-gray-200'; }
            else if (!s.exists) { icon = '⚠'; text = 'Stima NON registrata: dopo il check-up vale il prezzo pieno, senza forbice. Se la consegni al cliente, premi «Registra Stima».'; cls = 'bg-amber-50 text-amber-900 border-amber-300 font-semibold'; }
            else { icon = '✓'; text = `Stima registrata${fmt ? ` il ${fmt}` : ''}${forbiceReg}: la sua forbice è il tetto dell'Anno 1 dopo il check-up.${s.nota ? ` ${s.nota} Non premere «Registra di nuovo»: sostituirebbe la forbice promessa con quella qui sopra.` : s.preview ? ' Se i numeri qui sopra sono cambiati, «Registra di nuovo» la sostituisce.' : ''}`; cls = 'bg-green-50 text-green-700 border-green-200'; }
            return <div className="max-w-6xl mx-auto px-5 pb-2"><div className={`text-xs px-3 py-1.5 rounded-lg border ${cls}`}>{icon} {text}</div></div>;
          })()}
          {err && <div className="max-w-6xl mx-auto px-5 pb-2 text-xs text-amber-700">{err}</div>}
        </header>

        {riepilogo && <MailRiepilogo clientId={q.clientId} forchetta={riepilogo.forchetta} urlStima={riepilogo.url} onClose={() => setRiepilogo(null)} />}
        <main className="flex-1 max-w-6xl w-full mx-auto p-4">
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
