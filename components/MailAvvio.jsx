import { useState, useEffect, useMemo } from 'react';
import { testoKitAvvio, testoMailAvvio } from '../lib/avvio';
import { firmaKit } from '../lib/riepilogo';

// Finestra "Kit di avvio" (punto 12): dopo la firma, il testo di Enrico per annunciare ai
// dipendenti la partenza del programma, dentro una mail al referente. Il calendario va
// allegato a mano. La data di avvio è quella dell'azienda ("Avvio programma").
export default function MailAvvio({ client, onClose, onDataSalvata }) {
  const [to, setTo] = useState(client.contact_email || '');
  const [dataAvvio, setDataAvvio] = useState(client.data_avvio_programma || '');
  const [prenotazione, setPrenotazione] = useState('');
  const [variante, setVariante] = useState(client.binario === 'A' ? 'A' : 'B');
  const [contatto, setContatto] = useState([client.contact_name, client.contact_email ? `(${client.contact_email})` : ''].filter(Boolean).join(' '));
  const [corpo, setCorpo] = useState('');
  const [msg, setMsg] = useState('');

  const generato = useMemo(() => {
    const kit = testoKitAvvio({ variante, dataAvvio, prenotazione, contatto, firma: firmaKit({ referente: client.contact_name, azienda: client.name }) });
    return testoMailAvvio({ referente: client.contact_name, azienda: client.name, kit });
  }, [variante, dataAvvio, prenotazione, contatto, client.contact_name, client.name]);
  // Cambiando un campo il testo si ricompone (le correzioni fatte a mano si perdono).
  useEffect(() => { setCorpo(generato.corpo); }, [generato]);

  async function salvaData() {
    if ((dataAvvio || '') === (client.data_avvio_programma || '')) return;
    const r = await fetch(`/api/clients/${client.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data_avvio_programma: dataAvvio || null }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r && r.ok) { if (onDataSalvata) onDataSalvata(dataAvvio || null); }
    else setMsg(`Data di avvio non salvata: ${j.error || 'riprova'}`);
  }

  const pronta = !!dataAvvio && !!prenotazione.trim() && !!contatto.trim();
  const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(generato.oggetto)}&body=${encodeURIComponent(corpo)}`;
  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl p-5 space-y-3 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">🚀 Kit di avvio — {client.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="text-xs px-3 py-2 rounded-lg border bg-amber-50 border-amber-200 text-amber-800">
          📎 Ricordati di allegare il <strong>calendario delle giornate</strong> (sportello e formazione): il testo lo cita, non lo descrive.
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-gray-500">A
            <input value={to} onChange={e => setTo(e.target.value)} className={`${inputCls} mt-1 font-normal`} />
          </label>
          <label className="text-xs font-semibold text-gray-500">Data di avvio in sede
            <input type="date" value={dataAvvio} onChange={e => setDataAvvio(e.target.value)} className={`${inputCls} mt-1 font-normal`} />
          </label>
        </div>
        <label className="block text-xs font-semibold text-gray-500">Per prenotare lo sportello (es. «scrivendo all&apos;ufficio del personale»)
          <input value={prenotazione} onChange={e => setPrenotazione(e.target.value)} className={`${inputCls} mt-1 font-normal`} />
        </label>
        <label className="block text-xs font-semibold text-gray-500">Per qualsiasi domanda (contatto per i dipendenti)
          <input value={contatto} onChange={e => setContatto(e.target.value)} className={`${inputCls} mt-1 font-normal`} />
        </label>
        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
          <span className="font-semibold">Tono:</span>
          {[['A', 'diretto (A — «Ciao a tutti»)'], ['B', 'istituzionale (B — «Gentili colleghe e colleghi»)']].map(([v, l]) => (
            <button key={v} onClick={() => setVariante(v)} className={`px-2.5 py-1 rounded-lg font-semibold ${variante === v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
          ))}
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-1">Oggetto: <span className="font-normal text-gray-700">{generato.oggetto}</span></div>
          <textarea value={corpo} onChange={e => setCorpo(e.target.value)} rows={14} className={`${inputCls} font-mono text-xs resize-y`} />
          <p className="text-[11px] text-gray-400 mt-1">Puoi correggere il testo qui sopra; se poi cambi un campo, il testo si ricompone.</p>
        </div>
        {!pronta && <div className="text-xs text-red-600">{!dataAvvio ? 'Manca la data di avvio.' : !prenotazione.trim() ? 'Scrivi come si prenota lo sportello.' : 'Manca il contatto per le domande.'}</div>}
        {msg && <div className="text-xs text-amber-700">{msg}</div>}
        <div className="flex gap-3 flex-wrap">
          <a href={pronta ? href : undefined} onClick={e => { if (!pronta) { e.preventDefault(); return; } salvaData(); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-center ${pronta ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
            Apri in Mail
          </a>
          <button disabled={!pronta} onClick={async () => { try { await navigator.clipboard.writeText(corpo); setMsg(`Testo copiato: incollalo nella mail (oggetto: «${generato.oggetto}»).`); } catch { setMsg('Copia non riuscita: seleziona il testo e copialo a mano.'); } salvaData(); }}
            className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold disabled:opacity-40">📋 Copia il testo</button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm">Chiudi</button>
        </div>
      </div>
    </div>
  );
}
