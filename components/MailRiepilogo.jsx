import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { testoRiepilogo, testoKit, firmaKit } from '../lib/riepilogo';
import { aggiungiGiorni, oggiRoma, etichettaData, avvisiAvvioCheckup } from '../lib/checkup';

// Finestra "Mail di riepilogo" dopo il primo incontro (punto 4+5): la mail di Enrico già
// compilata con i dati dell'azienda, la forbice della Stima, il link del check-up e, in
// fondo, il kit da inoltrare ai dipendenti. Si parte dalla posta di Enrico (mailto) o si
// copia il testo. La data del secondo incontro si salva sull'azienda (agenda della settimana).
export default function MailRiepilogo({ clientId, forchetta, urlStima, onClose }) {
  const [dati, setDati] = useState(null);
  const [err, setErr] = useState('');
  const [to, setTo] = useState('');
  const [contesto, setContesto] = useState('');
  const [secondo, setSecondo] = useState('');
  const [variante, setVariante] = useState('B');
  const [chiudeIl, setChiudeIl] = useState('');
  const [avvio, setAvvio] = useState(false);
  const [corpo, setCorpo] = useState('');
  const [msg, setMsg] = useState('');

  async function carica(prima) {
    const r = await fetch(`/api/clients/${clientId}/riepilogo`).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setErr(j.error || 'Dati dell\'azienda non disponibili'); return; }
    setDati(j);
    if (prima) {
      setTo(j.referente.email || '');
      setContesto(j.contesto || '');
      setSecondo(j.secondo_incontro_il || '');
      setVariante(j.binario === 'A' ? 'A' : 'B');
      setChiudeIl(aggiungiGiorni(oggiRoma(), j.checkupGiorni || 10));
    }
  }
  useEffect(() => { carica(true); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const aperto = dati && dati.checkup.stato === 'aperto';
  const link = dati && typeof window !== 'undefined' ? `${window.location.origin}/q/c/${dati.shareCode}` : '';
  const generato = useMemo(() => {
    if (!dati) return null;
    const kit = aperto ? testoKit({ variante, link, scadenza: dati.checkup.chiude_il, firma: firmaKit({ referente: dati.referente.nome, azienda: dati.azienda }) }) : null;
    return testoRiepilogo({
      referente: dati.referente.nome, contesto, forchetta, urlStima,
      link: aperto ? link : '[il link compare quando avvii il check-up]',
      scadenza: aperto ? dati.checkup.chiude_il : null,
      secondoIncontro: secondo, binario: dati.binario, kit,
    });
  }, [dati, aperto, link, variante, contesto, secondo, forchetta, urlStima]);
  // Cambiando un campo il testo si rigenera (le correzioni fatte a mano nel testo si perdono).
  useEffect(() => { if (generato) setCorpo(generato.corpo); }, [generato]);

  async function avviaCheckup() {
    for (const avviso of avvisiAvvioCheckup({ client: { binario: dati.binario, lettera_stato: dati.lettera_stato, is_demo: dati.is_demo }, altriAperti: dati.checkupAperti.aziende, limite: dati.checkupAperti.limite })) {
      if (!confirm(avviso)) return;
    }
    setAvvio(true); setErr('');
    const r = await fetch('/api/assessments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId, type: 'initial', chiude_il: chiudeIl }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) setErr(j.error || 'Check-up non avviato');
    else await carica(false);
    setAvvio(false);
  }

  // La data del secondo incontro va sull'azienda (non blocca la mail se non si salva).
  async function salvaSecondo() {
    if (!dati || secondo === (dati.secondo_incontro_il || '')) return;
    const r = await fetch(`/api/clients/${clientId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secondo_incontro_il: secondo || null }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r && r.ok) setDati(d => ({ ...d, secondo_incontro_il: secondo || null }));
    else setMsg(`Data del secondo incontro non salvata: ${j.error || 'riprova'}`);
  }

  const pronta = aperto && !!secondo && !!generato;
  const href = generato ? `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(generato.oggetto)}&body=${encodeURIComponent(corpo)}` : '#';
  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl p-5 space-y-3 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">✉️ Mail di riepilogo{dati ? ` — ${dati.azienda}` : ''}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        {!dati && <div className="text-sm text-gray-400">{err || 'Caricamento…'}</div>}
        {dati && (
          <>
            {dati.firmato && (
              <div className="text-xs px-3 py-2 rounded-lg border bg-amber-50 border-amber-200 text-amber-800">
                Questa azienda ha già firmato: la mail di riepilogo e il testo per i dipendenti («stiamo valutando») sono pensati per prima della firma.
              </div>
            )}

            {/* Check-up: serve aperto, per il link e la data nella mail */}
            {aperto ? (
              <div className="text-xs px-3 py-2 rounded-lg border bg-green-50 border-green-200 text-green-800">
                ✓ Check-up aperto fino al {etichettaData(dati.checkup.chiude_il)}: link e scadenza sono nella mail.
              </div>
            ) : dati.checkup.stato === 'chiuso' && dati.checkup.attivo ? (
              <div className="text-xs px-3 py-2 rounded-lg border bg-red-50 border-red-200 text-red-700">
                Il check-up è scaduto il {etichettaData(dati.checkup.chiude_il)}: prorogalo o riaprilo dalla <Link href={`/dashboard/${clientId}`} className="underline font-semibold">scheda azienda</Link>, poi riapri questa finestra.
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap text-xs px-3 py-2 rounded-lg border bg-gray-50 border-gray-200 text-gray-700">
                <span>Il check-up non è ancora avviato: la mail contiene il link e la scadenza.</span>
                <label className="flex items-center gap-1">chiude il
                  <input type="date" value={chiudeIl} min={oggiRoma()} onChange={e => setChiudeIl(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1" />
                </label>
                <button onClick={avviaCheckup} disabled={avvio || !chiudeIl} className="font-semibold bg-green-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">{avvio ? 'Avvio…' : '▶️ Avvia il check-up'}</button>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-gray-500">A
                <input value={to} onChange={e => setTo(e.target.value)} className={`${inputCls} mt-1 font-normal`} />
              </label>
              <label className="text-xs font-semibold text-gray-500">Ci rivediamo il (secondo incontro)
                <input type="date" value={secondo} min={oggiRoma()} onChange={e => setSecondo(e.target.value)} className={`${inputCls} mt-1 font-normal`} />
              </label>
            </div>
            <label className="block text-xs font-semibold text-gray-500">Il punto di partenza (dai dati del colloquio: aggiungi la tua osservazione)
              <textarea value={contesto} onChange={e => setContesto(e.target.value)} rows={2} className={`${inputCls} mt-1 font-normal resize-none`} />
            </label>
            <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
              <span className="font-semibold">Testo per i dipendenti:</span>
              {[['A', 'diretto (A — micro/familiare)'], ['B', 'istituzionale (B — strutturata)']].map(([v, l]) => (
                <button key={v} onClick={() => setVariante(v)} className={`px-2.5 py-1 rounded-lg font-semibold ${variante === v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
              ))}
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1">Oggetto: <span className="font-normal text-gray-700">{generato && generato.oggetto}</span></div>
              <textarea value={corpo} onChange={e => setCorpo(e.target.value)} rows={14} className={`${inputCls} font-mono text-xs resize-y`} />
              <p className="text-[11px] text-gray-400 mt-1">Puoi correggere il testo qui sopra; se poi cambi un campo, il testo si ricompone. Se la posta lo taglia (mail lunga), usa «Copia il testo».</p>
            </div>

            {!pronta && <div className="text-xs text-red-600">{!aperto ? 'Avvia il check-up per inserire link e scadenza.' : !secondo ? 'Manca la data del secondo incontro.' : ''}</div>}
            {msg && <div className="text-xs text-amber-700">{msg}</div>}
            {err && <div className="text-xs text-red-600">{err}</div>}
            <div className="flex gap-3 flex-wrap">
              <a href={pronta ? href : undefined} onClick={e => { if (!pronta) { e.preventDefault(); return; } salvaSecondo(); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-center ${pronta ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                Apri in Mail
              </a>
              <button disabled={!pronta} onClick={async () => { try { await navigator.clipboard.writeText(corpo); setMsg('Testo copiato: incollalo nella mail (oggetto: «' + generato.oggetto + '»).'); } catch { setMsg('Copia non riuscita: seleziona il testo e copialo a mano.'); } salvaSecondo(); }}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold disabled:opacity-40">📋 Copia il testo</button>
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm">Chiudi</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
