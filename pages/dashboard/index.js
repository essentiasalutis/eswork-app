import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getSessionToken, verifyToken } from '../../lib/auth';
import { getClients, getAssessmentCounts } from '../../lib/store';
import { TYPE_COLORS, TYPE_LABELS } from '../../lib/scoring';

export default function Dashboard({ clients: initialClients, assessmentCounts }) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', sector: 1, employees: 50, contact_name: '', contact_email: '', notes: '' });
  const [saving, setSaving] = useState(false);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  async function createClient(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const client = await res.json();
      setClients(prev => [...prev, client]);
      setShowNew(false);
      setForm({ name: '', sector: 1, employees: 50 });
    }
    setSaving(false);
  }

  async function deleteClient(id, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Eliminare questo cliente e tutti i suoi dati?')) return;
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    if (res.ok) setClients(prev => prev.filter(c => c.id !== id));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 no-print">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-xl font-bold text-gray-900">ES </span>
            <span className="text-xl font-bold text-green-600">Work</span>
            <span className="text-sm text-gray-500 ml-2">Dashboard</span>
          </div>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-800 py-2 px-3">
            Esci
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-800">Aziende clienti</h1>
          <button
            onClick={() => setShowNew(true)}
            className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-xl active:bg-green-700"
          >
            + Nuova azienda
          </button>
        </div>

        {showNew && (
          <form onSubmit={createClient} className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 space-y-3">
            <h2 className="font-semibold text-gray-800">Nuova azienda</h2>
            <input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Nome azienda"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex gap-3">
              <select
                value={form.sector}
                onChange={e => setForm(p => ({ ...p, sector: parseInt(e.target.value) }))}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value={1}>Manifattura / Produzione</option>
                <option value={2}>Ufficio / IT / Servizi</option>
              </select>
              <input
                type="number"
                value={form.employees}
                onChange={e => setForm(p => ({ ...p, employees: parseInt(e.target.value) || 0 }))}
                placeholder="N. dip."
                min="1"
                className="w-24 px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <input
              value={form.contact_name}
              onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
              placeholder="Nome referente (opzionale)"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              type="email"
              value={form.contact_email}
              onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))}
              placeholder="Email referente (opzionale)"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Note libere (opzionale)"
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-60">
                {saving ? 'Salvataggio...' : 'Crea'}
              </button>
              <button type="button" onClick={() => setShowNew(false)} className="px-5 py-3 rounded-xl border border-gray-300 text-gray-600">
                Annulla
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {clients.length === 0 && !showNew && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🏢</div>
              <p>Nessuna azienda. Aggiungine una per iniziare.</p>
            </div>
          )}
          {clients.map(c => {
            const counts = assessmentCounts[c.id] || { total: 0, active: 0 };
            return (
              <Link key={c.id} href={`/dashboard/${c.id}`} className="block">
                <div className="bg-white rounded-2xl border border-gray-200 p-4 active:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-base truncate">{c.name}</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {c.employees} dipendenti · {c.sector === 1 ? 'Manifattura' : 'Ufficio/IT'}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-500">{counts.total} assessment</span>
                        {counts.active > 0 && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            {counts.active} attivo
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <button
                        onClick={e => deleteClient(c.id, e)}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg"
                        title="Elimina"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps = require('../../lib/auth').requireAuthSsr(async () => {
  const [clients, assessmentCounts] = await Promise.all([
    getClients(),
    getAssessmentCounts(),
  ]);
  return { props: { clients, assessmentCounts } };
});
