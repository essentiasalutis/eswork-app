// Area dell'osteopata — «Le mie giornate allo sportello» (fase 1, Enrico 28/9).
// L'osteopata vede le giornate a lui assegnate e scrive quanti posti ha prenotato: un
// numero, senza nomi. Vede i suoi allarmi: giornate con meno di 6 posti a 7 giorni, i
// cicli dei suoi pazienti oltre il 45° giorno, il trimestre di prevenzione in scadenza,
// le autosegnalazioni in attesa nelle sue aziende. La proposta automatica della giornata
// arriva dopo la risposta dell'avvocato.
import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireProAuthSsr } from '../../lib/pro-auth';
import { SPORTELLO, postiOccupati } from '../../lib/sportello.mjs';

const giornoBreve = (g) => String(g || '').split('-').reverse().join('/');
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const giornoSettimana = (g) => GIORNI[new Date(`${g}T12:00:00Z`).getUTCDay()];

function Prenotazioni({ g, onFatto }) {
  const [s, setS] = useState(g.sedute_prenotate != null ? String(g.sedute_prenotate) : '');
  const [e, setE] = useState(g.ergonomia_persone != null ? String(g.ergonomia_persone) : '');
  const [esito, setEsito] = useState('');
  const occ = postiOccupati({ sedute_prenotate: s === '' ? null : Number(s), ergonomia_persone: e === '' ? null : Number(e) });
  async function salva() {
    setEsito('');
    const r = await fetch(`/api/pro/sportello?id=${encodeURIComponent(g.id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sedute: s, ergonomia: e }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setEsito(j.error || 'Non salvato: riprova.'); return; }
    setEsito('Salvato.'); onFatto && onFatto();
  }
  const campo = 'w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm';
  return (
    <div className="flex flex-wrap items-end gap-3 mt-2">
      <label className="text-xs text-gray-500">Sedute prenotate<br /><input inputMode="numeric" value={s} onChange={x => setS(x.target.value.replace(/[^0-9]/g, ''))} className={campo} /></label>
      <label className="text-xs text-gray-500">Ergonomia (persone)<br /><input inputMode="numeric" value={e} onChange={x => setE(x.target.value.replace(/[^0-9]/g, ''))} className={campo} /></label>
      <button onClick={salva} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-semibold">Salva</button>
      <span className={`text-xs ${occ != null && occ < SPORTELLO.posti_minimi ? 'text-red-700 font-semibold' : 'text-gray-500'}`}>
        {occ == null ? 'Solo numeri, mai nomi.' : `${occ} posti occupati su ${g.posti}${occ < SPORTELLO.posti_minimi ? ` — sotto i ${SPORTELLO.posti_minimi}` : ''}. Sei persone di ergonomia fanno un posto.`}
      </span>
      {esito && <span className="text-xs text-green-700">{esito}</span>}
    </div>
  );
}

export default function ProSportello({ proName }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const carica = useCallback(async () => {
    const r = await fetch('/api/pro/sportello').catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setErr(j.error || 'Dati non disponibili.'); return; }
    setErr(''); setD(j);
  }, []);
  useEffect(() => { carica(); }, [carica]);

  return (
    <>
      <Head><title>Le mie giornate — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
            <Link href="/pro/dashboard" className="text-gray-400 hover:text-gray-600 p-1">←</Link>
            <div>
              <div className="font-semibold text-gray-900">Le mie giornate allo sportello</div>
              <div className="text-xs text-gray-500">{proName}</div>
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
          {err && <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-900">{err}</div>}
          {d && (
            <section className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Da guardare</div>
              {d.allarmi.length ? (
                <ul className="space-y-1.5">
                  {d.allarmi.map((x, i) => (
                    <li key={i} className={`text-sm rounded-lg px-3 py-2 border ${x.grave ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                      {x.grave ? '⚠' : '•'} <strong>{x.azienda} — </strong>{x.testo}
                      {x.patientId && <> <Link href={`/pro/patients/${x.patientId}`} className="underline">Apri la cartella</Link></>}
                    </li>
                  ))}
                </ul>
              ) : <div className="text-sm text-green-700">✓ Niente da segnalare.</div>}
            </section>
          )}
          {d && (
            <section className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Le prossime 4 settimane</div>
              {d.giornate.length ? (
                <div className="space-y-3">
                  {d.giornate.map(g => (
                    <div key={g.id} className={`rounded-xl border p-3 ${g.conflitto ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                      <div className="flex flex-wrap gap-x-3 text-sm">
                        <span className="font-semibold text-gray-900">{giornoSettimana(g.data)} {giornoBreve(g.data)}</span>
                        <span className="tabular-nums">{g.ora_inizio}–{g.ora_fine}</span>
                        <span className="font-semibold">{g.azienda}</span>
                        {(g.sede || g.stanza) && <span className="text-gray-500">{[g.sede, g.stanza].filter(Boolean).join(' · ')}</span>}
                        <span className="text-gray-500">{g.posti} posti</span>
                        {g.conflitto && <span className="text-xs font-bold text-red-700">sovrapposta a un&apos;altra tua giornata</span>}
                      </div>
                      {g.note_logistiche && <div className="text-xs text-gray-500 mt-1">{g.note_logistiche}</div>}
                      <Prenotazioni g={g} onFatto={carica} />
                    </div>
                  ))}
                </div>
              ) : <div className="text-sm text-gray-500">Nessuna giornata assegnata nelle prossime 4 settimane.</div>}
            </section>
          )}
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireProAuthSsr(async (ctx) => {
  const { getProfessionalById } = await import('../../lib/store');
  const pro = await getProfessionalById(ctx.req.proSession.proId).catch(() => null);
  return { props: { proName: pro ? pro.name : '' } };
});
