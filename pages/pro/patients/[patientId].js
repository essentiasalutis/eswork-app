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

function NrsSlider({ value, onChange, label }) {
  const color = value <= 3 ? '#16a34a' : value <= 6 ? '#ca8a04' : '#dc2626';
  const desc = value === 0 ? 'nessun dolore' : value <= 3 ? 'lieve' : value <= 6 ? 'moderato' : 'severo';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-2xl font-bold" style={{ color }}>{value}
          <span className="text-xs font-normal text-gray-400"> / 10 — {desc}</span>
        </span>
      </div>
      <input type="range" min={0} max={10} value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full" style={{ accentColor: color }} />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>0 nessun dolore</span><span>10 massimo dolore</span>
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
        <polyline points={closed.map((s,i) => `${xs[i]},${ys(s.nrs_pre??0)}`).join(' ')} fill="none" stroke="#f97316" strokeWidth={2} strokeDasharray="4 2" />
        <polyline points={closed.map((s,i) => `${xs[i]},${ys(s.nrs_post)}`).join(' ')} fill="none" stroke="#16a34a" strokeWidth={2} />
        {closed.map((s, i) => (
          <g key={i}>
            <circle cx={xs[i]} cy={ys(s.nrs_pre??0)} r={3} fill="#f97316" />
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

// ─── Anamnesi — view + edit ───────────────────────────────────────────────────

function AnamnesisBlock({ patient: initial, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [p, setP] = useState(initial);

  // Form state
  const [f, setF] = useState({
    job_activity:           p.job_activity || '',
    sedentary:              p.sedentary ?? false,
    does_sport:             p.does_sport ?? false,
    sport_details:          p.sport_details || '',
    pain_location:          p.pain_location || '',
    pain_onset:             p.pain_onset || '',
    pain_type:              p.pain_type || '',
    takes_medications:      p.takes_medications ?? false,
    medications_details:    p.medications_details || '',
    recent_diagnostics:     p.recent_diagnostics ?? false,
    diagnostics_details:    p.diagnostics_details || '',
    traumas_surgeries:      p.traumas_surgeries || '',
    vision_issues:          p.vision_issues ?? false,
    hearing_issues:         p.hearing_issues ?? false,
    headaches:              p.headaches ?? false,
    bruxism:                p.bruxism ?? false,
    reflux_gastritis:       p.reflux_gastritis ?? false,
    bowel_regular:          p.bowel_regular ?? true,
    cardiovascular_regular: p.cardiovascular_regular ?? true,
    urological_issues:      p.urological_issues || '',
    gynecological_info:     p.gynecological_info || '',
    red_flags:              p.red_flags ?? false,
    red_flags_details:      p.red_flags_details || '',
    notes:                  p.notes || '',
    level:                  p.level || '',
  });

  function upd(k, v) { setF(prev => ({ ...prev, [k]: v })); }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/pro/patients/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setP(updated);
      onUpdated(updated);
      setEditing(false);
      setOpen(true);
    }
  }

  // ── Vista lettura ──
  if (!editing) {
    const boolLabel = v => v === true ? 'Sì' : v === false ? 'No' : '—';
    const hasData = p.pain_location || p.job_activity || p.traumas_surgeries;
    const rows = [
      ['Attività lavorativa', p.job_activity],
      ['Lavoro sedentario', boolLabel(p.sedentary)],
      ['Sport', p.does_sport ? `Sì — ${p.sport_details || ''}` : p.does_sport === false ? 'No' : null],
      ['Zona del dolore', p.pain_location],
      ['Insorgenza', p.pain_onset],
      ['Tipo di dolore', p.pain_type],
      ['Farmaci', p.takes_medications ? `Sì — ${p.medications_details || ''}` : p.takes_medications === false ? 'No' : null],
      ['Esami recenti', p.recent_diagnostics ? `Sì — ${p.diagnostics_details || ''}` : p.recent_diagnostics === false ? 'No' : null],
      ['Traumi / Chirurgie', p.traumas_surgeries],
      ['Problemi visivi', p.vision_issues ? 'Sì' : p.vision_issues === false ? 'No' : null],
      ['Problemi uditivi', p.hearing_issues ? 'Sì' : p.hearing_issues === false ? 'No' : null],
      ['Cefalee', p.headaches ? 'Sì' : p.headaches === false ? 'No' : null],
      ['Bruxismo', p.bruxism ? 'Sì' : p.bruxism === false ? 'No' : null],
      ['Reflusso / gastrite', p.reflux_gastritis ? 'Sì' : p.reflux_gastritis === false ? 'No' : null],
      ['Intestino regolare', p.bowel_regular ? 'Sì' : p.bowel_regular === false ? 'No' : null],
      ['Cardio nella norma', p.cardiovascular_regular ? 'Sì' : p.cardiovascular_regular === false ? 'No' : null],
      ['Note urologiche', p.urological_issues],
      p.gender === 'F' ? ['Note ginecologiche', p.gynecological_info] : null,
      ['Red flags', p.red_flags ? `⚠️ SÌ — ${p.red_flags_details || ''}` : 'No'],
      ['Note anamnesi', p.notes],
    ].filter(Boolean).filter(([, v]) => v);

    return (
      <div className={`rounded-2xl border mb-4 ${p.red_flags ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => setOpen(o => !o)} className="flex-1 flex items-center justify-between text-left">
            <span className="font-medium text-gray-700 text-sm">
              Anamnesi {hasData ? '' : <span className="text-amber-600 font-normal text-xs ml-1">— da compilare</span>}
            </span>
            <span className="text-gray-400 text-sm mr-2">{open ? '▲' : '▼'}</span>
          </button>
          <button
            onClick={() => { setEditing(true); setOpen(true); }}
            className="text-xs px-3 py-1.5 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 shrink-0"
          >
            ✏️ Modifica
          </button>
        </div>

        {!hasData && !open && (
          <div className="px-4 pb-3 text-sm text-amber-700">
            Anamnesi non ancora compilata. Clicca <strong>Modifica</strong> per inserire i dati.
          </div>
        )}

        {open && (
          <div className="px-4 pb-4 space-y-2 border-t border-gray-200 pt-3">
            {rows.length === 0 && <p className="text-sm text-gray-400 italic">Nessun dato inserito.</p>}
            {rows.map(([k, v]) => (
              <div key={k} className="flex gap-2 text-sm">
                <span className="text-gray-500 w-40 shrink-0">{k}:</span>
                <span className="text-gray-800">{v}</span>
              </div>
            ))}
            {p.red_flags && (
              <div className="mt-2 bg-red-100 border border-red-300 rounded-xl px-3 py-2 text-sm text-red-800 font-medium">
                ⚠️ RED FLAGS rilevati — gestire con priorità.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Form modifica ──
  const Row = ({ label, children }) => (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  );
  const TI = ({ k, placeholder }) => (
    <input value={f[k]} onChange={e => upd(k, e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
  );
  const TA = ({ k, placeholder, rows = 2 }) => (
    <textarea value={f[k]} onChange={e => upd(k, e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
  );
  const Toggle = ({ k, label }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={!!f[k]} onChange={e => upd(k, e.target.checked)}
        className="w-4 h-4 rounded accent-green-600" />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );

  return (
    <div className="bg-white rounded-2xl border-2 border-blue-200 p-5 mb-4 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Modifica anamnesi</h3>
        <button onClick={() => setEditing(false)} className="text-gray-400 text-xl leading-none">✕</button>
      </div>

      {/* Livello */}
      <Row label="Livello (da assessment NMQ)">
        <select value={f.level} onChange={e => upd('level', e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">— non specificato —</option>
          <option value="level1">Livello 1 — Trattamento</option>
          <option value="level2">Livello 2 — Prevenzione</option>
          <option value="level3">Livello 3 — Formazione</option>
        </select>
      </Row>

      {/* Attività lavorativa */}
      <div className="border-t border-gray-100 pt-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Attività lavorativa</div>
        <Row label="Descrizione attività in azienda">
          <TI k="job_activity" placeholder="es. operaio reparto montaggio, impiegato ufficio..." />
        </Row>
        <div className="mt-3 space-y-2">
          <Toggle k="sedentary" label="Lavoro prevalentemente sedentario" />
          <Toggle k="does_sport" label="Pratica sport" />
        </div>
        {f.does_sport && (
          <div className="mt-2">
            <Row label="Quale sport, con che frequenza?">
              <TI k="sport_details" placeholder="es. calcetto 2 volte a settimana..." />
            </Row>
          </div>
        )}
      </div>

      {/* Dolore */}
      <div className="border-t border-gray-100 pt-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Sintomatologia</div>
        <div className="space-y-3">
          <Row label="Dove ha male? (zona corporea)">
            <TI k="pain_location" placeholder="es. lombare sinistra, collo, spalla destra..." />
          </Row>
          <Row label="Come è insorto? Quando? Trauma o no?">
            <TA k="pain_onset" placeholder="es. dolore graduale da 6 mesi, peggiorato con lavoro sedentario..." />
          </Row>
          <Row label="Tipo di dolore">
            <TI k="pain_type" placeholder="es. sordo, acuto, bruciore, irradiato al braccio..." />
          </Row>
        </div>
      </div>

      {/* Farmaci / diagnostica */}
      <div className="border-t border-gray-100 pt-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Farmaci e diagnostica</div>
        <div className="space-y-3">
          <Toggle k="takes_medications" label="Assume farmaci" />
          {f.takes_medications && (
            <Row label="Quali farmaci?">
              <TI k="medications_details" placeholder="es. antinfiammatori FANS, cortisone..." />
            </Row>
          )}
          <Toggle k="recent_diagnostics" label="Ha eseguito esami recenti (RX, RM, TAC...)" />
          {f.recent_diagnostics && (
            <Row label="Quali esami e risultato?">
              <TA k="diagnostics_details" placeholder="es. RMN lombare — protrusione L4-L5..." />
            </Row>
          )}
          <Row label="Traumi, fratture, colpi di frusta, interventi chirurgici">
            <TA k="traumas_surgeries" placeholder="es. frattura clavicola 2018, appendicectomia..." />
          </Row>
        </div>
      </div>

      {/* Anamnesi sistemica */}
      <div className="border-t border-gray-100 pt-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Anamnesi sistemica</div>
        <div className="grid grid-cols-2 gap-2">
          <Toggle k="vision_issues" label="Problemi visivi" />
          <Toggle k="hearing_issues" label="Problemi uditivi" />
          <Toggle k="headaches" label="Cefalee / emicranie" />
          <Toggle k="bruxism" label="Bruxismo / serramento" />
          <Toggle k="reflux_gastritis" label="Reflusso / gastrite" />
          <Toggle k="bowel_regular" label="Intestino regolare" />
          <Toggle k="cardiovascular_regular" label="Cardio nella norma" />
        </div>
        <div className="mt-3 space-y-3">
          <Row label="Note urologiche (cistiti, prostata, vescica...)">
            <TI k="urological_issues" placeholder="opzionale" />
          </Row>
          {p.gender === 'F' && (
            <Row label="Note ginecologiche (parti, mestruazioni, complicanze...)">
              <TA k="gynecological_info" placeholder="opzionale" />
            </Row>
          )}
        </div>
      </div>

      {/* Red flags */}
      <div className="border-t border-gray-100 pt-4">
        <div className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">Red Flags</div>
        <Toggle k="red_flags" label="⚠️ Red flags presenti" />
        {f.red_flags && (
          <div className="mt-2">
            <Row label="Dettaglio red flags">
              <TA k="red_flags_details" placeholder="es. dolore notturno, calo peso improvviso, deficit neurologico..." />
            </Row>
          </div>
        )}
      </div>

      {/* Note libere */}
      <div className="border-t border-gray-100 pt-4">
        <Row label="Note libere anamnesi">
          <TA k="notes" placeholder="Tutto ciò che vuoi ricordare..." rows={3} />
        </Row>
      </div>

      {/* Salva */}
      <div className="flex gap-3 pt-2">
        <button onClick={save} disabled={saving}
          className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-60">
          {saving ? 'Salvo...' : '✓ Salva anamnesi'}
        </button>
        <button onClick={() => setEditing(false)}
          className="px-4 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm">
          Annulla
        </button>
      </div>
    </div>
  );
}

// ─── Form nuova sessione ──────────────────────────────────────────────────────

function SessionForm({ patientId, sessionNumber, lastNote, onSaved }) {
  const [nrsPre, setNrsPre] = useState(5);
  const [nrsPost, setNrsPost] = useState(5);
  const [treatmentNotes, setTreatmentNotes] = useState('');
  const [nextNotes, setNextNotes] = useState('');
  const [phase, setPhase] = useState('pre');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function closeSession() {
    if (!treatmentNotes.trim()) return setError('Inserisci le note del trattamento prima di chiudere');
    setSaving(true);
    const res = await fetch(`/api/pro/patients/${patientId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nrs_pre: nrsPre, treatment_notes: treatmentNotes, next_session_notes: nextNotes }),
    });
    if (!res.ok) { setSaving(false); return setError('Errore creazione sessione'); }
    const session = await res.json();

    const res2 = await fetch(`/api/pro/patients/${patientId}/sessions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, nrs_post: nrsPost, close: true }),
    });
    setSaving(false);
    if (res2.ok) {
      onSaved(await res2.json());
    } else {
      setError((await res2.json()).error || 'Errore chiusura');
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
          <button onClick={() => setPhase('post')} className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold">
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
            <textarea value={treatmentNotes} onChange={e => setTreatmentNotes(e.target.value)} rows={3}
              placeholder="Razionale osteopatico, tecniche utilizzate, risposta del paziente..."
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Indicazioni prossima seduta</label>
            <textarea value={nextNotes} onChange={e => setNextNotes(e.target.value)} rows={2}
              placeholder="Esercizi domiciliari, aree da rivalutare, priorità..."
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button onClick={closeSession} disabled={saving}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-bold disabled:opacity-60">
            {saving ? 'Chiudo...' : '✓ Chiudi visita'}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function PatientPage({ proName, patient: initialPatient, sessions: initialSessions, client }) {
  const [patient, setPatient] = useState(initialPatient);
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
              <div className="text-xs text-gray-500">{client.name} · {patient.age ? `${patient.age} anni · ` : ''}{patient.gender}</div>
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

          {/* Anamnesi con modifica */}
          <AnamnesisBlock patient={patient} onUpdated={setPatient} />

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
                      <div className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">→ {s.next_session_notes}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Nuova seduta */}
          {!hasOpenSession && !showNewSession && (
            <button onClick={() => setShowNewSession(true)}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold">
              + Nuova seduta
            </button>
          )}

          {(showNewSession || hasOpenSession) && (
            <SessionForm
              patientId={patient.id}
              sessionNumber={sessions.length + 1}
              lastNote={lastClosed?.next_session_notes || null}
              onSaved={s => { setSessions(prev => [...prev, s]); setShowNewSession(false); }}
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
