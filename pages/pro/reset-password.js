import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { requireProAuthSsr } from '../../lib/pro-auth';

export default function ResetPassword({ proName }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Le password non coincidono');
    if (password.length < 8) return setError('Minimo 8 caratteri');
    setLoading(true);
    const res = await fetch('/api/pro/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push('/pro/dashboard');
    } else {
      const d = await res.json();
      setError(d.error || 'Errore');
    }
  }

  return (
    <>
      <Head><title>Imposta password — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-3xl font-black text-gray-900">ES <span className="text-green-600">Work</span></div>
            <div className="text-sm text-gray-500 mt-1">Imposta nuova password</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-4">
            Benvenuto/a {proName}. Per motivi di sicurezza devi impostare una nuova password prima di accedere.
          </div>
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nuova password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                minLength={8}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Minimo 8 caratteri"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conferma password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-60"
            >
              {loading ? 'Salvo...' : 'Salva password'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = requireProAuthSsr(async (ctx) => {
  return { props: { proName: ctx.req.proSession.proName } };
});
