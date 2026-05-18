import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { requireProAuthSsr } from '../../../lib/pro-auth';
import {
  getPatientById,
  getSessionsByPatient,
  getAssignmentsByProfessional,
  getClientById,
  getPatientDocuments,
} from '../../../lib/store';
import PatientDocuments from '../../../components/PatientDocuments';

// ─── NRS Slider ───────────────────────────────────────────────────────────────

function NrsSlider({ value, onChange, label, touched, onTouch }) {
  const color = value <= 3 ? '#16a34a' : value <= 6 ? '#ca8a04' : '#dc2626';
  const desc = value === 0 ? 'nessun dolore' : value <= 3 ? 'lieve' : value <= 6 ? 'moderato' : 'severo';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {touched
          ? <span className="text-2xl font-bold" style={{ color }}>{value}<span className="text-xs font-normal text-gray-400"> / 10 — {desc}</span></span>
          : <span className="text-2xl font-bold text-gray-300">—<span className="text-xs font-normal text-gray-400"> muovi lo slider</span></span>
        }
      </div>
      <input type="range" min={0} max={10} value={value}
        onChange={e => { if (onTouch) onTouch(); onChange(parseInt(e.target.value)); }}
        className="w-full" style={{ accentColor: touched ? color : '#d1d5db' }} />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>0 nessun dolore</span><span>10 massimo dolore</span>
      </div>
    </div>
  );
}

// ─── NRS Trend chart (SVG) ────────────────────────────────────────────────────

function NrsTrendChart({ sessions }) {
  const closed = sessions.filter(s => s.closed_at && s.nrs_pre !== null);
  if (closed.length < 1) return null;
  const W = 300, H = 100, PAD = 20;
  const xs = closed.map((_, i) =>
    closed.length === 1 ? W / 2 : PAD + (i / (closed.length - 1)) * (W - 2 * PAD)
  );
  const ys = v => H - PAD - ((v / 10) * (H - 2 * PAD));
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block" /> NRS per seduta</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 100 }}>
        {[0,2,4,6,8,10].map(v => (
          <line key={v} x1={PAD} x2={W-PAD} y1={ys(v)} y2={ys(v)} stroke="#f3f4f6" strokeWidth={1} />
        ))}
        {closed.length > 1 && (
          <polyline points={closed.map((s,i) => `${xs[i]},${ys(s.nrs_pre)}`).join(' ')} fill="none" stroke="#16a34a" strokeWidth={2} />
        )}
        {closed.map((s, i) => (
          <g key={i}>
            <circle cx={xs[i]} cy={ys(s.nrs_pre)} r={4} fill="#16a34a" />
            <text x={xs[i]} y={ys(s.nrs_pre) - 7} textAnchor="middle" fontSize={9} fill="#374151">{s.nrs_pre}</text>
          </g>
        ))}
      </svg>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        {closed.map((s, i) => <span key={i}>S{s.session_number}</span>)}
      </div>
    </div>
  );
}

// ─── Form helpers (definiti FUORI dal componente per evitare il bug di freeze) ──

function FormRow({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function FormInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
    />
  );
}

function FormTextarea({ value, onChange, placeholder, rows = 2 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
    />
  );
}

function FormToggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded accent-green-600"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

// ─── Anamnesi — view + edit ───────────────────────────────────────────────────

