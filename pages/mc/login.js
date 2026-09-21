import { useState } from 'react';
import Head from 'next/head';

// Accesso del medico competente: solo dati aggregati delle aziende assegnate.
export default function McLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState('');
  const [attesa, setAttesa] = useState(false);

  async function entra(e) {
    e.preventDefault();
    setErrore(''); setAttesa(true);
    try {
      const r = await fetch('/api/mc/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Accesso non riuscito');
      window.location.href = j.cambioPassword ? '/mc/cambio-password' : '/mc';
    } catch (err) { setErrore(err.message); setAttesa(false); }
  }

  return (
    <>
      <Head><title>Medico competente — ES Work</title></Head>
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <form onSubmit={entra} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6">
          <div className="text-lg font-bold text-slate-900">ES Work</div>
          <div className="text-sm text-slate-500 mb-5">Accesso del medico competente</div>
          <label className="block text-xs font-semibold text-slate-700">Email
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-semibold text-slate-700 mt-3">Password
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </label>
          {errore && <div role="alert" className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errore}</div>}
          <button disabled={attesa} className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-900 disabled:opacity-50">{attesa ? 'Accesso…' : 'Accedi'}</button>
          <p className="text-xs text-slate-500 mt-4">Qui trovi solo dati aggregati delle aziende che ti sono assegnate: nessun dato individuale dei lavoratori.</p>
        </form>
      </main>
    </>
  );
}
