import { useState } from 'react';
import Head from 'next/head';
import { requireMcAuthSsr } from '../../lib/mc-auth';

export default function McCambioPassword() {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [errore, setErrore] = useState('');

  async function salva(e) {
    e.preventDefault();
    setErrore('');
    if (p1.length < 10) return setErrore('Almeno 10 caratteri.');
    if (p1 !== p2) return setErrore('Le due password non coincidono.');
    const r = await fetch('/api/mc/auth/cambio-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: p1 }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErrore(j.error || 'Password non salvata');
    window.location.href = '/mc';
  }

  return (
    <>
      <Head><title>Nuova password — ES Work</title></Head>
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <form onSubmit={salva} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6">
          <div className="text-base font-bold text-slate-900 mb-1">Imposta la tua password</div>
          <p className="text-sm text-slate-500 mb-4">Al primo accesso la password iniziale va sostituita.</p>
          <input type="password" value={p1} onChange={e => setP1(e.target.value)} placeholder="Nuova password" autoComplete="new-password" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input type="password" value={p2} onChange={e => setP2(e.target.value)} placeholder="Ripeti la password" autoComplete="new-password" className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          {errore && <div role="alert" className="mt-3 text-sm text-red-700">{errore}</div>}
          <button className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-900">Salva</button>
        </form>
      </main>
    </>
  );
}

export const getServerSideProps = requireMcAuthSsr(async () => ({ props: {} }), { consentiCambioPassword: true });
