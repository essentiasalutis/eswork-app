import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getClientById, getResponsesForClient, getAssignmentsByClient, getPatientsByClient, getSessionsForClient, getReferralCodesByClient, getConsentsByAssessment, getWaitlistByClient, getGeneratedReportsByClient, getPatientsWithEmailByClient, getDocumentsByClient, getProfessionals } from '../../lib/store';
import { TYPE_LABELS, TYPE_COLORS } from '../../lib/scoring';
import ReportView from '../../components/ReportView';
import { CONFIG } from '../../lib/config';
import NavMenu from '../../components/NavMenu';

function getTierFromEmployees(employees) {
  const n = parseInt(employees) || 0;
  if (n <= 150) return 'core';
  if (n <= 500) return 'plus';
  return 'enterprise';
}

const TIER_LABELS = { core: 'Core', plus: 'Plus', enterprise: 'Enterprise' };
const TIER_COLORS = { core: '#6b7280', plus: '#2563eb', enterprise: '#7c3aed' };

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

// ─── Checkpoint Patient Row ───────────────────────────────────────────────────

function CheckpointPatientRow({ patient }) {
  const [copied, setCopied] = useState(null); // 't3' | 't6' | null

  function copy(type) {
    const base = `${window.location.origin}/checkin/${patient.care_token}`;
    const url = `${base}?mode=checkpoint&type=${type}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const levelLabels = { level1: 'L1', level2: 'L2', level3: 'L3' };
  const levelColors = { level1: '#dc2626', level2: '#ca8a04', level3: '#16a34a' };

  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
      <span className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
        style={{ color: levelColors[patient.level], background: levelColors[patient.level] + '20' }}>
        {levelLabels[patient.level]}
      </span>
      <span className="text-sm text-gray-700 flex-1 truncate">{patient.name}</span>
      <button onClick={() => copy('t3')}
        className="text-xs px-2 py-1 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 font-medium shrink-0">
        {copied === 't3' ? '✓' : 'T3'}
      </button>
      <button onClick={() => copy('t6')}
        className="text-xs px-2 py-1 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 font-medium shrink-0">
        {copied === 't6' ? '✓' : 'T6'}
      </button>
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

export default function ClientPage({ client: initialClient, assessments: initial, responses: initialResponses, assignments: initialAssignments, patientsNrs, referralCodes: initialReferralCodes, waitlist: initialWaitlist, generatedReports: initialReports, allProfessionals }) {
  const router = useRouter();
  const [client, setClient] = useState(initialClient);
  const [assessments, setAssessments] = useState(initial);
  const [responses, setResponses] = useState(initialResponses);
  // Mappa professionista→stato assegnazione (attivo) per QUESTA azienda
  const [assignedActive, setAssignedActive] = useState(() => {
    const m = {};
    (initialAssignments || []).forEach(a => {
      const pid = a.professional_id || a.professionals?.id;
      if (pid) m[pid] = !!a.active;
    });
    return m;
  });
  const [assignBusy, setAssignBusy] = useState(null); // professional_id in corso
  const [showNew, setShowNew] = useState(false);

  // Assegna / togli un professionista a questa azienda (flag on/off)
  async function togglePro(pro) {
    const proId = pro.id;
    const next = !assignedActive[proId];
    setAssignBusy(proId);
    try {
      const res = await fetch(`/api/professionals/${proId}/assignments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: initialClient.id, active: next }),
      });
      if (res.ok) {
        setAssignedActive(prev => ({ ...prev, [proId]: next }));
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Errore aggiornamento assegnazione');
      }
    } catch { alert('Errore di rete'); }
    setAssignBusy(null);
  }

  // Professionisti assegnati attivi (opzioni per l'assegnazione dei pazienti)
  const assignedPros = (allProfessionals || []).filter(p => assignedActive[p.id]);

  // Mappa paziente→professionista referente
  const [patientPro, setPatientPro] = useState(() =>
    Object.fromEntries((patientsNrs || []).map(p => [p.id, p.assigned_professional_id || '']))
  );
  const [patientProBusy, setPatientProBusy] = useState(null);

  async function assignPatientPro(patientId, proId) {
    setPatientProBusy(patientId);
    const prev = patientPro[patientId] || '';
    setPatientPro(p => ({ ...p, [patientId]: proId }));
    try {
      const res = await fetch(`/api/admin/patients/${patientId}/assign-professional`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ professional_id: proId || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Errore assegnazione paziente');
        setPatientPro(p => ({ ...p, [patientId]: prev })); // rollback
      }
    } catch {
      alert('Errore di rete');
      setPatientPro(p => ({ ...p, [patientId]: prev }));
    }
    setPatientProBusy(null);
  }

  const [newType, setNewType] = useState('initial');
  const [saving, setSaving] = useState(false);
  const [reportAssessment, setReportAssessment] = useState(null);
  const [copied, setCopied] = useState(null);
  const [emailModal, setEmailModal] = useState(null); // { to, subject, body }
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [referralCodes, setReferralCodes] = useState(initialReferralCodes || []);
  const [copiedReferral, setCopiedReferral] = useState(null);
  const [generatingCode, setGeneratingCode] = useState(null); // 'P' | 'F' | null
  const [contractStart, setContractStart] = useState(initialClient.contract_start_date || '');
  const [savingDate, setSavingDate] = useState(false);
  const [waitlist, setWaitlist] = useState(initialWaitlist || []);
  const [generatedReports, setGeneratedReports] = useState(initialReports || []);
  const [generatingReport, setGeneratingReport] = useState(null); // 'activation'|'t3'|'t6'|null
  const [reportModal, setReportModal] = useState(null); // { title, content, pdf_url }
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [campaignResult, setCampaignResult] = useState(null);
  const [showCampaignConfirm, setShowCampaignConfirm] = useState(false);
  const [copiedAssessmentLink, setCopiedAssessmentLink] = useState(false);
  const [showAdvancedImport, setShowAdvancedImport] = useState(false);
  const [generatingQuotePdf, setGeneratingQuotePdf] = useState(false);
  const [quotePdfUrl, setQuotePdfUrl] = useState(null);

  const tier = client.tier || getTierFromEmployees(client.employees);

  async function generateReport(type) {
    setGeneratingReport(type);
    try {
      const body = type === 'activation' ? {} : { checkpoint: type };
      const url = type === 'activation'
        ? `/api/clients/${client.id}/generate-activation-report`
        : `/api/clients/${client.id}/generate-checkpoint-report`;
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.report) {
        const title = type === 'activation' ? 'Report di Attivazione' : `Report Intermedio ${type.toUpperCase()}`;
        setReportModal({ title, content: data.report, source: data.source, pdf_url: data.pdf_url });
        setGeneratedReports(prev => [{ id: data.report_id || Date.now(), report_type: type === 'activation' ? 'activation' : `checkpoint_${type}`, created_at: new Date().toISOString(), pdf_url: data.pdf_url }, ...prev]);
      }
    } catch {}
    setGeneratingReport(null);
  }

  async function sendCampaign() {
    setSendingCampaign(true);
    setCampaignResult(null);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/send-assessments`, { method: 'POST' });
      const data = await res.json();
      setCampaignResult(data);
    } catch { setCampaignResult({ error: 'Errore di rete' }); }
    setSendingCampaign(false);
    setShowCampaignConfirm(false);
  }

  async function generateQuotePdf() {
    setGeneratingQuotePdf(true);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/generate-quote-pdf`, { method: 'POST' });
      const data = await res.json();
      if (data.url) setQuotePdfUrl(data.url);
      else if (data.html_preview) alert('BLOB_READ_WRITE_TOKEN non configurata — PDF non salvato. Configura la variabile ambiente su Vercel.');
    } catch {}
    setGeneratingQuotePdf(false);
  }

  async function handleImportCSV() {
    if (!csvText.trim()) return;
    setImporting(true);
    try {
      const lines = csvText.trim().split('\n');
      const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[""]/g, ''));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/[""]/g, ''));
        return Object.fromEntries(header.map((h, i) => [h, vals[i] || '']));
      });
      const res = await fetch(`/api/clients/${client.id}/import-employees`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }),
      });
      const result = await res.json();
      setImportResult(result);
    } catch { setImportResult({ error: 'Errore di rete' }); }
    setImporting(false);
  }

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
      body: JSON.stringify({ client_id: client.id, type: newType }),
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
      if (data.referral_code_p || data.referral_code_f) {
        const codesRes = await fetch(`/api/referrals?clientId=${client.id}`);
        if (codesRes.ok) setReferralCodes(await codesRes.json());
      }
    }
  }

  async function reopenAssessment(id) {
    if (!confirm('Riaprire questo assessment? I dipendenti potranno tornare a rispondere.')) return;
    const res = await fetch(`/api/assessments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    if (res.ok) {
      setAssessments(prev => prev.map(a => a.id === id ? { ...a, status: 'active' } : a));
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

Il questionario è riservato, si compila dallo smartphone in circa 5 minuti, e può essere completato in qualsiasi momento entro i prossimi 3 giorni lavorativi.

Può inoltrare questo link a tutti i dipendenti:
${url}

Le chiedo di comunicare ai dipendenti che l'azienda ha avviato un'iniziativa di salute organizzativa e che i dati sono trattati in modo riservato da Essentia Salutis, nel rispetto del segreto professionale: l'azienda non vedrà mai i dati individuali, ma solo risultati in forma aggregata.

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

  async function generateCode(type) {
    setGeneratingCode(type);
    const res = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: client.id, type }),
    });
    if (res.ok) {
      const newCode = await res.json();
      // Aggiungi referral_uses vuoto per compatibilità con la tabella
      setReferralCodes(prev => [{ ...newCode, referral_uses: [] }, ...prev]);
    } else {
      const err = await res.json();
      alert(err.error || 'Errore nella generazione del codice');
    }
    setGeneratingCode(null);
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

  async function saveContractDate() {
    setSavingDate(true);
    await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract_start_date: contractStart || null }),
    });
    setSavingDate(false);
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
        <div className="max-w-5xl mx-auto px-6 py-4 no-print flex gap-3 border-b border-gray-200 mb-2">
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
    <>
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
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate">{client.name}</div>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span>{client.employees} dip. · {client.sector === 1 ? 'Manifattura' : 'Ufficio/IT'}</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{ background: TIER_COLORS[tier] + '18', color: TIER_COLORS[tier] }}>
                {TIER_LABELS[tier]}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <NavMenu />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
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
          </div>
          {(!allProfessionals || allProfessionals.length === 0) ? (
            <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-400">
              Nessun professionista creato. Creane uno dal menu <Link href="/dashboard/professionals" className="text-blue-500 hover:underline">Professionisti</Link>.
            </div>
          ) : (
            <div className="space-y-2">
              {allProfessionals.map(pro => {
                const active = !!assignedActive[pro.id];
                return (
                  <div key={pro.id} className={`bg-white rounded-xl border px-4 py-2.5 flex items-center justify-between gap-3 ${active ? 'border-green-200' : 'border-gray-200'}`}>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-800">{pro.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{pro.email}</span>
                      {pro.active === false && <span className="text-xs text-red-400 ml-2">(account disattivato)</span>}
                    </div>
                    <button
                      onClick={() => togglePro(pro)}
                      disabled={assignBusy === pro.id}
                      role="switch"
                      aria-checked={active}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${active ? 'bg-green-500' : 'bg-gray-300'}`}
                      title={active ? 'Assegnato — clicca per togliere' : 'Non assegnato — clicca per assegnare'}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Lista d'attesa L1 ───────────────────────────────────────── */}
        {waitlist && waitlist.length > 0 && (
          <div className="mb-5">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-2">Lista d'attesa L1</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-2">Paziente</th>
                    <th className="text-center px-3 py-2">Punteggio</th>
                    <th className="text-center px-3 py-2">Fonte</th>
                    <th className="text-center px-3 py-2">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlist.map(w => (
                    <tr key={w.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2 text-gray-800">
                        {w.patients ? `${w.patients.first_name} ${w.patients.last_name}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-center font-semibold text-blue-700">{w.score}</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-500 capitalize">{w.source}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          {w.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
                    <th className="text-left px-3 py-2">Professionista</th>
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
                        <td className="px-3 py-2.5">
                          {assignedPros.length === 0 ? (
                            <span className="text-xs text-gray-300">— assegna prima un professionista all&apos;azienda</span>
                          ) : (
                            <select
                              value={patientPro[p.id] || ''}
                              onChange={e => assignPatientPro(p.id, e.target.value)}
                              disabled={patientProBusy === p.id}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                            >
                              <option value="">— non assegnato</option>
                              {assignedPros.map(pro => (
                                <option key={pro.id} value={pro.id}>{pro.name}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Campagna Checkpoint ─────────────────────────────── */}
        <div className="mb-5 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900 text-sm">📅 Campagna Checkpoint</div>
              <div className="text-xs text-gray-500 mt-0.5">Link T3/T6 da inviare ai dipendenti L2/L3</div>
            </div>
          </div>

          {!contractStart ? (
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-3">Imposta la data di inizio contratto per calcolare le scadenze T3 e T6.</p>
              <div className="flex gap-2">
                <input type="date" value={contractStart} onChange={e => setContractStart(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <button onClick={saveContractDate} disabled={!contractStart || savingDate}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                  {savingDate ? '...' : 'Salva'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* Date T3 e T6 */}
              {(() => {
                const start = new Date(contractStart);
                const t3 = new Date(start); t3.setMonth(t3.getMonth() + 3);
                const t6 = new Date(start); t6.setMonth(t6.getMonth() + 6);
                const now = new Date();
                const daysToT3 = Math.round((t3 - now) / (1000*60*60*24));
                const daysToT6 = Math.round((t6 - now) / (1000*60*60*24));
                const fmt = d => d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
                return (
                  <div className="grid grid-cols-2 gap-3">
                    {[{ label: 'Checkpoint T3', date: t3, days: daysToT3, type: 't3', color: 'blue' },
                      { label: 'Checkpoint T6', date: t6, days: daysToT6, type: 't6', color: 'indigo' }].map(({ label, date, days, color }) => (
                      <div key={label} className={`rounded-xl p-3 border ${color === 'blue' ? 'bg-blue-50 border-blue-200' : 'bg-indigo-50 border-indigo-200'}`}>
                        <div className={`text-xs font-bold ${color === 'blue' ? 'text-blue-700' : 'text-indigo-700'} mb-1`}>{label}</div>
                        <div className={`text-sm font-semibold ${color === 'blue' ? 'text-blue-900' : 'text-indigo-900'}`}>{fmt(date)}</div>
                        <div className={`text-xs mt-1 ${days < 0 ? 'text-red-600 font-semibold' : days <= 14 ? 'text-amber-600 font-semibold' : color === 'blue' ? 'text-blue-600' : 'text-indigo-600'}`}>
                          {days < 0 ? `${Math.abs(days)} giorni fa` : days === 0 ? 'Oggi!' : `tra ${days} giorni`}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Modifica data */}
              <div className="flex gap-2 items-center">
                <input type="date" value={contractStart} onChange={e => setContractStart(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-300" />
                <button onClick={saveContractDate} disabled={savingDate}
                  className="px-3 py-2 border border-gray-200 text-gray-500 rounded-xl text-xs font-medium disabled:opacity-50">
                  {savingDate ? '...' : 'Aggiorna'}
                </button>
              </div>

              {/* Lista pazienti L2/L3 con link */}
              {patientsNrs && patientsNrs.filter(p => p.level === 'level2' || p.level === 'level3').length > 0 ? (
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2">Link da inviare ai dipendenti monitorati:</div>
                  <div className="space-y-1.5">
                    {patientsNrs.filter(p => (p.level === 'level2' || p.level === 'level3') && p.care_token).map(p => (
                      <CheckpointPatientRow key={p.id} patient={p} />
                    ))}
                    {patientsNrs.filter(p => (p.level === 'level2' || p.level === 'level3') && !p.care_token).length > 0 && (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        ⚠️ {patientsNrs.filter(p => (p.level === 'level2' || p.level === 'level3') && !p.care_token).length} dipendenti senza link generato — vai alla cartella paziente per generarlo
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400 text-center py-4">Nessun dipendente L2/L3 con link attivo</div>
              )}
            </div>
          )}
        </div>

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
                      <button
                        onClick={() => emailLink(a)}
                        className="text-sm px-4 py-2 rounded-xl border border-blue-200 text-blue-600 bg-blue-50"
                      >
                        Invia link email
                      </button>
                    </>
                  )}
                  {a.status === 'closed' && (
                    <button
                      onClick={() => reopenAssessment(a.id)}
                      className="text-sm px-4 py-2 rounded-xl border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
                    >
                      🔓 Riapri raccolta
                    </button>
                  )}
                  {/* Consensi raccolti */}
                  {a.status === 'closed' && a.consents && a.consents.length > 0 && (
                    <div className="w-full mt-1 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
                      ✅ <strong>{a.consents.length}</strong> consenso/i GDPR raccolto/i
                      <span className="text-green-500 ml-2">· IP anonimizzato · {new Date(a.consents[0].consent_privacy_at).toLocaleDateString('it-IT')}</span>
                    </div>
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
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">🔗 Referral B2C</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => generateCode('P')}
                disabled={!!generatingCode}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50"
              >
                {generatingCode === 'P' ? '…' : '+ Codice P'}
              </button>
              <button
                onClick={() => generateCode('F')}
                disabled={!!generatingCode}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 disabled:opacity-50"
              >
                {generatingCode === 'F' ? '…' : '+ Codice F'}
              </button>
              <Link href="/dashboard/referrals" className="text-xs text-orange-600 hover:underline">Tutti →</Link>
            </div>
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
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-blue-700 text-xs">{rc.code}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${(rc.type||'P') === 'F' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                              {(rc.type||'P') === 'F' ? '👨‍👩‍👧 F' : '👤 P'}
                            </span>
                          </div>
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

        {/* ── Sezione AI Reports ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Report AI</div>
              <div className="text-xs text-gray-400 mt-0.5">Generati con Claude Sonnet — richiedono 15-30 secondi</div>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            {[
              { type: 'activation', label: '📋 Report Attivazione', desc: 'Mappa clinica + piano operativo', color: 'green' },
              { type: 't3', label: '📊 Report T3 (3 mesi)', desc: 'KPI intermedi + trend NRS', color: 'blue' },
              { type: 't6', label: '📈 Report T6 (6 mesi)', desc: 'Analisi + doc. INAIL OT23', color: 'purple' },
            ].map(({ type, label, desc, color }) => {
              const colorCls = {
                green: 'bg-green-600 hover:bg-green-700 disabled:bg-green-300',
                blue: 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300',
                purple: 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300',
              }[color];
              return (
                <button key={type} onClick={() => generateReport(type)} disabled={generatingReport !== null}
                  className={`${colorCls} text-white rounded-xl p-4 text-left transition-colors disabled:cursor-not-allowed`}>
                  <div className="font-semibold text-sm mb-1">{label}</div>
                  <div className="text-xs opacity-80">{desc}</div>
                  {generatingReport === type && (
                    <div className="mt-2 text-xs opacity-90 animate-pulse">⏳ Generazione in corso...</div>
                  )}
                </button>
              );
            })}
          </div>
          {generatedReports.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <div className="text-xs text-gray-400 mb-2">Report generati di recente</div>
              {generatedReports.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between py-1.5 text-xs text-gray-500">
                  <span>{r.report_type === 'activation' ? '📋 Attivazione' : `📊 ${r.report_type?.replace('checkpoint_', '').toUpperCase()}`}</span>
                  <span>{new Date(r.created_at).toLocaleDateString('it-IT')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Gestione Dipendenti & Campagna Assessment ──────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dipendenti & Assessment</div>
            <Link href={`/dashboard/${client.id}/waitlist`}
              className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl hover:bg-indigo-100">
              📋 Waitlist L1
            </Link>
          </div>

          {/* 🔗 Link assessment generico (nuovo modello auto-dichiarazione) */}
          {client.assessment_share_code && (() => {
            const selfDeclareUrl = `${baseUrl}/q/c/${client.assessment_share_code}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selfDeclareUrl)}`;
            return (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">🔗 Link questionario (distribuisci internamente)</div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 text-xs text-gray-700 font-mono bg-white border border-gray-200 rounded-lg px-2 py-2 truncate">
                    {selfDeclareUrl}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selfDeclareUrl);
                      setCopiedAssessmentLink(true);
                      setTimeout(() => setCopiedAssessmentLink(false), 2000);
                    }}
                    className="flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg border"
                    style={{
                      borderColor: copiedAssessmentLink ? '#16a34a' : '#d1d5db',
                      color: copiedAssessmentLink ? '#16a34a' : '#6b7280',
                      background: copiedAssessmentLink ? '#f0fdf4' : '#fff',
                    }}
                  >
                    {copiedAssessmentLink ? '✓ Copiato' : 'Copia'}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={qrUrl}
                    download={`qr-assessment-${client.name}.png`}
                    className="text-xs font-semibold text-green-700 bg-white border border-green-300 px-3 py-2 rounded-xl hover:bg-green-50"
                  >
                    📱 Scarica QR Code
                  </a>
                  <span className="text-xs text-gray-400">Il dipendente scansiona e compila autonomamente</span>
                </div>
              </div>
            );
          })()}

          {/* Tasso di adesione */}
          {patientsNrs && patientsNrs.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Totale', value: patientsNrs.length, color: 'text-gray-700' },
                { label: 'Auto-dich.', value: patientsNrs.filter(p => p.self_declared).length, color: 'text-blue-700' },
                { label: 'Completati', value: patientsNrs.filter(p => p.assessment_completed_at).length, color: 'text-green-700' },
                { label: 'Tasso', value: patientsNrs.length > 0 ? `${Math.round(patientsNrs.filter(p => p.assessment_completed_at).length / patientsNrs.length * 100)}%` : '0%', color: 'text-purple-700' },
              ].map(k => (
                <div key={k.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{k.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Import CSV — modalità avanzata (richiede DPA con cliente) */}
          <div className="border-t border-gray-100 pt-3">
            <button
              onClick={() => setShowAdvancedImport(v => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              ⚙️ Modalità avanzata (import CSV)
              <span className="text-gray-300">{showAdvancedImport ? '▲' : '▼'}</span>
            </button>
            {showAdvancedImport && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                <p className="text-xs text-amber-700">
                  ⚠️ <strong>Modalità avanzata</strong>: richiede DPA firmato con l'azienda cliente. Usare solo se concordato con l'HR del cliente.
                </p>
              </div>
            )}
          </div>
          {showAdvancedImport && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-500">Importa dipendenti (CSV)</div>
              <button onClick={() => { setShowImportModal(v => !v); setImportResult(null); setCsvText(''); }}
                className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-100">
                {showImportModal ? '✕ Chiudi' : '📥 Importa CSV'}
              </button>
            </div>
            {showImportModal && (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 font-mono">
                  Formato CSV atteso:<br />
                  <span className="text-green-700">nome,cognome,email,sede,genere,mansione</span><br />
                  <span className="text-gray-400">Mario,Rossi,mario.rossi@azienda.it,Torino,M,Operaio</span>
                </div>
                <textarea value={csvText} onChange={e => setCsvText(e.target.value)}
                  placeholder="Incolla il CSV qui..."
                  rows={5}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <button onClick={handleImportCSV} disabled={!csvText.trim() || importing}
                  className={`w-full py-3 rounded-xl text-sm font-semibold ${!csvText.trim() || importing ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  {importing ? '⏳ Importazione...' : 'Importa dipendenti'}
                </button>
                {importResult && (
                  <div className={`rounded-xl p-3 text-sm ${importResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>
                    {importResult.error ? `❌ ${importResult.error}` : (
                      <>✅ Importati: <strong>{importResult.imported}</strong> · Saltati: {importResult.skipped}
                        {importResult.errors?.length > 0 && <div className="mt-1 text-xs">{importResult.errors.slice(0,3).map(e => `⚠️ ${e.row}: ${e.error}`).join(' · ')}</div>}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* Campagna email — visibile solo in modalità avanzata */}
          {showAdvancedImport && (
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-500">Campagna assessment email</div>
              <button
                onClick={() => setShowCampaignConfirm(true)}
                disabled={sendingCampaign}
                className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl hover:bg-green-100 disabled:opacity-50"
              >
                {sendingCampaign ? '⏳ Invio...' : '📧 Invia a tutti i pending'}
              </button>
            </div>
            {campaignResult && (
              <div className={`rounded-xl p-3 text-sm mt-2 ${campaignResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>
                {campaignResult.error
                  ? `❌ ${campaignResult.error}`
                  : `✅ Inviati: ${campaignResult.sent} · Falliti: ${campaignResult.failed}`
                }
                {campaignResult.message && <div className="text-xs mt-1 text-gray-500">{campaignResult.message}</div>}
              </div>
            )}
          </div>
          )}

          {/* PDF Preventivo */}
          <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
            <div className="text-xs text-gray-500">PDF preventivo per il cliente</div>
            <div className="flex gap-2">
              {quotePdfUrl && (
                <a href={quotePdfUrl} target="_blank" rel="noreferrer"
                  className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
                  ⬇️ Scarica PDF
                </a>
              )}
              <button onClick={generateQuotePdf} disabled={generatingQuotePdf}
                className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl hover:bg-orange-100 disabled:opacity-50">
                {generatingQuotePdf ? '⏳ Generazione...' : '📄 Genera PDF preventivo'}
              </button>
            </div>
          </div>
        </div>

        {/* Modal conferma campagna */}
        {showCampaignConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
              <div className="text-lg font-bold text-gray-900 mb-2">📧 Invia campagna assessment</div>
              <p className="text-sm text-gray-600 mb-4">
                Stai per inviare l'email di invito assessment a tutti i dipendenti di <strong>{client.name}</strong> con email configurata e assessment non ancora completato.
              </p>
              <div className="flex gap-3">
                <button onClick={sendCampaign} disabled={sendingCampaign}
                  className="flex-1 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm disabled:opacity-50">
                  {sendingCampaign ? 'Invio...' : 'Sì, invia'}
                </button>
                <button onClick={() => setShowCampaignConfirm(false)} className="px-5 py-3 rounded-xl border border-gray-300 text-gray-600 text-sm">
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>

    {/* ── Modal Report AI ────────────────────────────────────────── */}
    {reportModal && (
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
          <div className="flex items-center justify-between p-5 border-b border-gray-200">
            <div>
              <div className="font-bold text-gray-900">{reportModal.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{reportModal.source === 'ai' ? '✨ Generato con Claude AI' : '📋 Generato con template'} · {client.name}</div>
            </div>
            <div className="flex gap-2">
              {reportModal.pdf_url && (
                <a href={reportModal.pdf_url} target="_blank" rel="noreferrer"
                  className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl hover:bg-indigo-100">
                  ⬇️ Scarica PDF
                </a>
              )}
              <button onClick={() => { navigator.clipboard?.writeText(reportModal.content); }}
                className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-100">
                📋 Copia
              </button>
              <button onClick={() => setReportModal(null)} className="text-gray-400 hover:text-gray-600 text-xl px-2">✕</button>
            </div>
          </div>
          <div className="overflow-y-auto p-5 flex-1 prose prose-sm max-w-none">
            {reportModal.content.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-gray-900 mt-5 mb-2">{line.slice(3)}</h2>;
              if (line.startsWith('### ')) return <h3 key={i} className="text-base font-bold text-gray-800 mt-4 mb-1">{line.slice(4)}</h3>;
              if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-gray-800">{line.slice(2, -2)}</p>;
              if (line.startsWith('- ')) return <li key={i} className="text-gray-700 ml-4">{line.slice(2)}</li>;
              if (line.match(/^\d+\. /)) return <li key={i} className="text-gray-700 ml-4">{line.replace(/^\d+\. /, '')}</li>;
              if (line.trim() === '') return <div key={i} className="h-2" />;
              return <p key={i} className="text-gray-700">{line}</p>;
            })}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export const getServerSideProps = require('../../lib/auth').requireAuthSsr(async (ctx) => {
  const { clientId } = ctx.params;
  const client = await getClientById(clientId);
  if (!client) return { notFound: true };

  const [{ assessments, responses }, assignments, patientsRaw, sessionsRaw, referralCodes, allProfessionals] = await Promise.all([
    getResponsesForClient(clientId),
    getAssignmentsByClient(clientId),
    getPatientsByClient(clientId),
    getSessionsForClient(clientId),
    getReferralCodesByClient(clientId),
    getProfessionals().catch(() => []),
  ]);

  // Carica consensi per ogni assessment chiuso
  const assessmentsWithConsents = await Promise.all(
    assessments.map(async a => {
      if (a.status === 'closed') {
        const consents = await getConsentsByAssessment(a.id);
        return { ...a, consents };
      }
      return { ...a, consents: [] };
    })
  );

  // Aggrega NRS per paziente (no note cliniche)
  const patientsNrs = patientsRaw.map(p => {
    const closed = sessionsRaw.filter(s => s.patient_id === p.id && s.closed_at);
    const firstClosed = closed.find(s => s.nrs_pre !== null);
    const lastClosed = closed.length > 0 ? closed[closed.length - 1] : null;
    return {
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      name: `${p.first_name} ${p.last_name}`.trim(),
      level: p.level || null,
      care_token: p.care_token || null,
      email: p.email || null,
      assigned_professional_id: p.assigned_professional_id || null,
      assessment_completed_at: p.assessment_completed_at || null,
      assessment_invite_sent_at: p.assessment_invite_sent_at || null,
      session_count: closed.length,
      nrs_first: firstClosed?.nrs_pre ?? null,
      nrs_last: lastClosed?.nrs_pre ?? null,
    };
  });

  // Carica waitlist L1 (graceful: tabella potrebbe non esistere ancora)
  let waitlist = [];
  try {
    waitlist = await getWaitlistByClient(clientId);
  } catch (_) {
    waitlist = [];
  }

  let generatedReports = [];
  try {
    generatedReports = await getGeneratedReportsByClient(clientId);
  } catch (_) {}

  return { props: { client, assessments: assessmentsWithConsents, responses, assignments, patientsNrs, referralCodes, waitlist, generatedReports, allProfessionals } };
});
