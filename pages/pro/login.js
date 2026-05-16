import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function ProLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const sessionExpired = router.query.expired === '1';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/pro/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      if (data.mustReset) {
        router.push('/pro/reset-password');
      } else {
        router.push('/pro/dashboard');
      }
    } else {
      const d = await res.json();
      setError(d.error || 'Errore di accesso');
    }
  }

  return (
    <>
      <Head><title>Accesso professionista — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="text-3xl font-black text-gray-900">
              ES <span className="text-green-600">Work</span>
            </div>
            <div className="text-sm text-gray-500 mt-1">Accesso professionista</div>
          </div>

          {sessionExpired && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-4 text-center">
              ⏱ Sessione scaduta — effettua di nuovo l'accesso per continuare.
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="nome@email.it"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold text-base disabled:opacity-60"
            >
              {loading ? 'Accesso...' : 'Accedi'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Area riservata ai professionisti Essentia Salutis.
          </p>
        </div>
      </div>
    </>
  );
}
