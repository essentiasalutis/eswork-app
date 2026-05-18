import { useState } from 'react';
import Head from 'next/head';
import { getPatientByCareToken } from '../../lib/store';

const PAIN_ZONES = [
  'Collo', 'Spalle', 'Braccia/gomiti', 'Polsi/mani',
  'Schiena alta', 'Schiena bassa/lombare', 'Anche/glutei',
  'Ginocchia', 'Caviglie/piedi',
];

// ─── Pagina self-trigger ───────────────────────────────────────────────────────

function SelfTriggerForm({ token, patient }) {
  const [q1, setQ1] = useState(null);   // nuovo dolore
  const [q2, setQ2] = useState(null);   // peggioramento
  const [q2Nrs, setQ2Nrs] = useState(5);
  const [q2NrsTouched, setQ2NrsTouched] = useState(false);
  const [q3, setQ3] = useState(null);   // vuoi valutazione
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit() {
    setSending(true);
    await fetch(`/api/care/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'self_trigger', q1, q2, q2_nrs: q2 ? q2Nrs : null, q3 }),
    });
    setSending(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-center py-12 px-4">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Grazie!</h2>
        <p className="text-gray-500 text-sm">Le tue risposte sono state registrate. Sarai contattato se necessario.</p>
      </div>
    );
  }

  const canSubmit = q1 !== null && q2 !== null && q3 !== null && (q2 === false || q2NrsTouched);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Come stai oggi?</h1>
        <p className="text-sm text-gray-500 mt-1">Ciao {patient.first_name}, rispondi a 3 domande veloci</p>
      </div>

      {/* Q1 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="font-semibold text-gray-800 mb-3">Hai un nuovo dolore o fastidio che prima non avevi?</p>
        <div className="flex gap-3">
          <button
            onClick={() => setQ1(true)}
            className={`flex-1 py-3 rounded-xl font-semibold border-2 transition-colors ${q1 === true ? 'bg-red-500 border-red-500 text-white' : 'border-gray-200 text-gray-600'}`}
          >
            Sì
          </button>
          <button
            onClick={() => setQ1(false)}
            className={`flex-1 py-3 rounded-xl font-semibold border-2 transition-colors ${q1 === false ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 text-gray-600'}`}
          >
            No
          </button>
        </div>
      </div>

      {/* Q2 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="font-semibold text-gray-800 mb-3">Il dolore attuale è peggiorato rispetto all&apos;inizio del percorso?</p>
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setQ2(true)}
            className={`flex-1 py-3 rounded-xl font-semibold border-2 transition-colors ${q2 === true ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 text-gray-600'}`}
          >
            Sì, è peggiorato
          </button>
          <button
            onClick={() => setQ2(false)}
            className={`flex-1 py-3 rounded-xl font-semibold border-2 transition-colors ${q2 === false ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 text-gray-600'}`}
          >
            No
          </button>
        </div>
        {q2 === true && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">Quanto è intenso il dolore adesso?</span>
              {q2NrsTouched
                ? <span className="text-xl font-bold text-amber-600">{q2Nrs}<span className="text-xs font-normal text-gray-400"> / 10</span></span>
                : <span className="text-xl font-bold text-gray-300">—</span>
              }
            </div>
            <input
              type="range" min={0} max={10} value={q2Nrs}
              onChange={e => { setQ2NrsTouched(true); setQ2Nrs(parseInt(e.target.value)); }}
              className="w-full" style={{ accentColor: '#f59e0b' }}
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0 nessun dolore</span><span>10 massimo dolore</span>
            </div>
          </div>
        )}
      </div>

      {/* Q3 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="font-semibold text-gray-800 mb-3">Vorresti una valutazione dall&apos;osteopata?</p>
        <div className="flex gap-3">
          <button
            onClick={() => setQ3(true)}
            className={`flex-1 py-3 rounded-xl font-semibold border-2 transition-colors ${q3 === true ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 text-gray-600'}`}
          >
            Sì
          </button>
          <button
            onClick={() => setQ3(false)}
            className={`flex-1 py-3 rounded-xl font-semibold border-2 transition-colors ${q3 === false ? 'bg-gray-200 border-gray-200 text-gray-600' : 'border-gray-200 text-gray-600'}`}
          >
            No
          </button>
        </div>
      </div>

      <button
        onClick={submit}
        disabled={!canSubmit || sending}
        className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sending ? 'Invio...' : 'Invia risposte'}
      </button>
    </div>
  );
}

// ─── Pagina checkpoint ────────────────────────────────────────────────────────

function CheckpointForm({ token, patient, type }) {
  const monthLabel = type === 't3' ? '3 mesi' : '6 mesi';
  const [nrs, setNrs] = useState(5);
  const [nrsTouched, setNrsTouched] = useState(false);
  const [nrsBaseline, setNrsBaseline] = useState(5);
  const [nrsBaselineTouched, setNrsBaselineTouched] = useState(false);
  const [painZones, setPainZones] = useState([]);
  const [hasLimitations, setHasLimitations] = useState(null);
  const [wantsContact, setWantsContact] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  function toggleZone(zone) {
    setPainZones(prev => prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]);
  }

  async function submit() {
    setSending(true);
    await fetch(`/api/care/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'checkpoint',
        type,
        nrs: nrsTouched ? nrs : null,
        nrs_baseline: nrsBaselineTouched ? nrsBaseline : null,
        pain_zones: painZones,
        has_limitations: hasLimitations,
        wants_contact: wantsContact,
      }),
    });
    setSending(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="text-center py-12 px-4">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Grazie!</h2>
        <p className="text-gray-500 text-sm">Il tuo checkpoint è stato registrato. Sarai contattato se necessario.</p>
      </div>
    );
  }

  const canSubmit = nrsTouched && hasLimitations !== null && wantsContact !== null;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Checkpoint {monthLabel}</h1>
        <p className="text-sm text-gray-500 mt-1">Ciao {patient.first_name}, 4 domande sul tuo stato attuale</p>
      </div>

      {/* NRS attuale */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-gray-800">Quanto è intenso il tuo dolore adesso?</p>
          {nrsTouched
            ? <span className="text-xl font-bold" style={{ color: nrs <= 3 ? '#16a34a' : nrs <= 6 ? '#ca8a04' : '#dc2626' }}>{nrs}<span className="text-xs font-normal text-gray-400"> / 10</span></span>
            : <span className="text-xl font-bold text-gray-300">—</span>
          }
        </div>
        <input
          type="range" min={0} max={10} value={nrs}
          onChange={e => { setNrsTouched(true); setNrs(parseInt(e.target.value)); }}
          className="w-full"
          style={{ accentColor: nrsTouched ? (nrs <= 3 ? '#16a34a' : nrs <= 6 ? '#ca8a04' : '#dc2626') : '#d1d5db' }}
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0 nessun dolore</span><span>10 massimo dolore</span>
        </div>
      </div>

      {/* NRS baseline */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-gray-800">Quanto era intenso il dolore all&apos;inizio del percorso?</p>
          {nrsBaselineTouched
            ? <span className="text-xl font-bold text-gray-600">{nrsBaseline}<span className="text-xs font-normal text-gray-400"> / 10</span></span>
            : <span className="text-xl font-bold text-gray-300">—</span>
          }
        </div>
        <input
          type="range" min={0} max={10} value={nrsBaseline}
          onChange={e => { setNrsBaselineTouched(true); setNrsBaseline(parseInt(e.target.value)); }}
          className="w-full" style={{ accentColor: '#6b7280' }}
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0 nessun dolore</span><span>10 massimo dolore</span>
        </div>
      </div>

      {/* Zone dolore */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="font-semibold text-gray-800 mb-3">In quali zone senti ancora dolore? <span className="text-xs font-normal text-gray-400">(seleziona tutte)</span></p>
        <div className="flex flex-wrap gap-2">
          {PAIN_ZONES.map(zone => (
            <button
              key={zone}
              onClick={() => toggleZone(zone)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-colors ${painZones.includes(zone) ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 text-gray-600'}`}
            >
              {zone}
            </button>
          ))}
          <button
            onClick={() => setPainZones([])}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-colors ${painZones.length === 0 ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 text-gray-600'}`}
          >
            Nessuna
          </button>
        </div>
      </div>

      {/* Limitazioni */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="font-semibold text-gray-800 mb-3">Il dolore limita le tue attività quotidiane o lavorative?</p>
        <div className="flex gap-3">
          <button
            onClick={() => setHasLimitations(true)}
            className={`flex-1 py-3 rounded-xl font-semibold border-2 transition-colors ${hasLimitations === true ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 text-gray-600'}`}
          >
            Sì
          </button>
          <button
            onClick={() => setHasLimitations(false)}
            className={`flex-1 py-3 rounded-xl font-semibold border-2 transition-colors ${hasLimitations === false ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 text-gray-600'}`}
          >
            No
          </button>
        </div>
      </div>

      {/* Vuoi contatto */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="font-semibold text-gray-800 mb-3">Vorresti essere ricontattato dall&apos;osteopata?</p>
        <div className="flex gap-3">
          <button
            onClick={() => setWantsContact(true)}
            className={`flex-1 py-3 rounded-xl font-semibold border-2 transition-colors ${wantsContact === true ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 text-gray-600'}`}
          >
            Sì
          </button>
          <button
            onClick={() => setWantsContact(false)}
            className={`flex-1 py-3 rounded-xl font-semibold border-2 transition-colors ${wantsContact === false ? 'bg-gray-200 border-gray-200 text-gray-600' : 'border-gray-200 text-gray-600'}`}
          >
            No
          </button>
        </div>
      </div>

      <button
        onClick={submit}
        disabled={!canSubmit || sending}
        className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sending ? 'Invio...' : 'Invia checkpoint'}
      </button>
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function CarePage({ patient, mode, checkpointType }) {
  return (
    <>
      <Head>
        <title>ES Work — Benessere</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">ES </span>
            <span className="text-lg font-bold text-green-600">Work</span>
            <span className="text-xs text-gray-400 ml-1">· {patient.clients?.name}</span>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-6">
          {mode === 'checkpoint'
            ? <CheckpointForm token={patient.care_token} patient={patient} type={checkpointType || 't3'} />
            : <SelfTriggerForm token={patient.care_token} patient={patient} />
          }
        </main>
      </div>
    </>
  );
}

export async function getServerSideProps(ctx) {
  const { token } = ctx.params;
  const { mode, type } = ctx.query;

  const patient = await getPatientByCareToken(token);
  if (!patient) return { notFound: true };

  return {
    props: {
      patient,
      mode: mode === 'checkpoint' ? 'checkpoint' : 'self',
      checkpointType: type === 't6' ? 't6' : 't3',
    },
  };
}
