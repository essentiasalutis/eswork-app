import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { requireAuthSsr } from '../../lib/auth';

// ─── Costanti ─────────────────────────────────────────────────────────────────

const SECTOR_LABELS = {
  1: 'Manifattura / Produzione',
  2: 'Ufficio / IT / Servizi',
};

// ─── Input helpers ─────────────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      {children}
    </div>
  );
}

function NumInput({ value, onChange, placeholder, min = 0 }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
    />
  );
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
    />
  );
}

// ─── Pagina ────────────────────────────────────────────────────────────────────

export default function FirstMeetingPage({ client, meeting: initialMeeting }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const m = initialMeeting || {};

  // Sezione A
  const [employees, setEmployees] = useState(m.employees || client?.employees || '');
  const [sector, setSector] = useState(m.sector || client?.sector || 1);
  const [maxPeopleTraining, setMaxPeopleTraining] = useState(m.max_people_training || '');
  const [numLocations, setNumLocations] = useState(m.num_locations || '');

  // Sezione B
  const [absenceDays, setAbsenceDays] = useState(m.absence_days || '');
  const [turnover, setTurnover] = useState(m.turnover || '');
  const [remoteWork, setRemoteWork] = useState(m.remote_work || '');
  const [workShifts, setWorkShifts] = useState(m.work_shifts || '');
  const [internalContact, setInternalContact] = useState(m.internal_contact || '');

  // Sezione C
  const [motivation, setMotivation] = useState(m.motivation || '');

  // Sezione E
  const [notes, setNotes] = useState(m.notes || '');

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/first-meeting/${client.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employees, sector, max_people_training: maxPeopleTraining, num_locations: numLocations,
        absence_days: absenceDays, turnover, remote_work: remoteWork,
        work_shifts: workShifts, internal_contact: internalContact,
        motivation, notes,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Cliente non trovato.{' '}
        <Link href="/dashboard" className="text-green-600 ml-1">Torna alla dashboard</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/dashboard/${client.id}`} className="text-sm text-gray-500 hover:text-gray-800 shrink-0">
              ← {client.name}
            </Link>
          </div>
          <div>
            <span className="text-xl font-bold text-gray-900">ES </span>
            <span className="text-xl font-bold text-green-600">Work</span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Primo colloquio</h1>
          <p className="text-sm text-gray-500 mt-1">{client.name}</p>
        </div>

        <form onSubmit={save} className="space-y-6">

          {/* ── SEZIONE A: Dati organizzativi ────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="text-xs font-bold text-green-700 uppercase tracking-widest mb-4">A — Dati organizzativi</div>
            <div className="space-y-4">

              <div className="grid grid-cols-2 gap-3">
                <Field label="N. dipendenti">
                  <NumInput value={employees} onChange={setEmployees} placeholder="es. 80" min={1} />
                </Field>
                <Field label="N. sedi / stabilimenti">
                  <NumInput value={numLocations} onChange={setNumLocations} placeholder="es. 2" min={1} />
                </Field>
              </div>

              <Field label="Settore">
                <select
                  value={sector}
                  onChange={e => setSector(parseInt(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value={1}>Manifattura / Produzione</option>
                  <option value={2}>Ufficio / IT / Servizi</option>
                </select>
              </Field>

              <Field label="Max persone in formazione contemporaneamente" hint="Vincoli di turnover o spazio sala">
                <NumInput value={maxPeopleTraining} onChange={setMaxPeopleTraining} placeholder="es. 15" min={1} />
              </Field>

            </div>
          </div>

          {/* ── SEZIONE B: Contesto operativo ───────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-4">B — Contesto operativo</div>
            <div className="space-y-4">

              <div className="grid grid-cols-2 gap-3">
                <Field label="Giorni di assenza medi/anno" hint="Per dipendente (dato aggregato)">
                  <NumInput value={absenceDays} onChange={setAbsenceDays} placeholder="es. 12" />
                </Field>
                <Field label="Turnover annuo %" hint="Ricambio personale">
                  <NumInput value={turnover} onChange={setTurnover} placeholder="es. 8" />
                </Field>
              </div>

              <Field label="Smart working / lavoro da remoto" hint="Percentuale o modalità adottata">
                <TextInput value={remoteWork} onChange={setRemoteWork} placeholder="es. 30% full remote, 40% ibrido..." />
              </Field>

              <Field label="Turni di lavoro">
                <TextInput value={workShifts} onChange={setWorkShifts} placeholder="es. 2 turni 6-14 / 14-22, no notturno..." />
              </Field>

              <Field label="Referente interno per il progetto">
                <TextInput value={internalContact} onChange={setInternalContact} placeholder="Nome, ruolo, contatto..." />
              </Field>

            </div>
          </div>

          {/* ── SEZIONE C: Motivazione ──────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="text-xs font-bold text-purple-700 uppercase tracking-widest mb-4">C — Motivazione e aspettative</div>
            <div className="space-y-4">
              <Field label="Perché sono qui? Cosa vogliono risolvere?" hint="Ascolta, non suggerire. Prendi nota del linguaggio usato.">
                <TextArea
                  value={motivation}
                  onChange={setMotivation}
                  placeholder="Es. hanno avuto un aumento delle assenze per mal di schiena, il medico competente ha segnalato criticità, vogliono qualcosa per i dipendenti..."
                  rows={4}
                />
              </Field>
            </div>
          </div>

          {/* ── SEZIONE D: Promemoria (no input) ────────────────────── */}
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
            <div className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3">D — Ricorda: cosa NON chiedere</div>
            <ul className="space-y-2 text-sm text-amber-800">
              <li className="flex gap-2">
                <span className="text-amber-500 mt-0.5 shrink-0">✗</span>
                <span>Non chiedere il budget disponibile (lo scopri dal calcolo, non dalla loro dichiarazione)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500 mt-0.5 shrink-0">✗</span>
                <span>Non vendere subito — prima fai parlare, poi presenta dati e soluzioni</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500 mt-0.5 shrink-0">✗</span>
                <span>Non promettere tempi o prezzi prima di avere i dati dell&apos;assessment</span>
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500 mt-0.5 shrink-0">✗</span>
                <span>Non chiedere dati sensibili dei singoli dipendenti</span>
              </li>
            </ul>
          </div>

          {/* ── SEZIONE E: Note libere ───────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">E — Note libere</div>
            <Field label="Appunti del colloquio">
              <TextArea
                value={notes}
                onChange={setNotes}
                placeholder="Tutto ciò che vuoi ricordare: impressioni, dinamiche interne, timing decisionale, competitor menzionati..."
                rows={5}
              />
            </Field>
          </div>

          {/* ── Salva ───────────────────────────────────────────────── */}
          <div className="flex gap-3 pb-8">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold text-base disabled:opacity-60 active:bg-green-700"
            >
              {saving ? 'Salvataggio...' : saved ? '✓ Salvato' : 'Salva colloquio'}
            </button>
            <Link
              href={`/dashboard/${client.id}`}
              className="px-5 py-3 rounded-xl border border-gray-300 text-gray-600 font-medium text-center"
            >
              Chiudi
            </Link>
          </div>

        </form>
      </main>
    </div>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => {
  const { getClientById, getFirstMeeting } = require('../../lib/store');
  const { clientId } = ctx.query;
  if (!clientId) return { notFound: true };

  const [client, meeting] = await Promise.all([
    getClientById(clientId),
    getFirstMeeting(clientId),
  ]);

  if (!client) return { notFound: true };

  return {
    props: {
      client,
      meeting: meeting || null,
    },
  };
});
