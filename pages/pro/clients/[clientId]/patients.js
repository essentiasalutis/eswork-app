import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { requireProAuthSsr } from '../../../../lib/pro-auth';
import { getPatientsByClient, getClientById, getAssignmentsByProfessional } from '../../../../lib/store';

const LEVEL_LABEL = { level1: 'Livello 1', level2: 'Livello 2', level3: 'Livello 3' };
const LEVEL_COLOR = { level1: '#dc2626', level2: '#ca8a04', level3: '#16a34a' };

function NewPatientForm({ clientId, proName, onCreated, onCancel }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', age: '', gender: 'M', level: '',
    job_activity: '', sedentary: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch(`/api/pro/clients/${clientId}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, age: parseInt(form.age) || null }),
    });
    setSaving(false);
    if (res.ok) {
      const p = await res.json();
      onCreated(p);
    } else {
      const d = await res.json();
      setError(d.error || 'Errore');
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-green-200 p-5 mb-4 space-y-3">
      <h3 className="font-semibold text-gray-800 mb-2">Nuovo paziente</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Nome *</label>
          <input value={form.first_name} onChange={e => set('first_name', e.target.value)} required
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Cognome *</label>
          <input value={form.last_name} onChange={e => set('last_name', e.target.value)} required
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Età</label>
          <input type="number" value={form.age} onChange={e => set('age', e.target.value)} min={18} max={75}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Sesso</label>
          <select value={form.gender} onChange={e => set('gender', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="M">M</option>
            <option value="F">F</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Attività in azienda</label>
        <input value={form.job_activity} onChange={e => set('job_activity', e.target.value)}
          placeholder="es. operaio reparto montaggio"
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Livello (da assessment)</label>
        <select value={form.level} onChange={e => set('level', e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">— non specificato —</option>
          <option value="level1">Livello 1 — Trattamento</option>
          <option value="level2">Livello 2 — Prevenzione</option>
          <option value="level3">Livello 3 — Formazione</option>
        </select>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-60">
          {saving ? 'Salvo...' : 'Crea paziente'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm">
          Annulla
        </button>
      </div>
    </form>
  );
}

export default function PatientsPage({ proName, client, patients: initial }) {
  const [patients, setPatients] = useState(initial);
  const [showNew, setShowNew] = useState(false);

  async function logout() {
    await fetch('/api/pro/auth/logout', { method: 'POST' });
    window.location.href = '/pro/login';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/pro/dashboard" className="text-gray-400 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate">{client.name}</div>
            <div className="text-xs text-gray-500">Pazienti assegnati</div>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-xl whitespace-nowrap"
          >
            + Paziente
          </button>
        </div>
        <div className="text-center text-xs text-gray-300 pb-1">{proName} — Essentia Salutis</div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-5">
        {showNew && (
          <NewPatientForm
            clientId={client.id}
            proName={proName}
            onCreated={p => { setPatients(prev => [p, ...prev]); setShowNew(false); }}
            onCancel={() => setShowNew(false)}
          />
        )}

        {patients.length === 0 && !showNew && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">👤</div>
            <p>Nessun paziente ancora.<br />Crea il primo paziente con il pulsante in alto.</p>
          </div>
        )}

        <div className="space-y-3">
          {patients.map(p => (
            <Link
              key={p.id}
              href={`/pro/patients/${p.id}`}
              className="block bg-white rounded-2xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-gray-900">{p.first_name} {p.last_name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {p.age ? `${p.age} anni · ` : ''}{p.gender} · {p.job_activity || '—'}
                  </div>
                </div>
                {p.level && (
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded-full shrink-0"
                    style={{ background: LEVEL_COLOR[p.level] + '18', color: LEVEL_COLOR[p.level] }}
                  >
                    {LEVEL_LABEL[p.level]}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps = requireProAuthSsr(async (ctx) => {
  const { clientId } = ctx.params;
  const proId = ctx.req.proSession.proId;
  const proName = ctx.req.proSession.proName;

  if (ctx.req.proSession.mustReset) {
    return { redirect: { destination: '/pro/reset-password', permanent: false } };
  }

  const assignments = await getAssignmentsByProfessional(proId);
  const allowed = assignments.some(a => a.client_id === clientId);
  if (!allowed) return { notFound: true };

  const [client, patients] = await Promise.all([
    getClientById(clientId),
    getPatientsByClient(clientId),
  ]);

  if (!client) return { notFound: true };
  return { props: { proName, client, patients } };
});
