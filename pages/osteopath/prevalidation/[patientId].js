import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { requireProAuthSsr } from '../../../lib/pro-auth';
import { getPatientById } from '../../../lib/store';

const PAIN_ZONES = [
  'Collo', 'Spalle', 'Braccia/gomiti', 'Polsi/mani',
  'Schiena alta', 'Schiena bassa/lombare', 'Anche/glutei',
  'Ginocchia', 'Caviglie/piedi',
];

const OUTCOMES = [
  { value: 'l1_confirmed', label: '✅ Confermato L1', desc: 'Il paziente soddisfa i criteri per il trattamento attivo', color: 'green' },
  { value: 'not_l1', label: '❌ Non L1', desc: 'Non soddisfa i criteri — rimane in monitoraggio L2/L3', color: 'red' },
  { value: 'needs_more_info', label: '⏳ Necessita ulteriori info', desc: 'Serve un\'altra valutazione prima di decidere', color: 'amber' },
];

const COLOR_MAP = {
  green: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-800', selBg: 'bg-green-600', selText: 'text-white' },
  red: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-800', selBg: 'bg-red-600', selText: 'text-white' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800', selBg: 'bg-amber-500', selText: 'text-white' },
};

export default function PrevalidationForm({ patient }) {
  const router = useRouter();
  const { patientId } = router.query;

  const [duration, setDuration] = useState('');
  const [nrs, setNrs] = useState(5);
  const [painZone, setPainZone] = useState('');
  const [symptomMonths, setSymptomMonths] = useState('');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!outcome) { setError('Seleziona un esito'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/osteopath/prevalidation/${patientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration_minutes: duration ? parseInt(duration, 10) : null,
          nrs_during_call: nrs,
          pain_zone: painZone || null,
          symptom_duration_months: symptomMonths ? parseInt(symptomMonths, 10) : null,
          clinical_notes: notes || null,
          outcome,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Errore'); setSaving(false); return; }
      setSaved(true);
    } catch { setError('Errore di rete'); }
    setSaving(false);
  }

  if (saved) {
    const isL1 = outcome === 'l1_confirmed';
    return (
      <>
        <Head><title>Pre-validazione completata — ES Work</title></Head>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center">
            <div className="text-5xl mb-4">{isL1 ? '✅' : outcome === 'not_l1' ? '📋' : '⏳'}</div>
            <div className="text-xl font-bold text-gray-900 mb-2">Pre-validazione registrata</div>
            <div className="text-sm text-gray-600 mb-6">
              {isL1
                ? `${patient?.first_name} ${patient?.last_name} è stato promosso a Livello 1. Il ciclo di trattamento può partire.`
                : outcome === 'not_l1'
                ? 'Il paziente rimane in monitoraggio. Nessun cambiamento di livello.'
                : 'Rimane in attesa — servirà un\'ulteriore valutazione.'}
            </div>
            <div className="flex gap-3 justify-center">
              <Link href="/osteopath/dashboard" className="text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl hover:bg-blue-100">
                ← Dashboard
              </Link>
              {isL1 && (
                <Link href={`/osteopath/patient/${patientId}`} className="text-sm font-semibold text-white bg-green-600 px-4 py-2 rounded-xl hover:bg-green-700">
                  Scheda paziente →
                </Link>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>Pre-validazione — {patient?.first_name} {patient?.last_name}</title></Head>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-3">
            <Link href="/osteopath/dashboard" className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="font-semibold text-gray-900">Pre-validazione clinica</div>
              <div className="text-xs text-gray-500">{patient?.first_name} {patient?.last_name} · {patient?.clients?.name}</div>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-6">
          {/* Info call */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm text-blue-800">
            <strong>📞 Compilare durante o immediatamente dopo la videocall</strong> di pre-validazione (15 min) con il paziente.
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Durata call */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <label className="text-sm font-semibold text-gray-700 block mb-3">Durata effettiva della call (minuti)</label>
              <input type="number" min={1} max={90} value={duration} onChange={e => setDuration(e.target.value)}
                placeholder="Es. 20"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            {/* NRS durante call */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                NRS rilevato durante la call: <span className="text-red-600 font-bold text-lg">{nrs}/10</span>
              </label>
              <input type="range" min={0} max={10} value={nrs} onChange={e => setNrs(+e.target.value)}
                className="w-full" style={{ accentColor: '#dc2626' }} />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0 — nessun dolore</span><span>10 — insopportabile</span>
              </div>
            </div>

            {/* Zona dolore */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <label className="text-sm font-semibold text-gray-700 block mb-3">Zona primaria di dolore</label>
              <div className="flex flex-wrap gap-2">
                {PAIN_ZONES.map(z => (
                  <button key={z} type="button" onClick={() => setPainZone(z)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${painZone === z ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                    {z}
                  </button>
                ))}
              </div>
            </div>

            {/* Durata sintomi */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <label className="text-sm font-semibold text-gray-700 block mb-3">Durata sintomi (mesi)</label>
              <input type="number" min={0} max={360} value={symptomMonths} onChange={e => setSymptomMonths(e.target.value)}
                placeholder="Es. 6"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            {/* Note cliniche */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <label className="text-sm font-semibold text-gray-700 block mb-3">Note cliniche</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
                placeholder="Anamnesi, test clinici eseguiti, impressione generale..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 font-[inherit]" />
            </div>

            {/* Esito */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <label className="text-sm font-semibold text-gray-700 block mb-3">Esito della pre-validazione *</label>
              <div className="space-y-3">
                {OUTCOMES.map(o => {
                  const c = COLOR_MAP[o.color];
                  const sel = outcome === o.value;
                  return (
                    <button key={o.value} type="button" onClick={() => setOutcome(o.value)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${sel ? `${c.selBg} border-transparent` : `bg-white ${c.border} hover:${c.bg}`}`}>
                      <div className={`font-bold text-sm ${sel ? c.selText : c.text}`}>{o.label}</div>
                      <div className={`text-xs mt-1 ${sel ? 'text-white opacity-80' : 'text-gray-500'}`}>{o.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
            )}

            <button type="submit" disabled={!outcome || saving}
              className={`w-full py-4 rounded-2xl text-lg font-bold transition-colors ${!outcome || saving ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}>
              {saving ? 'Salvataggio...' : 'Salva pre-validazione →'}
            </button>
          </form>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireProAuthSsr(async (ctx) => {
  const { patientId } = ctx.params;
  const patient = await getPatientById(patientId).catch(() => null);
  if (!patient) return { notFound: true };
  return { props: { patient } };
});
