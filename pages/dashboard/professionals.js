import { useState } from 'react';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';

export default function ProfessionalsPage({ professionals: initial, clients }) {
  const [professionals, setProfessionals] = useState(initial);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [assignModal, setAssignModal] = useState(null); // { proId, proName, assignments }
  const [newPassword, setNewPassword] = useState({ proId: null, value: '' });
  const [justCreated, setJustCreated] = useState(null); // { name, email, password } — mostrato dopo creazione

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://eswork-app.vercel.app';

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function credentialsMailto(name, email, password) {
    const subject = `Accesso ES Work — Area Professionisti`;
    const body = `Gentile ${name},

le invio le credenziali per accedere all'area professionisti di ES Work.

🔗 Link di accesso: ${BASE_URL}/pro/login
📧 Email: ${email}
🔑 Password temporanea: ${password}

Al primo accesso le verrà chiesto di impostare una nuova password personale.

Per qualsiasi problema non esiti a contattarmi.

Cordiali saluti,
Dott. Enrico Maiolo — founder @ Essentia Salutis
Tel: 327 102 7443
info@essentiasalutis.it`;
    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function createPro(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch('/api/professionals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const p = await res.json();
      setProfessionals(prev => [p, ...prev]);
      setShowNew(false);
      // Salva i dati per mostrare il riquadro "invia credenziali"
      setJustCreated({ name: form.name, email: form.email, password: form.password });
      setForm({ name: '', email: '', password: '', phone: '' });
    } else {
      const d = await res.json();
      setError(d.error || 'Errore');
    }
  }

  async function toggleActive(id, current) {
    const res = await fetch(`/api/professionals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !current }),
    });
    if (res.ok) {
      setProfessionals(prev => prev.map(p => p.id === id ? { ...p, active: !current } : p));
    }
  }

  async function forceReset(id) {
    if (!confirm('Forzare il reset della password al prossimo login?')) return;
    await fetch(`/api/professionals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ must_reset_password: true }),
    });
    setProfessionals(prev => prev.map(p => p.id === id ? { ...p, must_reset_password: true } : p));
  }

  async function setPassword(id) {
    if (!newPassword.value || newPassword.value.length < 8) {
      return alert('Password minimo 8 caratteri');
    }
    const res = await fetch(`/api/professionals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: newPassword.value }),
    });
    if (res.ok) {
      setNewPassword({ proId: null, value: '' });
      alert('Password aggiornata. Il professionista dovrà cambiarla al prossimo login.');
    }
  }

  async function openAssignModal(pro) {
    const res = await fetch(`/api/professionals/${pro.id}/assignments`);
    const assignments = res.ok ? await res.json() : [];
    setAssignModal({ proId: pro.id, proName: pro.name, assignments });
  }

  async function toggleAssignment(clientId, currentActive) {
    if (!assignModal) return;
    const res = await fetch(`/api/professionals/${assignModal.proId}/assignments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, active: !currentActive }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAssignModal(prev => {
        const exists = prev.assignments.find(a => a.client_id === clientId);
        if (exists) {
          return { ...prev, assignments: prev.assignments.map(a => a.client_id === clientId ? { ...a, active: !currentActive } : a) };
        } else {
          return { ...prev, assignments: [...prev.assignments, { client_id: clientId, active: true }] };
        }
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">← Dashboard</Link>
            <span className="text-gray-300">|</span>
            <div>
              <span className="text-xl font-bold text-gray-900">ES </span>
              <span className="text-xl font-bold text-green-600">Work</span>
              <span className="text-sm text-gray-500 ml-2">Professionisti</span>
            </div>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-xl"
          >
            + Professionista
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">

        {/* Form nuovo professionista */}
        {showNew && (
          <form onSubmit={createPro} className="bg-white rounded-2xl border border-green-200 p-5 mb-6 space-y-3">
            <h2 className="font-semibold text-gray-800">Nuovo professionista</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nome e cognome *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} required
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Telefono</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Email *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Password iniziale *</label>
                <input type="password" value={form.password} onChange={e => set('password', e.target.value)} required minLength={8}
                  placeholder="min. 8 caratteri"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div className="text-xs text-gray-400">Il professionista dovrà cambiare password al primo accesso.</div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-60">
                {saving ? 'Creo...' : 'Crea professionista'}
              </button>
              <button type="button" onClick={() => setShowNew(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm">
                Annulla
              </button>
            </div>
          </form>
        )}

        {/* Riquadro credenziali appena create */}
        {justCreated && (
          <div className="bg-green-50 border border-green-300 rounded-2xl p-5 mb-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="font-semibold text-green-800">✓ Professionista creato</div>
                <div className="text-sm text-green-700 mt-0.5">Invia le credenziali via email prima di chiudere questa schermata.</div>
              </div>
              <button onClick={() => setJustCreated(null)} className="text-green-400 hover:text-green-700 text-xl leading-none shrink-0">✕</button>
            </div>
            <div className="bg-white rounded-xl border border-green-200 px-4 py-3 text-sm space-y-1 mb-4 font-mono">
              <div><span className="text-gray-500">Email:</span> <strong>{justCreated.email}</strong></div>
              <div><span className="text-gray-500">Password:</span> <strong>{justCreated.password}</strong></div>
              <div><span className="text-gray-500">Link:</span> <strong>{BASE_URL}/pro/login</strong></div>
            </div>
            <a
              href={credentialsMailto(justCreated.name, justCreated.email, justCreated.password)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
            >
              ✉ Invia credenziali via email
            </a>
          </div>
        )}

        {professionals.length === 0 && !justCreated && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">👨‍⚕️</div>
            <p>Nessun professionista. Aggiungine uno con il pulsante in alto.</p>
          </div>
        )}

        <div className="space-y-3">
          {professionals.map(pro => (
            <div key={pro.id} className={`bg-white rounded-2xl border p-4 ${!pro.active ? 'opacity-60' : ''}`}
              style={{ borderColor: pro.active ? '#e5e7eb' : '#fecaca' }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{pro.name}</span>
                    {!pro.active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">disattivato</span>}
                    {pro.must_reset_password && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">reset pw</span>}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">{pro.email}{pro.phone ? ` · ${pro.phone}` : ''}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <a
                  href={`mailto:${encodeURIComponent(pro.email)}?subject=${encodeURIComponent('Accesso ES Work — Area Professionisti')}&body=${encodeURIComponent(`Gentile ${pro.name},\n\nle ricordo le credenziali per accedere all'area professionisti di ES Work.\n\n🔗 Link: ${BASE_URL}/pro/login\n📧 Email: ${pro.email}\n🔑 Password: [inserisci la password che hai impostato]\n\nCordiali saluti,\nDott. Enrico Maiolo — founder @ Essentia Salutis\nTel: 327 102 7443\ninfo@essentiasalutis.it`)}`}
                  className="text-xs px-3 py-1.5 rounded-xl border border-green-200 text-green-700 bg-green-50"
                >
                  ✉ Invia credenziali
                </a>
                <button
                  onClick={() => openAssignModal(pro)}
                  className="text-xs px-3 py-1.5 rounded-xl border border-blue-200 text-blue-700 bg-blue-50"
                >
                  Aziende assegnate
                </button>
                <button
                  onClick={() => forceReset(pro.id)}
                  className="text-xs px-3 py-1.5 rounded-xl border border-amber-200 text-amber-700 bg-amber-50"
                >
                  Forza reset pw
                </button>
                {newPassword.proId === pro.id ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="password"
                      value={newPassword.value}
                      onChange={e => setNewPassword(p => ({ ...p, value: e.target.value }))}
                      placeholder="nuova password"
                      className="text-xs px-3 py-1.5 border border-gray-300 rounded-xl focus:outline-none"
                    />
                    <button
                      onClick={() => setPassword(pro.id)}
                      className="text-xs px-3 py-1.5 rounded-xl bg-gray-800 text-white"
                    >
                      Salva
                    </button>
                    <button onClick={() => setNewPassword({ proId: null, value: '' })} className="text-xs text-gray-400">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setNewPassword({ proId: pro.id, value: '' })}
                    className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600"
                  >
                    Imposta pw
                  </button>
                )}
                <button
                  onClick={() => toggleActive(pro.id, pro.active)}
                  className={`text-xs px-3 py-1.5 rounded-xl border ${pro.active ? 'border-red-200 text-red-600 bg-red-50' : 'border-green-200 text-green-600 bg-green-50'}`}
                >
                  {pro.active ? 'Disattiva account' : 'Riattiva account'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Modale assegnazione aziende */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Aziende — {assignModal.proName}</h3>
              <button onClick={() => setAssignModal(null)} className="text-gray-400 text-xl">✕</button>
            </div>
            <p className="text-xs text-gray-500">Attiva o disattiva l&apos;accesso del professionista a ogni azienda.</p>
            <div className="space-y-2">
              {clients.map(c => {
                const a = assignModal.assignments.find(x => x.client_id === c.id);
                const active = a?.active || false;
                return (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{c.name}</div>
                      <div className="text-xs text-gray-400">{c.employees} dip.</div>
                    </div>
                    <button
                      onClick={() => toggleAssignment(c.id, active)}
                      className={`text-xs px-3 py-1.5 rounded-xl font-semibold ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}
                    >
                      {active ? 'Assegnata ✓' : 'Non assegnata'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const getServerSideProps = requireAuthSsr(async () => {
  const { getProfessionals, getClients } = require('../../lib/store');
  const [professionals, clients] = await Promise.all([
    getProfessionals(),
    getClients(),
  ]);
  return { props: { professionals, clients } };
});
