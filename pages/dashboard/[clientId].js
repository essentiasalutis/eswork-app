import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getClientById, getResponsesForClient, getAssignmentsByClient, getPatientsByClient, getSessionsForClient, getReferralCodesByClient } from '../../lib/store';
import { TYPE_LABELS, TYPE_COLORS } from '../../lib/scoring';
import ReportView from '../../components/ReportView';
import { CONFIG } from '../../lib/config';

// ─── Email Modal ──────────────────────────────────────────────────────────────

function EmailModal({ to, subject, body, onClose }) {
  const [editTo, setEditTo] = useState(to || '');
  const [editSubject, setEditSubject] = useState(subject);
  const [editBody, setEditBody] = useState(body);

  function sendEmail() {
    const mailto = `mailto:${encodeURIComponent(editTo)}?subject=${encodeURIComponent(editSubject)}&body=${encodeURIComponent(editBody)}`;
    window.location.href = mailto;
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Invia email</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">A:</label>
            <input
              value={editTo}
              onChange={e => setEditTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="email@azienda.it"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Oggetto:</label>
            <input
              value={editSubject}
              onChange={e => setEditSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Testo:</label>
            <textarea
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none font-mono"
            />
          </div>
        </div>
        <div className="flex gap-3 p-4 border-t border-gray-200">
          <button
            onClick={sendEmail}
            className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm"
          >
            Apri in Mail →
          </button>
          <button onClick={onClose} className="px-4 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm">
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// ─── NRS bar inline ───────────────────────────────────────────────────────────

function NrsBar({ value, max = 10 }) {
  if (value === null || value === undefined) return <span className="text-gray-300">—</span>;
  const color = value <= 3 ? '#16a34a' : value <= 6 ? '#ca8a04' : '#dc2626';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-bold" style={{ color }}>{value}</span>
      <span className="text-gray-400 text-xs">/ 10</span>
      <span className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden inline-block">
        <span className="h-full rounded-full inline-block" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
    </span>
  );
}

export default function ClientPage({ client: initialClient, assessments: initial, responses: initialResponses, assignments: initialAssignments, patientsNrs, referralCodes: initialReferralCodes }) {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [assessments, setAssessments] = useState(initial);
  const [responses, setResponses] = useState(initialResponses);
  const [assignments, setAssignments] = useState(initialAssignments || []);
  const [showNew, setShowNew] = useState(false);
  const [newType, setNewType] = useState('initial');
  const [includePSS, setIncludePSS] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportAssessment, setReportAssessment] = useState(null);
  const [copied, setCopied] = useState(null);
  const [emailModal, setEmailModal] = useState(null); // { to, subject, body }
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [referralCodes, setReferralCodes] = useState(initialReferralCodes || []);
  const [copiedReferral, setCopiedReferral] = useState(null);

  function openEdit() {
    setEditForm({
      name: client.name || '',
      employees: client.employees || '',
      sector: client.sector ?? 2,
      contact_name: client.contact_name || '',
      contact_email: client.contact_email || '',
      contact_phone: client.contact_phone || '',
      notes: client.notes || '',
    });
    setShowEdit(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    setEditSaving(true);
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      const updated = await res.json();
      setClient(updated);
      setShowEdit(false);
    }
    setEditSaving(false);
  }

  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_BASE_URL || '';

  const FIRMA = `Cordiali saluti,\nDott. Enrico Maiolo — founder @ Essentia Salutis\nTel: ${CONFIG.contact_phone}\n${CONFIG.contact_email}`;

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
      const data = await res.json();
      setAssessments(prev => prev.map(a => a.id === id ? { ...a, status: 'closed' } : a));
      // Se l'API ha restituito un codice referral appena generato, ricarica la lista
      if (data.referral_code) {
        const codesRes = await fetch(`/api/referrals?clientId=${client.id}`);
        if (codesRes.ok) setReferralCodes(await codesRes.json());
      }
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

  // Mod 3: email link assessment
  function emailLink(a) {
    const url = `${baseUrl}/q/${a.share_code}`;
    const referente = client.contact_name || 'referente';
    const body = `Gentile ${referente},

come concordato, le invio il link per l'assessment ES Work dedicato ai dipendenti di ${client.name}.

Il questionario è anonimo, si compila dallo smartphone in circa 5 minuti, e può essere completato in qualsiasi momento entro i prossimi 3 giorni lavorativi.

Può inoltrare questo link a tutti i dipendenti:
${url}

Le chiedo di comunicare ai dipendenti che l'azienda ha avviato un'iniziativa di salute organizzativa e che il questionario è completamente anonimo — i risultati saranno usati solo in forma aggregata.

Per qualsiasi domanda, sono a disposizione.

${FIRMA}`;
    setEmailModal({
      to: client.contact_email || '',
      subject: `Assessment ES Work — ${client.name}`,
      body,
    });
  }

  function openReport(a) {
    const rList = responses[a.id] || [];
    setReportAssessment({ ...a, responseList: rList });
  }

  function copyReferralLink(code) {
    const url = `${baseUrl}/care/${code}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedReferral(code);
    setTimeout(() => setCopiedReferral(null), 2000);
  }

  async function toggleReferral(rc) {
    const res = await fetch(`/api/referrals/manage/${rc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rc.is_active }),
    });
    if (res.ok) {
      const updated = await res.json();
      setReferralCodes(prev => prev.map(c => c.id === rc.id ? { ...c, is_active: updated.is_active } : c));
    }
  }

  async function deleteReferral(rc) {
    const uses = rc.referral_uses?.length || 0;
    const msg = uses > 0
      ? `Eliminare il codice ${rc.code}? Ha ${uses} utilizzo/i — verranno cancellati anche quelli.`
      : `Eliminare il codice ${rc.code}?`;
    if (!confirm(msg)) return;
    const res = await fetch(`/api/referrals/manage/${rc.id}`, { method: 'DELETE' });
    if (res.ok) setReferralCodes(prev => prev.filter(c => c.id !== rc.id));
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
          onOpenCalculator={reportAssessment.type === 'initial' ? () => openCalculator(reportAssessment) : null}
        />
      </div>
    );
  }

  const sortedAssessments = [...assessments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="min-h-screen bg-gray-50">
      {emailModal && (
        <EmailModal
          to={emailModal.to}
          subject={emailModal.subject}
          body={emailModal.body}
          onClose={() => setEmailModal(null)}
        />
      )}

      {showEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Modifica azienda</h3>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Nome azienda *</label>
                  <input
                    required
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Dipendenti *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={editForm.employees}
                      onChange={e => setEditForm(f => ({ ...f, employees: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Settore *</label>
                    <select
                      value={editForm.sector}
                      onChange={e => setEditForm(f => ({ ...f, sector: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    >
                      <option value={1}>Manifattura / Produzione</option>
                      <option value={2}>Ufficio / IT / Servizi</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Referente</label>
                  <input
                    value={editForm.contact_name}
                    onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))}
                    placeholder="Nome cognome"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Email</label>
                    <input
                      type="email"
                      value={editForm.contact_email}
                      onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Telefono</label>
                    <input
                      value={editForm.contact_phone}
                      onChange={e => setEditForm(f => ({ ...f, contact_phone: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Note interne</label>
                  <textarea
                    value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 p-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm disabled:opacity-50"
                >
                  {editSaving ? 'Salvataggio…' : 'Salva modifiche'}
                </button>
                <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm">
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <div className="font-semibold text-gray-900 truncate">{client.name}</div>
              <button
                onClick={openEdit}
                title="Modifica azienda"
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
            <div className="text-xs text-gray-500">{client.employees} dip. · {client.sector === 1 ? 'Manifattura' : 'Ufficio/IT'}</div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/dashboard/first-meeting?clientId=${client.id}`}
              className="text-sm text-blue-600 border border-blue-200 bg-blue-50 px-3 py-2 rounded-xl whitespace-nowrap"
            >
              Colloquio
            </Link>
            <button
              onClick={() => setShowNew(true)}
              className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-xl whitespace-nowrap"
            >
              + Assessment
            </button>
          </div>
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
            {(newType === 'initial' || newType === 'final') && (
              <label className="flex items-center gap-3 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePSS}
                  onChange={e => setIncludePSS(e.target.checked)}
                  className="w-5 h-5 rounded accent-green-600"
                />
                <span className="text-sm text-gray-700">Includi PSS-10 (stress percepito)</span>
              </label>
            )}
            {(newType === '3month' || newType === '6month') && (
              <div className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2 mb-4">
                PSS-10 non incluso nei checkpoint — viene misurato solo all&apos;assessment iniziale e finale.
              </div>
            )}
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

        {/* ── Professionisti assegnati ────────────────────────────────── */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Professionisti assegnati</h2>
            <Link href="/dashboard/professionals" className="text-xs text-blue-600 hover:underline">Gestisci →</Link>
          </div>
          {assignments.length === 0 ? (
            <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-400">
              Nessun professionista assegnato. <Link href="/dashboard/professionals" className="text-blue-500 hover:underline">Assegna</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map(a => (
                <div key={a.id} className={`bg-white rounded-xl border px-4 py-2.5 flex items-center justify-between ${a.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div>
                    <span className="text-sm font-medium text-gray-800">{a.professionals?.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{a.professionals?.email}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {a.active ? 'attivo' : 'revocato'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Pazienti / NRS (solo coord., niente note cliniche) ──────── */}
        {patientsNrs && patientsNrs.length > 0 && (
          <div className="mb-5">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-2">Pazienti — NRS</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-2">Paziente</th>
                    <th className="text-center px-3 py-2">Livello</th>
                    <th className="text-center px-3 py-2">Sedute</th>
                    <th className="text-center px-3 py-2">NRS inizio</th>
                    <th className="text-center px-3 py-2">NRS fine</th>
                    <th className="text-center px-3 py-2">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {patientsNrs.map(p => {
                    const delta = (p.nrs_first !== null && p.nrs_last !== null) ? p.nrs_last - p.nrs_first : null;
                    const levelColors = { level1: '#dc2626', level2: '#ca8a04', level3: '#16a34a' };
                    const levelLabels = { level1: 'L1', level2: 'L2', level3: 'L3' };
                    return (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{p.first_name} {p.last_name}</td>
                        <td className="px-3 py-2.5 text-center">
                          {p.level ? (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ color: levelColors[p.level], background: levelColors[p.level] + '18' }}>
                              {levelLabels[p.level]}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-600">{p.session_count}</td>
                        <td className="px-3 py-2.5 text-center"><NrsBar value={p.nrs_first} /></td>
                        <td className="px-3 py-2.5 text-center"><NrsBar value={p.nrs_last} /></td>
                        <td className="px-3 py-2.5 text-center font-bold">
                          {delta !== null ? (
                            <span className={delta < 0 ? 'text-green-600' : delta > 0 ? 'text-red-600' : 'text-gray-400'}>
                              {delta > 0 ? '+' : ''}{delta}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                    <div className="text-xs text-gray-500 mb-1">Link questionario:</div>
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
                    <>
                      <button
                        onClick={() => closeAssessment(a.id)}
                        className="text-sm px-4 py-2 rounded-xl border border-gray-300 text-gray-600"
                      >
                        Chiudi raccolta
                      </button>
                      {/* Mod 3: Invia link via email */}
                      <button
                        onClick={() => emailLink(a)}
                        className="text-sm px-4 py-2 rounded-xl border border-blue-200 text-blue-600 bg-blue-50"
                      >
                        Invia link email
                      </button>
                    </>
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
                  {rCount > 0 && a.type === 'initial' && (
                    <button
                      onClick={() => openCalculator(a)}
                      className="text-sm px-4 py-2 rounded-xl border border-green-300 text-green-700 bg-green-50 font-medium"
                    >
                      Preventivo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Referral B2C ────────────────────────────────────────────── */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">🔗 Referral B2C</h2>
            <Link href="/dashboard/referrals" className="text-xs text-orange-600 hover:underline">Tutti i referral →</Link>
          </div>
          {referralCodes.length === 0 ? (
            <div className="bg-orange-50 rounded-xl border border-orange-200 px-4 py-3 text-sm text-orange-600">
              Nessun codice ancora generato. I codici vengono creati automaticamente alla chiusura di un assessment.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Codice</th>
                    <th className="px-3 py-2.5 text-center">Utilizzi</th>
                    <th className="px-3 py-2.5 text-center">Stato</th>
                    <th className="px-3 py-2.5 text-center">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {referralCodes.map(rc => {
                    const uses = rc.referral_uses || [];
                    return (
                      <tr key={rc.id} className={`hover:bg-gray-50 ${!rc.is_active ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-2.5">
                          <span className="font-mono font-semibold text-blue-700 text-xs">{rc.code}</span>
                          <div className="text-xs text-gray-400 mt-0.5">{new Date(rc.created_at).toLocaleDateString('it-IT')}</div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {uses.length > 0 ? (
                            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                              {uses.length}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rc.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {rc.is_active ? 'Attivo' : 'Stoppato'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => copyReferralLink(rc.code)}
                              className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                              title="Copia link"
                            >
                              {copiedReferral === rc.code ? '✅' : '🔗'}
                            </button>
                            <button
                              onClick={() => toggleReferral(rc)}
                              className={`text-xs font-medium transition-colors ${rc.is_active ? 'text-yellow-600 hover:text-yellow-800' : 'text-green-600 hover:text-green-800'}`}
                              title={rc.is_active ? 'Stoppa link' : 'Riattiva link'}
                            >
                              {rc.is_active ? '⏸' : '▶'}
                            </button>
                            <button
                              onClick={() => deleteReferral(rc)}
                              className="text-xs text-red-400 hover:text-red-600 transition-colors"
                              title="Elimina"
                            >
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

export const getServerSideProps = require('../../lib/auth').requireAuthSsr(async (ctx) => {
  const { clientId } = ctx.params;
  const client = await getClientById(clientId);
  if (!client) return { notFound: true };

  const [{ assessments, responses }, assignments, patientsRaw, sessionsRaw, referralCodes] = await Promise.all([
    getResponsesForClient(clientId),
    getAssignmentsByClient(clientId),
    getPatientsByClient(clientId),
    getSessionsForClient(clientId),
    getReferralCodesByClient(clientId),
  ]);

  // Aggrega NRS per paziente (no note cliniche)
  const patientsNrs = patientsRaw.map(p => {
    const closed = sessionsRaw.filter(s => s.patient_id === p.id && s.closed_at);
    const firstClosed = closed.find(s => s.nrs_pre !== null);
    const lastClosed = closed.length > 0 ? closed[closed.length - 1] : null;
    return {
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      level: p.level || null,
      session_count: closed.length,
      nrs_first: firstClosed?.nrs_pre ?? null,
      nrs_last: lastClosed?.nrs_pre ?? null,
    };
  });

  return { props: { client, assessments, responses, assignments, patientsNrs, referralCodes } };
});
