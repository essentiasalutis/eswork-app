import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { requireProAuthSsr } from '../../../lib/pro-auth';
import {
  getPatientById,
  getSessionsByPatient,
  getAssignmentsByProfessional,
  getClientById,
} from '../../../lib/store';

// ─── NRS Slider ───────────────────────────────────────────────────────────────

function NrsSlider({ value, onChange, label, disabled }) {
  const color = value <= 3 ? '#16a34a' : value <= 6 ? '#ca8a04' : '#dc2626';
  const desc = value === 0 ? 'nessun dolore' : value <= 3 ? 'lieve' : value <= 6 ? 'moderato' : 'severo';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-2xl font-bold" style={{ color }}>{value} <span className="text-xs font-normal text-gray-400">/ 10 — {desc}</span></span>
      </div>
      <input
        type="range" min={0} max={10} value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        disabled={disabled}
        className="w-full accent-green-600"
        style={{ accentColor: color }}
      />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>0 nessun dolore</span>
        <span>10 massimo dolore</span>
      </div>
    </div>
  );
}

// ─── NRS Trend chart (SVG) ────────────────────────────────────────────────────

function NrsTrendChart({ sessions }) {
  const closed = sessions.filter(s => s.closed_at && s.nrs_post !== null);
  if (closed.length < 2) return null;

  const W = 300, H = 100, PAD = 20;
  const xs = closed.map((_, i) => PAD + (i / (closed.length - 1)) * (W - 2 * PAD));
  const ys = v => H - PAD - ((v / 10) * (H - 2 * PAD));

  const prePoints = closed.map((s, i) => `${xs[i]},${ys(s.nrs_pre ?? 0)}`).join(' ');
  const postPoints = closed.map((s, i) => `${xs[i]},${ys(s.nrs_post)}`).join(' ');

  return (
    <div>
      <div className="text-xs text-gray-500 mb-1 flex gap-4">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block" /> NRS pre</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block" /> NRS post</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 100 }}>
        {[0,2,4,6,8,10].map(v => (
          <line key={v} x1={PAD} x2={W-PAD} y1={ys(v)} y2={ys(v)} stroke="#f3f4f6" strokeWidth={1} />
        ))}
        <polyline points={prePoints} fill="none" stroke="#f97316" strokeWidth={2} strokeDasharray="4 2" />
        <polyline points={postPoints} fill="none" stroke="#16a34a" strokeWidth={2} />
        {closed.map((s, i) => (
          <g key={i}>
            <circle cx={xs[i]} cy={ys(s.nrs_pre ?? 0)} r={3} fill="#f97316" />
            <circle cx={xs[i]} cy={ys(s.nrs_post)} r={3} fill="#16a34a" />
          </g>
        ))}
      </svg>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        {closed.map((s, i) => <span key={i}>S{s.session_number}</span>)}
      </div>
    </div>
  );
}

// ─── Riepilogo anamnesi (collassabile) ────────────────────────────────────────

