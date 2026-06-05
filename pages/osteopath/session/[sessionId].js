import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { requireProAuthSsr } from '../../../lib/pro-auth';
import { getSessionById } from '../../../lib/store';

export default function SessionForm({ session }) {
  const router = useRouter();
  const { sessionId } = router.query;

  const patient = session?.patients;

  const [nrsPre, setNrsPre] = useState('');
  const [nrsPost, setNrsPost] = useState('');
  const [notes, setNotes] = useState(session?.notes || '');
  const [present, setPresent] = useState(null);
  const [cycleOutcome, setCycleOutcome] = useState('');
  const [pgic, setPgic] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (present === null) { setError('Indica se il paziente era presente'); return; }
    if (cycleOutcome && pgic == null) { setError('Per chiudere il ciclo registra il PGIC del paziente'); return; }
    setSaving(true);
    setError('');
    try {
      const body = {
        nrs_pre: nrsPre !== '' ? parseInt(nrsPre, 10) : null,
        nrs_post: nrsPost !== '' ? parseInt(nrsPost, 10) : null,
        notes: notes || null,
        patient_present: present,
        cycle_outcome: cycleOutcome || null,
        pgic,
      };
      const res = await fetch(`/api/osteopath/session/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Errore'); setSaving(false); return; }
      setSaved(true);
    } catch { setError('Errore di rete'); }
    setSaving(false);
  }

  if (saved) {
    return (
      <>
        <Head><title>Sessione registrata — ES Work</title></Head>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-sm w-full text-center">
            <div className="text-5xl mb-4">✅</div>
            <div className="text-xl font-bold text-gray-900 mb-2">Sessione registrata</div>
            <div className="text-sm text-gray-500 mb-6">I dati NRS e le note sono stati salvati.</div>
            <div className="flex gap-3 justify-center">
              <Link href="/osteopath/dashboard" className="text-sm font-semibold text-white bg-blue-600 px-4 py-2 rounded-xl hover:bg-blue-700">
                Dashboard
              </Link>
              {patient && (
                <Link href={`/osteopath/patient/${patient.id}`} className="text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl hover:bg-blue-100">
                  Scheda paziente
                </Link>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  const sessionDate = session?.date ? new Date(session.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Data non specificata';

  return (
    <>
      <Head><title>Registra sessione — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-3">
            <Link href="/osteopath/dashboard" className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="font-semibold text-gray-900">Registra sessione</div>
              <div className="text-xs text-gray-500">
                {patient ? `${patient.first_name} ${patient.last_name}` : 'Paziente'} · {sessionDate}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-6 space-y-4">

          {/* Presenza */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <label className="text-sm font-semibold text-gray-700 block mb-3">Il paziente era presente?</label>
            <div className="flex gap-3">
              {[{ val: true, label: '✅ Sì, presente', color: 'green' }, { val: false, label: '❌ No-show', color: 'red' }].map(({ val, label, color }) => (
                <button key={String(val)} type="button" onClick={() => setPresent(val)}
                  className={`flex-1 py-3 rounded-xl font-semibold border-2 text-sm transition-colors ${present === val
                    ? color === 'green' ? 'bg-green-600 border-green-600 text-white' : 'bg-red-500 border-red-500 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {present === true && (
            <>
              {/* NRS pre */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  NRS pre-sessione {nrsPre !== '' && <span className="text-red-600 font-bold">({nrsPre}/10)</span>}
                </label>
                <input type="range" min={0} max={10} value={nrsPre !== '' ? nrsPre : 5}
                  onChange={e => setNrsPre(e.target.value)}
                  className="w-full" style={{ accentColor: '#dc2626' }} />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0 — nessun dolore</span><span>10 — insopportabile</span>
                </div>
              </div>

              {/* NRS post */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  NRS post-sessione {nrsPost !== '' && <span className="text-green-700 font-bold">({nrsPost}/10)</span>}
                </label>
                <input type="range" min={0} max={10} value={nrsPost !== '' ? nrsPost : 5}
                  onChange={e => setNrsPost(e.target.value)}
                  className="w-full" style={{ accentColor: '#16a34a' }} />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0 — nessun dolore</span><span>10 — insopportabile</span>
                </div>
                {nrsPre !== '' && nrsPost !== '' && (
                  <div className={`mt-3 text-center text-sm font-bold ${+nrsPost < +nrsPre ? 'text-green-600' : +nrsPost > +nrsPre ? 'text-red-600' : 'text-gray-600'}`}>
                    {+nrsPost < +nrsPre ? `↓ Miglioramento: −${+nrsPre - +nrsPost} punti NRS` : +nrsPost > +nrsPre ? `↑ Peggioramento: +${+nrsPost - +nrsPre} punti NRS` : '→ NRS invariato'}
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <label className="text-sm font-semibold text-gray-700 block mb-3">Note di trattamento</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
                  placeholder="Tecniche utilizzate, risposta del paziente, osservazioni cliniche..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 font-[inherit]" />
              </div>

              {/* Esito ciclo (solo se ultima sessione) */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <label className="text-sm font-semibold text-amber-800 block mb-1">Esito del ciclo (se questa è l&apos;ultima sessione)</label>
                <div className="text-xs text-amber-600 mb-3">Lascia vuoto se il ciclo non è ancora terminato</div>
                <div className="flex gap-3">
                  {[
                    { val: 'improved', label: '✅ Migliorato', desc: 'Risposta positiva al trattamento' },
                    { val: 'no_improvement', label: '⚠️ Non migliorato', desc: 'Nessun beneficio rilevante' },
                  ].map(opt => (
                    <button key={opt.val} type="button" onClick={() => setCycleOutcome(prev => prev === opt.val ? '' : opt.val)}
                      className={`flex-1 p-3 rounded-xl border-2 text-xs font-semibold transition-colors text-left ${cycleOutcome === opt.val ? 'bg-amber-500 border-amber-500 text-white' : 'border-amber-200 text-amber-700 hover:border-amber-400'}`}>
                      <div>{opt.label}</div>
                      <div className={`font-normal mt-0.5 ${cycleOutcome === opt.val ? 'opacity-80' : 'text-amber-500'}`}>{opt.desc}</div>
                    </button>
                  ))}
                </div>

                {/* PGIC — obbligatorio per chiudere il ciclo (uno dei 3 KPI) */}
                {cycleOutcome && (
                  <div className="mt-4">
                    <label className="text-sm font-semibold text-amber-800 block mb-1">PGIC del paziente a fine ciclo</label>
                    <div className="text-xs text-amber-600 mb-2">Impressione globale di cambiamento riferita dal paziente</div>
                    <div className="flex gap-1.5">
                      {[
                        { v: 1, l: 'Molto peggio' }, { v: 2, l: 'Peggio' }, { v: 3, l: 'Invariato' },
                        { v: 4, l: 'Meglio' }, { v: 5, l: 'Molto meglio' },
                      ].map(o => (
                        <button key={o.v} type="button" onClick={() => setPgic(o.v)} title={o.l}
                          className={`flex-1 py-2 rounded-lg border-2 text-sm font-bold ${pgic === o.v ? 'bg-amber-600 border-amber-600 text-white' : 'border-amber-200 text-amber-700'}`}>
                          {o.v}
                        </button>
                      ))}
                    </div>
                    <div className="text-[10px] text-amber-500 mt-1">1 = molto peggio · 5 = molto meglio · obbligatorio per chiudere</div>
                  </div>
                )}
              </div>
            </>
          )}

          {present === false && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm text-gray-600">
              La sessione verrà registrata come <strong>no-show</strong>. Nessun aggiornamento al ciclo di trattamento.
            </div>
          )}

          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

          {present !== null && (
            <form onSubmit={handleSubmit}>
              <button type="submit" disabled={saving}
                className={`w-full py-4 rounded-2xl text-lg font-bold ${saving ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                {saving ? 'Salvataggio...' : 'Salva sessione →'}
              </button>
            </form>
          )}
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireProAuthSsr(async (ctx) => {
  const { sessionId } = ctx.params;
  const session = await getSessionById(sessionId).catch(() => null);
  if (!session) return { notFound: true };
  return { props: { session } };
});
