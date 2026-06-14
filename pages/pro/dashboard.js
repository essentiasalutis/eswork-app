import { useState } from 'react';
import Link from 'next/link';
import { requireProAuthSsr } from '../../lib/pro-auth';
import { getAssignmentsByProfessional, getPatientsByClient, getReferralLeadsByProfessional } from '../../lib/store';

// ── Redenzione buono visita B2C ────────────────────────────────────────────────
function RedeemVoucher() {
  const [voucher, setVoucher] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, ... } | { error }

  async function redeem(e) {
    e.preventDefault();
    if (!voucher.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/pro/referrals/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucher_code: voucher, amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({ ok: true, ...data });
        setVoucher(''); setAmount('');
      } else {
        setResult({ error: data.error || 'Errore' });
      }
    } catch {
      setResult({ error: 'Errore di rete' });
    }
    setBusy(false);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5">
      <div className="font-semibold text-gray-800 text-sm mb-1">🎟️ Redimi buono visita</div>
      <div className="text-xs text-gray-500 mb-3">Inserisci il buono mostrato dal paziente (tariffa agevolata ES Work) e l&apos;importo della seduta.</div>
      <form onSubmit={redeem} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-gray-500 block mb-1">Buono visita</label>
          <input value={voucher} onChange={e => setVoucher(e.target.value.toUpperCase())} placeholder="ABCD-EFGH"
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div className="w-28">
          <label className="text-xs text-gray-500 block mb-1">Importo €</label>
          <input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="es. 73"
            className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <button type="submit" disabled={!voucher.trim() || busy}
          className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
          {busy ? '…' : 'Redimi'}
        </button>
      </form>
      {result?.ok && (
        <div className="mt-3 text-sm bg-green-50 border border-green-200 text-green-800 rounded-xl px-3 py-2">
          ✅ Buono redento{result.patient_name ? ` — ${result.patient_name}` : ''}{result.client_name ? ` (${result.client_name})` : ''}{result.amount != null ? ` · €${result.amount}` : ''}.
        </div>
      )}
      {result?.error && (
        <div className="mt-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2">⚠️ {result.error}</div>
      )}
    </div>
  );
}

function ProHeader({ proName, onLogout }) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <div>
          <span className="text-xl font-bold text-gray-900">ES </span>
          <span className="text-xl font-bold text-green-600">Work</span>
          <span className="text-xs text-gray-400 ml-2">area professionista</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:block">{proName}</span>
          <button
            onClick={onLogout}
            className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50"
          >
            Esci
          </button>
        </div>
      </div>
      {/* Watermark sottile */}
      <div className="text-center text-xs text-gray-300 pb-1">{proName} — Essentia Salutis</div>
    </header>
  );
}

function LeadsList({ leads }) {
  if (!leads || leads.length === 0) return null;
  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-4 mb-5">
      <div className="font-semibold text-gray-800 text-sm mb-1">📥 Lead B2C in attesa ({leads.length})</div>
      <div className="text-xs text-gray-500 mb-3">Persone che hanno richiesto un buono visita e non sono ancora state redente. Redimi il buono qui sopra quando svolgi la visita.</div>
      <div className="space-y-2">
        {leads.map(l => (
          <div key={l.id} className="border border-gray-100 rounded-xl px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-medium text-gray-800">{l.patient_name || '—'}</span>
              <span className="text-xs text-gray-400 ml-2">{l.referral_codes?.clients?.name || ''}</span>
              <div className="text-xs text-gray-500 mt-0.5">
                {l.patient_phone ? `📞 ${l.patient_phone}` : ''}{l.patient_email ? ` · ✉️ ${l.patient_email}` : ''}{l.preferred_when ? ` · 🕐 ${l.preferred_when}` : ''}
              </div>
            </div>
            <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{l.voucher_code || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProDashboard({ proName, clients, leads }) {
  async function logout() {
    await fetch('/api/pro/auth/logout', { method: 'POST' });
    window.location.href = '/pro/login';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ProHeader proName={proName} onLogout={logout} />

      <main className="max-w-5xl mx-auto px-6 py-6">
        {/* Link area osteopata */}
        <Link href="/osteopath/dashboard"
          className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl p-3 mb-5 hover:bg-green-100 transition-colors">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white text-sm">🌿</div>
          <div className="flex-1">
            <div className="font-semibold text-green-800 text-sm">Area Osteopata</div>
            <div className="text-xs text-green-600">Pre-validazioni, sessioni, schede pazienti</div>
          </div>
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Documenti e conformità */}
        <Link href="/pro/documents"
          className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-5 hover:bg-slate-100 transition-colors">
          <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center text-white text-sm">📁</div>
          <div className="flex-1">
            <div className="font-semibold text-slate-800 text-sm">Documenti e conformità</div>
            <div className="text-xs text-slate-500">Identità, albo, polizza RC, contratto</div>
          </div>
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        <RedeemVoucher />

        <LeadsList leads={leads} />

        <h1 className="text-xl font-bold text-gray-900 mb-1">Le tue aziende</h1>
        <p className="text-sm text-gray-500 mb-5">Seleziona un&apos;azienda per vedere i pazienti assegnati.</p>

        {clients.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🏢</div>
            <p>Nessuna azienda assegnata.<br />Contatta Essentia Salutis per l&apos;attivazione.</p>
          </div>
        )}

        <div className="space-y-3">
          {clients.map(({ client, patientCount }) => (
            <Link
              key={client.id}
              href={`/pro/clients/${client.id}/patients`}
              className="block bg-white rounded-2xl border border-gray-200 p-4 hover:border-green-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{client.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {client.employees} dip. · {client.sector === 1 ? 'Manifattura' : 'Ufficio/IT'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">{patientCount}</div>
                  <div className="text-xs text-gray-400">pazienti</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps = requireProAuthSsr(async (ctx) => {
  const proId = ctx.req.proSession.proId;
  const proName = ctx.req.proSession.proName;

  if (ctx.req.proSession.mustReset) {
    return { redirect: { destination: '/pro/reset-password', permanent: false } };
  }

  const assignments = await getAssignmentsByProfessional(proId);
  const clients = await Promise.all(
    assignments.map(async (a) => {
      const patients = await getPatientsByClient(a.client_id);
      const mine = (patients || []).filter(p => p.assigned_professional_id === proId);
      return { client: a.clients, patientCount: mine.length };
    })
  );

  const leads = await getReferralLeadsByProfessional(proId).catch(() => []);

  return { props: { proName, clients, leads } };
});