function AnamnesisBlock({ patient: initial, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [p, setP] = useState(initial);

  const [f, setF] = useState({
    job_activity:                 p.job_activity || '',
    sedentary:                    p.sedentary ?? false,
    does_sport:                   p.does_sport ?? false,
    sport_details:                p.sport_details || '',
    pain_location:                p.pain_location || '',
    pain_onset:                   p.pain_onset || '',
    pain_type:                    p.pain_type || '',
    takes_medications:            p.takes_medications ?? false,
    medications_details:          p.medications_details || '',
    recent_diagnostics:           p.recent_diagnostics ?? false,
    diagnostics_details:          p.diagnostics_details || '',
    traumas_surgeries:            p.traumas_surgeries || '',
    vision_issues:                p.vision_issues ?? false,
    vision_details:               p.vision_details || '',
    hearing_issues:               p.hearing_issues ?? false,
    hearing_details:              p.hearing_details || '',
    headaches:                    p.headaches ?? false,
    headaches_details:            p.headaches_details || '',
    bruxism:                      p.bruxism ?? false,
    bruxism_details:              p.bruxism_details || '',
    has_cardiovascular_issues:    p.has_cardiovascular_issues ?? false,
    cardiovascular_details:       p.cardiovascular_details || '',
    has_gastrointestinal_issues:  p.has_gastrointestinal_issues ?? false,
    gastrointestinal_details:     p.gastrointestinal_details || '',
    urological_issues:            p.urological_issues || '',
    gynecological_info:           p.gynecological_info || '',
    obstetric_history:            p.obstetric_history || '',
    red_flags:                    p.red_flags ?? false,
    red_flags_details:            p.red_flags_details || '',
    notes:                        p.notes || '',
    level:                        p.level || '',
  });

  // Stato locale per checkbox show/hide (non salvato: derivato dal testo)
  const [showUrological, setShowUrological] = useState(!!p.urological_issues);
  const [showGynecological, setShowGynecological] = useState(!!p.gynecological_info);

  function upd(k, v) { setF(prev => ({ ...prev, [k]: v })); }

  async function save() {
    setSaving(true);
    const payload = { ...f };
    if (!showUrological) payload.urological_issues = '';
    if (!showGynecological) payload.gynecological_info = '';
    const res = await fetch(`/api/pro/patients/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
    const yn = v => v === true ? 'Sì' : v === false ? 'No' : null;
    const hasData = p.pain_location || p.job_activity || p.traumas_surgeries;
    const rows = [
      ['Attività lavorativa', p.job_activity],
      ['Lavoro sedentario', yn(p.sedentary)],
      ['Sport', p.does_sport ? `Sì — ${p.sport_details || ''}` : p.does_sport === false ? 'No' : null],
      ['Zona del dolore', p.pain_location],
      ['Insorgenza', p.pain_onset],
      ['Tipo di dolore', p.pain_type],
      ['Farmaci', p.takes_medications ? `Sì — ${p.medications_details || ''}` : p.takes_medications === false ? 'No' : null],
      ['Esami recenti', p.recent_diagnostics ? `Sì — ${p.diagnostics_details || ''}` : p.recent_diagnostics === false ? 'No' : null],
      ['Traumi / Chirurgie', p.traumas_surgeries],
      p.vision_issues ? ['Problemi visivi', p.vision_details || 'Sì'] : null,
      p.hearing_issues ? ['Problemi uditivi', p.hearing_details || 'Sì'] : null,
      p.headaches ? ['Cefalee / emicranie', p.headaches_details || 'Sì'] : null,
      p.bruxism ? ['Bruxismo / serramento', p.bruxism_details || 'Sì'] : null,
      p.has_cardiovascular_issues ? ['Prob. cardiovascolari', p.cardiovascular_details || 'Sì'] : null,
      p.has_gastrointestinal_issues ? ['Prob. gastrointestinali', p.gastrointestinal_details || 'Sì'] : null,
      p.urological_issues ? ['Prob. urologiche', p.urological_issues] : null,
      p.gynecological_info ? ['Prob. ginecologiche', p.gynecological_info] : null,
      p.obstetric_history ? ['Parti / cesarei / interruzioni', p.obstetric_history] : null,
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
                <span className="text-gray-500 w-44 shrink-0">{k}:</span>
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
  return (
    <div className="bg-white rounded-2xl border-2 border-blue-200 p-5 mb-4 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Modifica anamnesi</h3>
        <button onClick={() => setEditing(false)} className="text-gray-400 text-xl leading-none">✕</button>
      </div>

      {/* Livello */}
      <FormRow label="Livello (da assessment NMQ)">
        <select value={f.level} onChange={e => upd('level', e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">— non specificato —</option>
          <option value="level1">Livello 1 — Trattamento</option>
          <option value="level2">Livello 2 — Prevenzione</option>
          <option value="level3">Livello 3 — Formazione</option>
        </select>
      </FormRow>

      {/* Attività lavorativa */}
      <div className="border-t border-gray-100 pt-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Attività lavorativa</div>
        <FormRow label="Descrizione attività in azienda">
          <FormInput value={f.job_activity} onChange={v => upd('job_activity', v)} placeholder="es. operaio reparto montaggio, impiegato ufficio..." />
        </FormRow>
        <div className="mt-3 space-y-2">
          <FormToggle checked={f.sedentary} onChange={v => upd('sedentary', v)} label="Lavoro prevalentemente sedentario" />
          <FormToggle checked={f.does_sport} onChange={v => upd('does_sport', v)} label="Pratica sport" />
        </div>
        {f.does_sport && (
          <div className="mt-2">
            <FormRow label="Quale sport, con che frequenza?">
              <FormInput value={f.sport_details} onChange={v => upd('sport_details', v)} placeholder="es. calcetto 2 volte a settimana..." />
            </FormRow>
          </div>
        )}
      </div>

      {/* Sintomatologia */}
      <div className="border-t border-gray-100 pt-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Sintomatologia</div>
        <div className="space-y-3">
          <FormRow label="Dove ha male? (zona corporea)">
            <FormInput value={f.pain_location} onChange={v => upd('pain_location', v)} placeholder="es. lombare sinistra, collo, spalla destra..." />
          </FormRow>
          <FormRow label="Come è insorto? Quando? Trauma o no?">
            <FormTextarea value={f.pain_onset} onChange={v => upd('pain_onset', v)} placeholder="es. dolore graduale da 6 mesi, peggiorato con lavoro sedentario..." />
          </FormRow>
          <FormRow label="Tipo di dolore">
            <FormInput value={f.pain_type} onChange={v => upd('pain_type', v)} placeholder="es. sordo, acuto, bruciore, irradiato al braccio..." />
          </FormRow>
        </div>
      </div>

      {/* Farmaci / diagnostica */}
      <div className="border-t border-gray-100 pt-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Farmaci e diagnostica</div>
        <div className="space-y-3">
          <FormToggle checked={f.takes_medications} onChange={v => upd('takes_medications', v)} label="Assume farmaci" />
          {f.takes_medications && (
            <FormRow label="Quali farmaci?">
              <FormInput value={f.medications_details} onChange={v => upd('medications_details', v)} placeholder="es. antinfiammatori FANS, cortisone..." />
            </FormRow>
          )}
          <FormToggle checked={f.recent_diagnostics} onChange={v => upd('recent_diagnostics', v)} label="Ha eseguito esami recenti (RX, RM, TAC...)" />
          {f.recent_diagnostics && (
            <FormRow label="Quali esami e risultato?">
              <FormTextarea value={f.diagnostics_details} onChange={v => upd('diagnostics_details', v)} placeholder="es. RMN lombare — protrusione L4-L5..." />
            </FormRow>
          )}
          <FormRow label="Traumi, fratture, colpi di frusta, interventi chirurgici">
            <FormTextarea value={f.traumas_surgeries} onChange={v => upd('traumas_surgeries', v)} placeholder="es. frattura clavicola 2018, appendicectomia..." />
          </FormRow>
        </div>
      </div>

      {/* Anamnesi sistemica */}
      <div className="border-t border-gray-100 pt-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Anamnesi sistemica</div>
        <div className="space-y-3">

          {/* Visivi */}
          <FormToggle checked={f.vision_issues} onChange={v => upd('vision_issues', v)} label="Problemi visivi" />
          {f.vision_issues && (
            <FormRow label="Dettaglio problemi visivi">
              <FormInput value={f.vision_details} onChange={v => upd('vision_details', v)} placeholder="es. miopia grave, glaucoma, strabismo..." />
            </FormRow>
          )}

          {/* Uditivi */}
          <FormToggle checked={f.hearing_issues} onChange={v => upd('hearing_issues', v)} label="Problemi uditivi" />
          {f.hearing_issues && (
            <FormRow label="Dettaglio problemi uditivi">
              <FormInput value={f.hearing_details} onChange={v => upd('hearing_details', v)} placeholder="es. ipoacusia, acufeni, vertigini..." />
            </FormRow>
          )}

          {/* Cefalee */}
          <FormToggle checked={f.headaches} onChange={v => upd('headaches', v)} label="Cefalee / emicranie" />
          {f.headaches && (
            <FormRow label="Dettaglio cefalee / emicranie">
              <FormInput value={f.headaches_details} onChange={v => upd('headaches_details', v)} placeholder="es. emicrania con aura, cefalea tensiva quotidiana..." />
            </FormRow>
          )}

          {/* Bruxismo */}
          <FormToggle checked={f.bruxism} onChange={v => upd('bruxism', v)} label="Bruxismo / serramento" />
          {f.bruxism && (
            <FormRow label="Dettaglio bruxismo / serramento">
              <FormInput value={f.bruxism_details} onChange={v => upd('bruxism_details', v)} placeholder="es. notturno, bite, dolore ATM..." />
            </FormRow>
          )}

          {/* Cardiovascolare */}
          <FormToggle checked={f.has_cardiovascular_issues} onChange={v => upd('has_cardiovascular_issues', v)} label="Problemi cardiovascolari" />
          {f.has_cardiovascular_issues && (
            <FormRow label="Dettaglio problemi cardiovascolari">
              <FormInput value={f.cardiovascular_details} onChange={v => upd('cardiovascular_details', v)} placeholder="es. ipertensione, tachicardia, cardiopatia..." />
            </FormRow>
          )}

          {/* Gastrointestinale */}
          <FormToggle checked={f.has_gastrointestinal_issues} onChange={v => upd('has_gastrointestinal_issues', v)} label="Problemi gastrointestinali" />
          {f.has_gastrointestinal_issues && (
            <FormRow label="Dettaglio problemi gastrointestinali">
              <FormInput value={f.gastrointestinal_details} onChange={v => upd('gastrointestinal_details', v)} placeholder="es. colon irritabile, Crohn, stipsi cronica..." />
            </FormRow>
          )}

          {/* Urologiche */}
          <FormToggle
            checked={showUrological}
            onChange={v => {
              setShowUrological(v);
              if (!v) upd('urological_issues', '');
            }}
            label="Problematiche urologiche"
          />
          {showUrological && (
            <FormRow label="Dettaglio problematiche urologiche">
              <FormInput value={f.urological_issues} onChange={v => upd('urological_issues', v)} placeholder="es. cistiti ricorrenti, calcoli renali, ipertrofia prostatica..." />
            </FormRow>
          )}

          {/* Ginecologiche */}
          <FormToggle
            checked={showGynecological}
            onChange={v => {
              setShowGynecological(v);
              if (!v) upd('gynecological_info', '');
            }}
            label="Problematiche ginecologiche"
          />
          {showGynecological && (
            <FormRow label="Dettaglio problematiche ginecologiche">
              <FormTextarea value={f.gynecological_info} onChange={v => upd('gynecological_info', v)} placeholder="es. endometriosi, ciclo irregolare, menopausa..." />
            </FormRow>
          )}

          {/* Parti / cesarei / interruzioni — solo F */}
          {p.gender === 'F' && (
            <FormRow label="Parti, cesarei, interruzioni di gravidanza">
              <FormTextarea value={f.obstetric_history} onChange={v => upd('obstetric_history', v)} placeholder="es. 2 parti naturali, 1 cesareo nel 2019..." />
            </FormRow>
          )}

        </div>
      </div>

      {/* Red flags */}
      <div className="border-t border-gray-100 pt-4">
        <div className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">Red Flags</div>
        <FormToggle checked={f.red_flags} onChange={v => upd('red_flags', v)} label="⚠️ Red flags presenti" />
        {f.red_flags && (
          <div className="mt-2">
            <FormRow label="Dettaglio red flags">
              <FormTextarea value={f.red_flags_details} onChange={v => upd('red_flags_details', v)} placeholder="es. dolore notturno, calo peso improvviso, deficit neurologico..." />
            </FormRow>
          </div>
        )}
      </div>

      {/* Note libere */}
      <div className="border-t border-gray-100 pt-4">
        <FormRow label="Note libere anamnesi">
          <FormTextarea value={f.notes} onChange={v => upd('notes', v)} placeholder="Tutto ciò che vuoi ricordare..." rows={3} />
        </FormRow>
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

function SessionForm({ patientId, sessionNumber, lastNote, anamnesiNrs, onSaved }) {
  const isFirst = sessionNumber === 1;
  const [nrs, setNrs] = useState(0);
  const [nrsTouched, setNrsTouched] = useState(false);
  const [treatmentNotes, setTreatmentNotes] = useState('');
  const [nextNotes, setNextNotes] = useState('');
  const [flagRestrat, setFlagRestrat] = useState(false);
  // Prima seduta: salta la fase NRS (già raccolto in anamnesi), vai diretto al trattamento
  const [phase, setPhase] = useState(isFirst ? 'post' : 'pre');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function closeSession() {
    if (!treatmentNotes.trim()) return setError('Inserisci le note del trattamento prima di chiudere');
    setSaving(true);
    const res = await fetch(`/api/pro/patients/${patientId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nrs_pre: isFirst ? (anamnesiNrs ?? null) : (nrsTouched ? nrs : null),
        treatment_notes: treatmentNotes,
        next_session_notes: nextNotes,
        close: true,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const session = await res.json();
      if (flagRestrat) {
        try {
          await fetch(`/api/pro/patients/${patientId}/restratification-flag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: session?.id, notes: treatmentNotes }),
          });
        } catch (e) {
          console.error('Errore flag ri-stratificazione:', e);
        }
      }
      onSaved(session);
    } else {
      if (res.status === 401) {
        window.location.href = '/pro/login?expired=1';
        return;
      }
      const d = await res.json();
      setError(d.error || 'Errore salvataggio');
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
          <NrsSlider value={nrs} onChange={setNrs} label="NRS inizio seduta" touched={nrsTouched} onTouch={() => setNrsTouched(true)} />
          <button
            onClick={() => { if (nrsTouched) setPhase('post'); }}
            disabled={!nrsTouched}
            className="w-full py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: nrsTouched ? '#2563eb' : '#e2e8f0', color: nrsTouched ? '#fff' : '#94a3b8' }}
          >
            {nrsTouched ? 'Avvia trattamento →' : 'Imposta NRS per avviare il trattamento'}
          </button>
        </>
      )}
      {phase === 'post' && (
        <>
          <div className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-600 flex items-center justify-between">
            <span>
              {isFirst && anamnesiNrs !== undefined
                ? <>NRS registrato in anamnesi: <strong>{anamnesiNrs}/10</strong></>
                : <>NRS registrato: <strong>{nrs}/10</strong></>
              }
            </span>
            {!isFirst && (
              <button
                onClick={() => setPhase('pre')}
                className="text-xs text-blue-600 font-semibold hover:underline ml-3"
              >
                ✏️ modifica
              </button>
            )}
          </div>
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
          {/* Flag ri-stratificazione */}
          <div className={`rounded-xl border-2 px-4 py-3 ${flagRestrat ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={flagRestrat}
                onChange={e => setFlagRestrat(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded accent-amber-500"
              />
              <div>
                <span className="text-sm font-semibold text-amber-800">⬆️ Proponi passaggio a Livello 1</span>
                <p className="text-xs text-amber-700 mt-0.5">Segnala al referente ES Work — consuma capacità dal buffer 15%</p>
              </div>
            </label>
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

export default function PatientPage({ proName, patient: initialPatient, sessions: initialSessions, client, documents: initialDocs }) {
  const router = useRouter();
  const [patient, setPatient] = useState(initialPatient);
  const [sessions, setSessions] = useState(initialSessions);
  const [showNewSession, setShowNewSession] = useState(false);
  const [patientDocs, setPatientDocs] = useState(initialDocs || []);
  const [careToken, setCareTokenState] = useState(initialPatient.care_token || null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [copied, setCopied] = useState(null); // 'self' | 't3' | 't6' | null
  const [careTokenError, setCareTokenError] = useState(null);

  async function generateCareToken() {
    setGeneratingToken(true);
    setCareTokenError(null);
    try {
      const res = await fetch(`/api/pro/patients/${patient.id}/generate-care-token`, { method: 'POST' });
      if (res.ok) {
        const { care_token } = await res.json();
        setCareTokenState(care_token);
        setPatient(prev => ({ ...prev, care_token }));
      } else {
        const err = await res.json().catch(() => ({}));
        setCareTokenError(err.error || `Errore ${res.status} — esegui la migrazione SQL v11 su Supabase`);
      }
    } catch (e) {
      setCareTokenError('Errore di rete');
    }
    setGeneratingToken(false);
  }

  function copyCareLink(type) {
    const base = `${window.location.origin}/checkin/${careToken}`;
    const url = type === 't3' ? `${base}?mode=checkpoint&type=t3`
              : type === 't6' ? `${base}?mode=checkpoint&type=t6`
              : base;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(type || 'self');
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function allDocsSigned() {
    const types = ['consent_treatment', 'privacy_extended', 'anamnesi'];
    return types.every(t => {
      const d = patientDocs.find(doc => doc.type === t);
      return d && (d.status === 'signed' || d.status === 'completed');
    });
  }

  async function deletePatient() {
    const name = `${patient.first_name} ${patient.last_name}`;
    if (!confirm(`Eliminare definitivamente il paziente ${name}?\n\nVerranno cancellate anche tutte le sedute registrate. Questa azione non è reversibile.`)) return;
    const res = await fetch(`/api/pro/patients/${patient.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.replace(`/pro/clients/${patient.client_id}/patients`);
    } else {
      alert('Errore durante l\'eliminazione. Riprova.');
    }
  }

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
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
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
          <div className="text-center text-xs text-gray-300 pb-1 flex items-center justify-center gap-3">
            <span>{proName} — Essentia Salutis</span>
            <button
              onClick={deletePatient}
              className="text-red-400 hover:text-red-600 text-xs underline"
            >
              Elimina paziente
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-5 space-y-4">

          {/* ── Documenti e consensi (solo L1) ───────────────────────────── */}
          {patient.level === 'level1' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
                📄 Documenti e consensi
                {allDocsSigned()
                  ? <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">✅ Completi</span>
                  : <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">⚠️ Da completare</span>
                }
              </h3>
              <PatientDocuments
                patientId={patient.id}
                clientId={patient.client_id}
                patient={patient}
                documents={patientDocs}
                onDocsChange={setPatientDocs}
              />
            </div>
          )}

          {closedSessions.length >= 1 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Trend NRS</h3>
              <NrsTrendChart sessions={sessions} />
            </div>
          )}

          {closedSessions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sedute precedenti</h3>
              {closedSessions.map(s => (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700 text-sm">Seduta #{s.session_number}</span>
                    <div className="flex items-center gap-3">
                      {s.nrs_pre !== null && (
                        <span className="text-sm font-semibold" style={{
                          color: s.nrs_pre <= 3 ? '#16a34a' : s.nrs_pre <= 6 ? '#ca8a04' : '#dc2626'
                        }}>NRS {s.nrs_pre}/10</span>
                      )}
                      <span className="text-xs text-gray-400">{new Date(s.date).toLocaleDateString('it-IT')}</span>
                    </div>
                  </div>
                  {s.treatment_notes && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-1">{s.treatment_notes}</div>
                  )}
                  {s.next_session_notes && (
                    <div className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">→ {s.next_session_notes}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Link self-valutazione dipendente (L2/L3 → possibile upgrade L1) ── */}
          {(patient.level === 'level2' || patient.level === 'level3') && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">🔗 Link dipendente</h3>
              {careToken ? (
                <div className="space-y-2">
                  {/* Link "Come stai oggi?" */}
                  <div>
                    <div className="text-xs text-gray-500 font-medium mb-1">💬 Come stai oggi? <span className="text-gray-400 font-normal">(sempre disponibile)</span></div>
                    <button
                      onClick={() => copyCareLink('self')}
                      className="w-full py-2 rounded-xl border border-green-300 text-green-700 bg-green-50 text-sm font-semibold"
                    >
                      {copied === 'self' ? '✓ Copiato!' : '📋 Copia link'}
                    </button>
                  </div>
                  {/* Divider */}
                  <div className="border-t border-gray-100 pt-2">
                    <div className="text-xs text-gray-500 font-medium mb-2">📅 Checkpoint periodici <span className="text-gray-400 font-normal">(manda al momento giusto)</span></div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyCareLink('t3')}
                        className="flex-1 py-2 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 text-xs font-semibold"
                      >
                        {copied === 't3' ? '✓ Copiato!' : '📋 Checkpoint 3 mesi'}
                      </button>
                      <button
                        onClick={() => copyCareLink('t6')}
                        className="flex-1 py-2 rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50 text-xs font-semibold"
                      >
                        {copied === 't6' ? '✓ Copiato!' : '📋 Checkpoint 6 mesi'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={generateCareToken}
                    disabled={generatingToken}
                    className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-60"
                  >
                    {generatingToken ? 'Generazione...' : '+ Genera link self-valutazione'}
                  </button>
                  {careTokenError && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                      ⚠️ {careTokenError}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!showNewSession && (
            patient.level === 'level1' && !allDocsSigned() ? (
              <div className="w-full py-3 px-4 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-700 text-center">
                ⚠️ Prima di poter avviare il trattamento, completare i 3 documenti nella sezione <strong>"Documenti e consensi"</strong>.
              </div>
            ) : (
              <button onClick={() => setShowNewSession(true)}
                className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold">
                + Nuova seduta
              </button>
            )
          )}

          {showNewSession && (
            <SessionForm
              patientId={patient.id}
              sessionNumber={closedSessions.length + 1}
              lastNote={lastClosed?.next_session_notes || null}
              anamnesiNrs={patientDocs.find(d => d.type === 'anamnesi')?.form_data?.nrs}
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

  const [sessions, client, documents] = await Promise.all([
    getSessionsByPatient(patientId),
    getClientById(patient.client_id),
    getPatientDocuments(patientId),
  ]);

  return {
    props: {
      proName,
      patient,
      sessions: sessions.map(s => ({ ...s, professionals: undefined })),
      client,
      documents: documents.map(d => ({ ...d, signature_image: undefined })), // non passare la firma al client per default
    },
  };
});