function AnamnesisCard({ patient }) {
  const [open, setOpen] = useState(false);
  const boolLabel = v => v === true ? 'Sì' : v === false ? 'No' : '—';
  const rows = [
    ['Attività lavorativa', patient.job_activity],
    ['Lavoro sedentario', boolLabel(patient.sedentary)],
    ['Sport', patient.does_sport ? `Sì — ${patient.sport_details || ''}` : 'No'],
    ['Zona del dolore', patient.pain_location],
    ['Insorgenza', patient.pain_onset],
    ['Tipo di dolore', patient.pain_type],
    ['Farmaci', patient.takes_medications ? `Sì — ${patient.medications_details || ''}` : 'No'],
    ['Esami recenti', patient.recent_diagnostics ? `Sì — ${patient.diagnostics_details || ''}` : 'No'],
    ['Traumi / Chirurgie', patient.traumas_surgeries],
    ['Problemi visivi', boolLabel(patient.vision_issues)],
    ['Problemi uditivi', boolLabel(patient.hearing_issues)],
    ['Cefalee', boolLabel(patient.headaches)],
    ['Bruxismo / serramento', boolLabel(patient.bruxism)],
    ['Reflusso / gastrite', boolLabel(patient.reflux_gastritis)],
    ['Intestino regolare', boolLabel(patient.bowel_regular)],
    ['Cardio nella norma', boolLabel(patient.cardiovascular_regular)],
    ['Note urologiche', patient.urological_issues],
    patient.gender === 'F' ? ['Note ginecologiche', patient.gynecological_info] : null,
    ['Red flags', patient.red_flags ? `⚠️ SÌ — ${patient.red_flags_details || ''}` : 'No'],
    ['Note anamnesi', patient.notes],
  ].filter(Boolean).filter(([, v]) => v);

  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-medium text-gray-700 text-sm">Anamnesi completa</span>
        <span className="text-gray-400 text-sm">{open ? '▲ chiudi' : '▼ espandi'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-200 pt-3">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="text-gray-500 w-36 shrink-0">{k}:</span>
              <span className="text-gray-800">{v}</span>
            </div>
          ))}
          {patient.red_flags && (
            <div className="mt-2 bg-red-50 border border-red-300 rounded-xl px-3 py-2 text-sm text-red-800 font-medium">
              ⚠️ RED FLAGS rilevati — gestire con priorità e rivalutare.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Form nuova sessione ──────────────────────────────────────────────────────

function SessionForm({ patientId, sessionNumber, lastNote, onSaved }) {
  const [nrsPre, setNrsPre] = useState(5);
  const [nrsPost, setNrsPost] = useState(5);
  const [treatmentNotes, setTreatmentNotes] = useState('');
  const [nextNotes, setNextNotes] = useState('');
  const [phase, setPhase] = useState('pre'); // 'pre' | 'post'
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function closeSession() {
    if (!treatmentNotes.trim()) return setError('Inserisci le note del trattamento prima di chiudere');
    setSaving(true);
    // Crea sessione e la chiude in un unico passaggio
    const res = await fetch(`/api/pro/patients/${patientId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nrs_pre: nrsPre, treatment_notes: treatmentNotes, next_session_notes: nextNotes }),
    });
    if (!res.ok) { setSaving(false); return setError('Errore creazione sessione'); }
    const session = await res.json();

    // Chiudi subito con nrs_post
    const res2 = await fetch(`/api/pro/patients/${patientId}/sessions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, nrs_post: nrsPost, close: true }),
    });
    setSaving(false);
    if (res2.ok) {
      const closed = await res2.json();
      onSaved(closed);
    } else {
      const d = await res2.json();
      setError(d.error || 'Errore chiusura');
    }
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-green-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Seduta #{sessionNumber}</h3>
        <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">in corso</span>
      </div>

      {lastNote && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-sm text-blue-800">
          <span className="font-medium">Indicazioni seduta precedente: </span>{lastNote}
        </div>
      )}

      {phase === 'pre' && (
        <>
          <NrsSlider value={nrsPre} onChange={setNrsPre} label="NRS pre-trattamento" />
          <button
            onClick={() => setPhase('post')}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold"
          >
            Avvia trattamento →
          </button>
        </>
      )}

      {phase === 'post' && (
        <>
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Pre: {nrsPre}/10 registrato</div>
          <NrsSlider value={nrsPost} onChange={setNrsPost} label="NRS post-trattamento" />
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Note trattamento *</label>
            <textarea
              value={treatmentNotes}
              onChange={e => setTreatmentNotes(e.target.value)}
              rows={3}
              placeholder="Razionale osteopatico, tecniche utilizzate, risposta del paziente..."
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Indicazioni prossima seduta</label>
            <textarea
              value={nextNotes}
              onChange={e => setNextNotes(e.target.value)}
              rows={2}
              placeholder="Esercizi domiciliari, aree da rivalutare, priorità..."
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            onClick={closeSession}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-bold disabled:opacity-60"
          >
            {saving ? 'Chiudo...' : '✓ Chiudi visita'}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function PatientPage({ proName, patient, sessions: initialSessions, client }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [showNewSession, setShowNewSession] = useState(false);

  const closedSessions = sessions.filter(s => s.closed_at);
  const lastClosed = closedSessions[closedSessions.length - 1];
  const hasOpenSession = sessions.some(s => !s.closed_at);

  const levelLabel = { level1: 'Livello 1', level2: 'Livello 2', level3: 'Livello 3' };
  const levelColor = { level1: '#dc2626', level2: '#ca8a04', level3: '#16a34a' };

  return (
    <>
      <Head><title>{patient.first_name} {patient.last_name} — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link href={`/pro/clients/${patient.client_id}/patients`} className="text-gray-400 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900">{patient.first_name} {patient.last_name}</div>
              <div className="text-xs text-gray-500">{client.name} · {patient.age} anni · {patient.gender}</div>
            </div>
            {patient.level && (
              <span className="text-xs font-bold px-2 py-1 rounded-full shrink-0"
                style={{ background: levelColor[patient.level] + '18', color: levelColor[patient.level] }}>
                {levelLabel[patient.level]}
              </span>
            )}
          </div>
          <div className="text-center text-xs text-gray-300 pb-1">{proName} — Essentia Salutis</div>
        </header>

        <main className="max-w-xl mx-auto px-4 py-5 space-y-4">

          {/* Anamnesi collassabile */}
          <AnamnesisCard patient={patient} />

          {/* NRS Trend */}
          {closedSessions.length >= 2 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Trend NRS</h3>
              <NrsTrendChart sessions={sessions} />
            </div>
          )}

          {/* Sedute chiuse */}
          {closedSessions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sedute precedenti</h3>
              {closedSessions.map(s => {
                const delta = s.nrs_post - (s.nrs_pre ?? s.nrs_post);
                return (
                  <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-700 text-sm">Seduta #{s.session_number}</span>
                      <span className="text-xs text-gray-400">{new Date(s.date).toLocaleDateString('it-IT')}</span>
                    </div>
                    <div className="flex gap-3 text-sm mb-2">
                      <span className="text-orange-600">Pre: <strong>{s.nrs_pre ?? '—'}</strong></span>
                      <span className="text-gray-400">→</span>
                      <span className="text-green-700">Post: <strong>{s.nrs_post}</strong></span>
                      {s.nrs_pre !== null && (
                        <span className={`font-bold ${delta < 0 ? 'text-green-600' : delta > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          ({delta > 0 ? '+' : ''}{delta})
                        </span>
                      )}
                    </div>
                    {s.treatment_notes && (
                      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-1">{s.treatment_notes}</div>
                    )}
                    {s.next_session_notes && (
                      <div className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                        → {s.next_session_notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Nuova seduta */}
          {!hasOpenSession && !showNewSession && (
            <button
              onClick={() => setShowNewSession(true)}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold"
            >
              + Nuova seduta
            </button>
          )}

          {(showNewSession || hasOpenSession) && (
            <SessionForm
              patientId={patient.id}
              sessionNumber={sessions.length + 1}
              lastNote={lastClosed?.next_session_notes || null}
              onSaved={(newSession) => {
                setSessions(prev => [...prev, newSession]);
                setShowNewSession(false);
              }}
            />
          )}

        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireProAuthSsr(async (ctx) => {
  const { patientId } = ctx.params;
  const proId = ctx.req.proSession.proId;
  const proName = ctx.req.proSession.proName;

  if (ctx.req.proSession.mustReset) {
    return { redirect: { destination: '/pro/reset-password', permanent: false } };
  }

  const patient = await getPatientById(patientId);
  if (!patient) return { notFound: true };

  const assignments = await getAssignmentsByProfessional(proId);
  const allowed = assignments.some(a => a.client_id === patient.client_id);
  if (!allowed) return { notFound: true };

  const [sessions, client] = await Promise.all([
    getSessionsByPatient(patientId),
    getClientById(patient.client_id),
  ]);

  return {
    props: {
      proName,
      patient,
      sessions: sessions.map(s => ({ ...s, professionals: undefined })),
      client,
    },
  };
});
