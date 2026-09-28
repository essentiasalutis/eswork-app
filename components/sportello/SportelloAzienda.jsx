// La fetta di UN'azienda, dentro la sua scheda: le sue giornate, il riempimento, le sedute
// erogate rispetto al contratto, lo stato dei percorsi e i suoi allarmi. Stessa funzione
// della sezione «Sportello» (Enrico, 28/9: «Stessi dati, due viste. Mai due fonti.»).
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ListaAllarmi, RigaGiornata, ContrattoErogato, PersoneInCarico, giornoBreve, giornoSettimana } from './Sportello';
import { aggiungiGiorniG } from '../../lib/sportello.mjs';

export default function SportelloAzienda({ clientId, oggi }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const da = aggiungiGiorniG(oggi, -7), a = aggiungiGiorniG(oggi, 56);
  const carica = useCallback(async () => {
    const r = await fetch(`/api/sportello?da=${da}&a=${a}&clientId=${encodeURIComponent(clientId)}`).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setErr(j.error || 'Dati dello sportello non disponibili.'); return; }
    setErr(''); setD(j);
  }, [clientId, da, a]);
  useEffect(() => { carica(); }, [carica]);
  const azienda = d && d.aziende.find(c => c.id === clientId);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">🗓 Sportello</h2>
        <Link href={`/dashboard/sportello?nuova=${encodeURIComponent(clientId)}`} className="ml-auto text-xs font-semibold text-white bg-gray-900 px-3 py-1.5 rounded-xl">+ Nuova giornata</Link>
        <Link href="/dashboard/sportello" className="text-xs underline text-gray-600">Tutte le aziende →</Link>
      </div>
      {err && <div className="text-sm text-amber-800">{err}</div>}
      {d && (
        <>
          {d.allarmi.length > 0 && <ListaAllarmi allarmi={d.allarmi.map(x => ({ ...x, azienda: null }))} />}
          <div>
            <div className="text-xs text-gray-400 mb-1.5">Giornate dal {giornoBreve(da)} al {giornoBreve(a)}</div>
            {d.giornate.length
              ? <div className="space-y-1.5">{d.giornate.map(g => (
                <div key={g.id}>
                  <div className="text-xs text-gray-500 mb-0.5">{giornoSettimana(g.data)} {giornoBreve(g.data)}</div>
                  <RigaGiornata g={g} scelte={d.scelte} conAzienda={false} onCambio={carica} />
                </div>
              ))}</div>
              : <div className="text-sm text-gray-500">Nessuna giornata pianificata.</div>}
          </div>
          {azienda && (
            <>
              <ContrattoErogato azienda={azienda} />
              <PersoneInCarico persone={azienda.persone} />
            </>
          )}
        </>
      )}
    </div>
  );
}
