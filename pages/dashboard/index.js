import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getSessionToken, verifyToken } from '../../lib/auth';
import { getClients, getAssessmentCounts } from '../../lib/store';
import { TYPE_COLORS, TYPE_LABELS } from '../../lib/scoring';


export default function Dashboard({ clients: initialClients, assessmentCounts, checkpointReminders }) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', sector: 1, employees: 50, contact_name: '', contact_email: '', contact_phone: '', source: 'passaparola', notes: '' });
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
      setForm({ name: '', sector: 1, employees: 50, contact_name: '', contact_email: '', contact_phone: '', source: 'passaparola', notes: '' });
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
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <span className="text-xl font-bold text-gray-900">ES </span>
            <span className="text-xl font-bold text-green-600">Work</span>
            <span className="text-sm text-gray-500 ml-2">Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/professionals" className="text-sm text-indigo-700 hover:text-indigo-900 py-2 px-3 border border-indigo-200 rounded-xl bg-indigo-50">
              Professionisti
            </Link>
            <Link href="/dashboard/pipeline" className="text-sm text-purple-700 hover:text-purple-900 py-2 px-3 border border-purple-200 rounded-xl bg-purple-50">
              Pipeline
            </Link>
            <Link href="/dashboard/calculator" className="text-sm text-green-700 hover:text-green-900 py-2 px-3 border border-green-200 rounded-xl bg-green-50">
              Calcolatore
            </Link>
            <Link href="/dashboard/referrals" className="text-sm text-orange-700 hover:text-orange-900 py-2 px-3 border border-orange-200 rounded-xl bg-orange-50">
              Referral B2C
            </Link>
            <Link href="/dashboard/compliance" className="text-sm text-teal-700 hover:text-teal-900 py-2 px-3 border border-teal-200 rounded-xl bg-teal-50">
              Compliance
            </Link>
            <Link href="/dashboard/restratifications" className="text-sm text-rose-700 hover:text-rose-900 py-2 px-3 border border-rose-200 rounded-xl bg-rose-50">
              Ri-strat.
            </Link>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-800 py-2 px-3">
              Esci
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
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
            <div className="flex gap-3">
              <input
                type="email"
                value={form.contact_email}
                onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))}
                placeholder="Email referente (opzionale)"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="tel"
                value={form.contact_phone}
                onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))}
                placeholder="Telefono (opz.)"
                className="w-36 px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Fonte contatto</label>
              <select
                value={form.source}
                onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="passaparola">Passaparola</option>
                <option value="contatto_diretto">Contatto diretto</option>
                <option value="social">Social media</option>
                <option value="evento">Evento</option>
                <option value="sito_web">Sito web</option>
                <option value="intermediario">Intermediario</option>
                <option value="altro">Altro</option>
              </select>
            </div>
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

        {checkpointReminders && checkpointReminders.length > 0 && (
          <div className="mb-4 space-y-2">
            {checkpointReminders.map(r => (
              <Link key={r.clientId + r.type} href={`/dashboard/${r.clientId}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${r.overdue ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <span>📅</span>
                <span className="flex-1">
                  <strong>{r.clientName}</strong> — Checkpoint {r.type.toUpperCase()}
                  {r.overdue ? ` scaduto ${Math.abs(r.days)} giorni fa` : ` tra ${r.days} giorni`}
                </span>
                <span>→</span>
              </Link>
            ))}
          </div>
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

  // Calcola reminder checkpoint
  const checkpointReminders = [];
  clients.forEach(c => {
    if (!c.contract_start_date) return;
    const start = new Date(c.contract_start_date);
    const now = new Date();
    [{ type: 't3', months: 3 }, { type: 't6', months: 6 }].forEach(({ type, months }) => {
      const date = new Date(start);
      date.setMonth(date.getMonth() + months);
      const days = Math.round((date - now) / (1000*60*60*24));
      if (days <= 14 && days >= -30) {
        checkpointReminders.push({
          clientId: c.id,
          clientName: c.name,
          type,
          days,
          overdue: days < 0,
        });
      }
    });
  });

  return { props: { clients, assessmentCounts, checkpointReminders } };
});
