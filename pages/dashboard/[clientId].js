import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getSessionToken, verifyToken } from '../../lib/auth';
import { getClientById, getResponsesForClient } from '../../lib/store';
import { TYPE_LABELS, TYPE_COLORS } from '../../lib/scoring';
import ReportView from '../../components/ReportView';

export default function ClientPage({ client, assessments: initial, responses: initialResponses }) {
  const router = useRouter();
  const [assessments, setAssessments] = useState(initial);
  const [responses, setResponses] = useState(initialResponses);
  const [showNew, setShowNew] = useState(false);
  const [newType, setNewType] = useState('initial');
  const [includePSS, setIncludePSS] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportAssessment, setReportAssessment] = useState(null);
  const [copied, setCopied] = useState(null);

  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_BASE_URL || '';

  async function createAssessment(e) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: client.id, type: newType, include_pss: includePSS }),
    });
    if (res.ok) {
      const a = await res.json();
      setAssessments(prev => [a, ...prev]);
      setShowNew(false);
    }
    setSaving(false);
  }

  async function closeAssessment(id) {
    if (!confirm('Chiudere questo assessment? I dipendenti non potranno più rispondere.')) return;
    const res = await fetch(`/api/assessments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    });
    if (res.ok) {
      setAssessments(prev => prev.map(a => a.id === id ? { ...a, status: 'closed' } : a));
    }
  }

  async function deleteAssessment(id, e) {
    e.stopPropagation();
    if (!confirm('Eliminare questo assessment e tutte le risposte?')) return;
    const res = await fetch(`/api/assessments/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAssessments(prev => prev.filter(a => a.id !== id));
      setResponses(prev => { const r = { ...prev }; delete r[id]; return r; });
    }
  }

  function copyLink(shareCode, id) {
    const url = `${baseUrl}/q/${shareCode}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function openReport(a) {
    const rList = responses[a.id] || [];
    setReportAssessment({ ...a, responseList: rList });
  }

  function openCalculator(a) {
    const { aggregateNMQ } = require('../../lib/scoring');
    const rList = responses[a.id] || [];
    const nmq = aggregateNMQ(rList);
    const params = new URLSearchParams({
      clientId: client.id,
      assessmentId: a.id,
      n: client.employees,
      l1: nmq.level1.count,
      l2: nmq.level2.count,
    });
    router.push(`/dashboard/calculator?${params}`);
  }

  function getBaseline(assessment) {
    if (assessment.type === 'initial') return null;
    const base = assessments.find(a => a.type === 'initial' && a.status === 'closed');
    if (!base) return null;
    return { ...base, responseList: responses[base.id] || [] };
  }

  if (reportAssessment) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 no-print flex gap-3 border-b border-gray-200 mb-2">
          <button onClick={() => setReportAssessment(null)} className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 rounded-xl">
            ← Indietro
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1 text-sm text-green-700 border border-green-300 bg-green-50 px-3 py-2 rounded-xl">
            Stampa / PDF
          </button>
        </div>
        <ReportView
          assessment={reportAssessment}
          client={client}
          baseline={getBaseline(reportAssessment)}
          onOpenCalculator={reportAssessment.type === 'initial' ? () => openCalculator(reportAssessment) : undefined}
        />
      </div>
    );
  }

  const sortedAssessments = [...assessments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate">{client.name}</div>
            <div className="text-xs text-gray-500">{client.employees} dip. · {client.sector === 1 ? 'Manifattura' : 'Ufficio/IT'}</div>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-xl whitespace-nowrap"
          >
            + Assessment
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {showNew && (
          <form onSubmit={createAssessment} className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
            <h2 className="font-semibold text-gray-800 mb-4">Nuovo assessment</h2>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setNewType(k)}
                  className="py-3 px-2 rounded-xl border-2 text-sm font-medium transition-all text-center"
                  style={{
                    borderColor: newType === k ? TYPE_COLORS[k] : '#e5e7eb',
                    background: newType === k ? TYPE_COLORS[k] + '18' : '#fff',
                    color: newType === k ? TYPE_COLORS[k] : '#6b7280',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={includePSS}
                onChange={e => setIncludePSS(e.target.checked)}
                className="w-5 h-5 rounded accent-green-600"
              />
              <span className="text-sm text-gray-700">Includi PSS-10 (stress percepito)</span>
            </label>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-60">
                {saving ? 'Creazione...' : 'Crea assessment'}
              </button>
              <button type="button" onClick={() => setShowNew(false)} className="px-5 py-3 rounded-xl border border-gray-300 text-gray-600">
                Annulla
              </button>
            </div>
          </form>
        )}

        {sortedAssessments.length === 0 && !showNew && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p>Nessun assessment. Creane uno per iniziare.</p>
          </div>
        )}

        <div className="space-y-3">
          {sortedAssessments.map(a => {
            const rCount = (responses[a.id] || []).length;
            const color = TYPE_COLORS[a.type];
            const shareUrl = `${baseUrl}/q/${a.share_code}`;
            return (
              <div
                key={a.id}
                className="bg-white rounded-2xl border p-4"
                style={{ borderColor: a.status === 'active' ? color + '80' : '#e5e7eb' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="font-semibold text-gray-900 text-sm truncate">{TYPE_LABELS[a.type]}</span>
                    {a.status === 'active' && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">ATTIVO</span>
                    )}
                    {a.status === 'closed' && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">CHIUSO</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <span className="text-xs text-gray-400">
                      {new Date(a.created_at).toLocaleDateString('it-IT')}
                    </span>
                    <button onClick={e => deleteAssessment(a.id, e)} className="p-1 text-gray-300 hover:text-red-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="text-sm text-gray-500 mb-3">
                  {rCount} {rCount === 1 ? 'risposta' : 'risposte'} raccolte
                  {!a.include_pss && ' · senza PSS-10'}
                </div>

                {a.status === 'active' && (
                  <div className="bg-gray-50 rounded-xl p-3 mb-3">
                    <div className="text-xs text-gray-500 mb-1">Link questionario (da inviare ai dipendenti):</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-xs text-gray-700 font-mono bg-white border border-gray-200 rounded-lg px-2 py-1.5 truncate">
                        {shareUrl}
                      </div>
                      <button
                        onClick={() => copyLink(a.share_code, a.id)}
                        className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border"
                        style={{
                          borderColor: copied === a.id ? '#16a34a' : '#d1d5db',
                          color: copied === a.id ? '#16a34a' : '#6b7280',
                          background: copied === a.id ? '#f0fdf4' : '#fff',
                        }}
                      >
                        {copied === a.id ? '✓ Copiato' : 'Copia'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {a.status === 'active' && (
                    <button
                      onClick={() => closeAssessment(a.id)}
                      className="text-sm px-4 py-2 rounded-xl border border-gray-300 text-gray-600"
                    >
                      Chiudi raccolta
                    </button>
                  )}
                  {rCount > 0 && (
                    <button
                      onClick={() => openReport(a)}
                      className="text-sm px-4 py-2 rounded-xl border font-medium"
                      style={{ borderColor: color + '60', color: color, background: color + '10' }}
                    >
                      Visualizza report
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps = require('../../lib/auth').requireAuthSsr(async (ctx) => {
  const { clientId } = ctx.params;
  const client = await getClientById(clientId);
  if (!client) return { notFound: true };

  const { assessments, responses } = await getResponsesForClient(clientId);
  return { props: { client, assessments, responses } };
});
