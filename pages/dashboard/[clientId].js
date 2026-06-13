import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getClientById, getResponsesForClient, getAssignmentsByClient, getPatientsByClient, getSessionsForClient, getReferralCodesByClient, getConsentsByAssessment, getWaitlistByClient, getGeneratedReportsByClient, getPatientsWithEmailByClient, getDocumentsByClient, getProfessionals, getMonitoringByClient, getTreatmentCapacity } from '../../lib/store';
import { TYPE_LABELS } from '../../lib/scoring';
import ReportView from '../../components/ReportView';
import ReportDoc, { reportPrintHtml } from '../../components/ReportDoc';
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

export default function ClientPage({ client: initialClient, assessments: initial, responses: initialResponses, assignments: initialAssignments, patientsNrs, referralCodes: initialReferralCodes, waitlist: initialWaitlist, generatedReports: initialReports, allProfessionals, monitoring, capacity: initialCapacity }) {
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
  const [showProList, setShowProList] = useState(false); // elenco professionisti a scomparsa

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
  const assignedCount = assignedPros.length;

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

  // Elimina un paziente/dipendente e tutti i suoi dati collegati
  async function deletePatient(p) {
    if (!confirm(`Eliminare ${p.first_name} ${p.last_name}?\n\nVerranno rimossi anche cicli, sedute, mini-check, pre-validazioni, segnalazioni e voci in lista d'attesa. Le risposte anonime dell'assessment restano negli aggregati.\n\nL'operazione non è reversibile.`)) return;
    const res = await fetch(`/api/admin/patients/${p.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.replace(router.asPath); // ricarica i dati della pagina
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'Errore eliminazione');
    }
  }

  const [saving, setSaving] = useState(false);
  const [reportAssessment, setReportAssessment] = useState(null);
  const [emailModal, setEmailModal] = useState(null); // { to, subject, body }
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [referralCodes, setReferralCodes] = useState(initialReferralCodes || []);
  const [copiedReferral, setCopiedReferral] = useState(null);
  const [generatingCode, setGeneratingCode] = useState(null); // 'P' | 'F' | null
  const [waitlist, setWaitlist] = useState(initialWaitlist || []);
  const [generatedReports, setGeneratedReports] = useState(initialReports || []);
  const [generatingReport, setGeneratingReport] = useState(null); // 'activation'|'t3'|'t6'|null
  const [reportModal, setReportModal] = useState(null); // { title, content, pdf_url }
  const [copiedAssessmentLink, setCopiedAssessmentLink] = useState(false);
  const [copiedMonitor, setCopiedMonitor] = useState(null); // patient_id+fase copiato
  const [showNrsTable, setShowNrsTable] = useState(false);  // tabella NRS a scomparsa
  const [showWaitlistTable, setShowWaitlistTable] = useState(false); // lista d'attesa a scomparsa
  const [capacity, setCapacity] = useState(initialCapacity);
  const [contractedInput, setContractedInput] = useState(
    initialCapacity?.source === 'contratto' ? String(initialCapacity.contracted) : ''
  );
  const [savingContracted, setSavingContracted] = useState(false);

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
        const title = type === 'activation' ? 'Report di Attivazione' : type === 't12' ? 'Report Annuale (12 mesi)' : `Report Intermedio ${type.toUpperCase()}`;
        setReportModal({ title, content: data.report, source: data.source, pdf_url: data.pdf_url, dateStr: new Date().toLocaleDateString('it-IT') });
        setGeneratedReports(prev => [{ id: data.report_id || Date.now(), report_type: type === 'activation' ? 'activation' : `checkpoint_${type}`, created_at: new Date().toISOString(), pdf_url: data.pdf_url, content_text: data.report }, ...prev]);
      }
    } catch {}
    setGeneratingReport(null);
  }

  function reportTitleFromType(t) {
    if (t === 'activation') return 'Report di Attivazione';
    if (t === 'checkpoint_t12') return 'Report Annuale (12 mesi)';
    if (t?.startsWith('checkpoint_')) return `Report Intermedio ${t.replace('checkpoint_', '').toUpperCase()}`;
    return 'Report';
  }

  // Riapre un report già generato (dal testo salvato), senza rigenerarlo
  function openSavedReport(r) {
    if (r.content_text) {
      setReportModal({ title: reportTitleFromType(r.report_type), content: r.content_text, source: 'salvato', pdf_url: r.pdf_url, dateStr: r.created_at ? new Date(r.created_at).toLocaleDateString('it-IT') : null });
    } else if (r.pdf_url) {
      window.open(r.pdf_url, '_blank');
    } else {
      alert('Contenuto del report non disponibile.');
    }
  }

  // Stampa / salva PDF dal browser (funziona per qualsiasi report, anche riaperto)
  function printReport() {
    if (!reportModal) return;
    const w = window.open('', '_blank');
    if (!w) { alert('Consenti i popup per stampare il PDF.'); return; }
    w.document.write(reportPrintHtml({
      title: reportModal.title,
      company: client.name,
      content: reportModal.content,
      dateStr: reportModal.dateStr,
      source: reportModal.source,
    }));
    w.document.close();
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

  // v4: si crea solo l'assessment INIZIALE (uno per ciclo). I checkpoint T3/T6
  // sono mini-check automatici; il T12 è il re-assessment con link personali.
  async function createAssessment() {
    setSaving(true);
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: client.id, type: 'initial' }),
    });
    if (res.ok) {
      const a = await res.json();
      setAssessments(prev => [a, ...prev]);
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

  // Email al referente HR col link generico di auto-dichiarazione (v4):
  // è LUI a distribuirlo internamente (figura autorevole → più adesione).
  function emailGenericLink() {
    const url = `${baseUrl}/q/c/${client.assessment_share_code}`;
    const referente = client.contact_name || 'referente';
    const body = `Gentile ${referente},

come concordato, le invio il link per l'assessment ES Work dedicato ai dipendenti di ${client.name}.

Il questionario è riservato, si compila dallo smartphone in circa 5 minuti.

Le chiedo di inoltrare questo link a tutti i dipendenti tramite i vostri canali interni:
${url}

Le chiedo inoltre di comunicare ai dipendenti che l'azienda ha avviato un'iniziativa di salute organizzativa e che i dati sono trattati in modo riservato da Essentia Salutis, nel rispetto del segreto professionale: l'azienda non vedrà mai i dati individuali, ma solo risultati in forma aggregata.

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

  // Preventivo POST-ASSESSMENT: dati REALI (L1/L2 dall'assessment) + condizioni
  // della scheda colloquio (tier/tariffe/IVA caricati server-side da first_meetings).
  function openRealQuote(a) {
    router.push(`/dashboard/offer?assessmentId=${a.id}&clientId=${client.id}&n=${client.employees}`);
  }

  // Salva gli L1 a contratto e ricalcola la capacità in locale
  async function saveContractedL1() {
    const v = contractedInput === '' ? null : Math.max(0, parseInt(contractedInput) || 0);
    setSavingContracted(true);
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contracted_l1: v }),
    });
    if (res.ok && capacity) {
      const fallback = (patientsNrs || []).filter(p => p.level === 'level1').length;
      const contracted = v != null && v > 0 ? v : fallback;
      const budget = Math.ceil(contracted * (1 + (capacity.buffer_pct || 0.2)));
      const committed = capacity.used + capacity.pending;
      setCapacity({
        ...capacity,
        contracted,
        source: v != null && v > 0 ? 'contratto' : 'assessment',
        budget,
        committed,
        remaining: Math.max(0, budget - committed),
        intakeSaturated: budget > 0 && committed >= budget,
        deliverySaturated: budget > 0 && capacity.used >= budget,
      });
    } else if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'Errore salvataggio (hai eseguito la migration v30?)');
    }
    setSavingContracted(false);
  }

  // ── Monitoraggio T3/T6/T12 (v4) ──────────────────────────────────────────────
  // T3/T6: ancorati al 1° ciclo del paziente (90/180 gg) — il cron invia le email,
  // qui i link per l'invio manuale (HR/WhatsApp) finché il dominio email non è attivo.
  // T12: re-assessment dell'intera popolazione (campagna annuale, invio manuale).
  const monit = (() => {
    const m = monitoring || { cycles: [], checks: [], reassessments: [] };
    const now = Date.now();
    const checksBy = {};
    (m.checks || []).forEach(c => { (checksBy[c.patient_id] = checksBy[c.patient_id] || new Set()).add(c.check_type); });
    const reassSet = new Set((m.reassessments || []).map(r => r.patient_id));
    const firstCycle = {};
    (m.cycles || []).forEach(c => {
      if (!firstCycle[c.patient_id] || new Date(c.started_at) < new Date(firstCycle[c.patient_id])) firstCycle[c.patient_id] = c.started_at;
    });
    const byId = Object.fromEntries((patientsNrs || []).map(p => [p.id, p]));
    const dueT3 = [], dueT6 = [];
    Object.entries(firstCycle).forEach(([pid, started]) => {
      const p = byId[pid];
      if (!p || !p.care_token) return;
      const days = Math.floor((now - new Date(started)) / 86400000);
      const done = checksBy[pid] || new Set();
      if (days >= 90 && !done.has('t3')) dueT3.push({ ...p, days });
      if (days >= 180 && !done.has('t6')) dueT6.push({ ...p, days });
    });
    const dueT12 = (patientsNrs || []).filter(p => p.care_token && p.assessment_completed_at && !reassSet.has(p.id));
    return {
      dueT3, dueT6, dueT12,
      doneT3: (m.checks || []).filter(c => c.check_type === 't3').length,
      doneT6: (m.checks || []).filter(c => c.check_type === 't6').length,
      doneT12: (m.reassessments || []).length,
    };
  })();

  function copyMonitorLink(p, fase) {
    const url = fase === 't12'
      ? `${baseUrl}/employee/reassessment?token=${p.care_token}`
      : `${baseUrl}/employee/minicheck?token=${p.care_token}&type=${fase}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedMonitor(p.id + fase);
    setTimeout(() => setCopiedMonitor(null), 2000);
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
          onOpenCalculator={reportAssessment.type === 'initial' ? () => openRealQuote(reportAssessment) : null}
          aiInitialText={generatedReports.find(r => r.report_type === 'activation')?.content_text || null}
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
            <NavMenu />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* ── Gestione Dipendenti & Campagna Assessment ──────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">👥 Dipendenti &amp; Assessment</h2>
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

          {/* ── Assessment iniziale: ciclo di vita (hub unico v4) ── */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Assessment iniziale</div>
              <button
                onClick={emailGenericLink}
                className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-100"
              >
                ✉️ Invia link al referente HR
              </button>
            </div>

            {sortedAssessments.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-sm text-gray-500">Nessun assessment. Avvialo, poi fai distribuire il link qui sopra dal referente HR.</p>
                <button onClick={createAssessment} disabled={saving}
                  className="text-sm font-semibold bg-green-600 text-white px-4 py-2 rounded-xl disabled:opacity-50">
                  {saving ? 'Creazione…' : '▶️ Avvia assessment'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedAssessments.map(a => {
                  const rCount = (responses[a.id] || []).length;
                  return (
                    <div key={a.id} className="rounded-xl border border-gray-200 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-800 text-sm">{TYPE_LABELS[a.type] || 'Assessment'}</span>
                        {a.status === 'active'
                          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">ATTIVO</span>
                          : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">CHIUSO</span>}
                        <span className="text-xs text-gray-400">
                          {new Date(a.created_at).toLocaleDateString('it-IT')} · {rCount} {rCount === 1 ? 'risposta' : 'risposte'}
                        </span>
                        {a.consents && a.consents.length > 0 && (
                          <span className="text-xs text-green-600">✅ {a.consents.length} consensi GDPR</span>
                        )}
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                          {rCount > 0 && (
                            <button onClick={() => openReport(a)}
                              className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl hover:bg-indigo-100">
                              📊 Report
                            </button>
                          )}
                          {rCount > 0 && a.type === 'initial' && (
                            <button onClick={() => openRealQuote(a)}
                              className="text-xs font-semibold text-green-700 bg-green-50 border border-green-300 px-3 py-1.5 rounded-xl hover:bg-green-100"
                              title="Preventivo con i dati reali dell'assessment e le condizioni della scheda colloquio">
                              📄 Preventivo (PDF)
                            </button>
                          )}
                          {a.status === 'active' ? (
                            <button onClick={() => closeAssessment(a.id)}
                              className="text-xs font-medium text-gray-600 border border-gray-300 px-3 py-1.5 rounded-xl hover:bg-gray-50">
                              Chiudi raccolta
                            </button>
                          ) : (
                            <button onClick={() => reopenAssessment(a.id)}
                              className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl hover:bg-amber-100">
                              🔓 Riapri
                            </button>
                          )}
                          <button onClick={e => deleteAssessment(a.id, e)} className="p-1.5 text-gray-300 hover:text-red-400" title="Elimina">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!sortedAssessments.some(a => a.status === 'active') && (
                  <button onClick={createAssessment} disabled={saving}
                    className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl hover:bg-green-100 disabled:opacity-50">
                    {saving ? 'Creazione…' : '+ Nuovo assessment iniziale (nuovo ciclo annuale)'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>


        {/* ── Lista d'attesa L1 (a scomparsa) ─────────────────────────── */}
        {waitlist && waitlist.length > 0 && (
          <div>
            <button
              onClick={() => setShowWaitlistTable(v => !v)}
              className="w-full flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50 mb-2"
            >
              <span className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Lista d&apos;attesa L1</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{waitlist.filter(w => w.status === 'pending').length} in attesa · {waitlist.length} totali</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${showWaitlistTable ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            {showWaitlistTable && (
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
            )}
          </div>
        )}

        {/* ── Pazienti / NRS (solo coord., niente note cliniche) ──────── */}
        {patientsNrs && patientsNrs.length > 0 && (
          <div>
            {/* Cruscotto sintetico stratificazione */}
            <div className="grid grid-cols-4 gap-3 mb-3">
              {[
                { label: 'L1 — Trattamento', value: patientsNrs.filter(p => p.level === 'level1').length, color: '#dc2626' },
                { label: 'L2 — Monitoraggio', value: patientsNrs.filter(p => p.level === 'level2').length, color: '#ca8a04' },
                { label: 'L3 — Formazione', value: patientsNrs.filter(p => p.level === 'level3').length, color: '#16a34a' },
                { label: 'Totale', value: patientsNrs.length, color: '#374151' },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                  <div className="text-xl font-bold" style={{ color: k.color }}>{k.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Tabella NRS a scomparsa (cruscotto operativo: si apre solo se serve) */}
            <button
              onClick={() => setShowNrsTable(v => !v)}
              className="w-full flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50 mb-2"
            >
              <span className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Pazienti — NRS</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{patientsNrs.length} pazienti</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${showNrsTable ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            {showNrsTable && (
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
                    <th className="px-2 py-2"></th>
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
                        <td className="px-2 py-2.5 text-center">
                          <button onClick={() => deletePatient(p)} className="p-1 text-gray-300 hover:text-red-500" title="Elimina dipendente">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

        {/* ── Capacità trattamenti (anno) — L1 contratto + buffer 20% ── */}
        {capacity && capacity.budget > 0 && (() => {
          const pct = Math.min(100, Math.round(capacity.committed / capacity.budget * 100));
          const barColor = capacity.intakeSaturated ? '#dc2626' : pct >= 80 ? '#ca8a04' : '#16a34a';
          return (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🎯 Capacità trattamenti (anno)</div>
                {capacity.intakeSaturated ? (
                  <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">ESAURITA — self-trigger bloccati</span>
                ) : pct >= 80 ? (
                  <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{pct}% impegnata</span>
                ) : (
                  <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{capacity.remaining} percorsi disponibili</span>
                )}
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
              </div>
              <div className="text-xs text-gray-500">
                <strong className="text-gray-700">{capacity.used}</strong> cicli avviati · <strong className="text-gray-700">{capacity.pending}</strong> in coda · budget <strong className="text-gray-700">{capacity.budget}</strong> percorsi
                <span className="text-gray-400"> = {capacity.contracted} L1 {capacity.source === 'contratto' ? 'a contratto' : 'da assessment'} + buffer {Math.round(capacity.buffer_pct * 100)}%</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <label className="text-xs text-gray-400">L1 a contratto:</label>
                <input type="number" min="0" value={contractedInput}
                  onChange={e => setContractedInput(e.target.value)}
                  placeholder={`auto (${(patientsNrs || []).filter(p => p.level === 'level1').length})`}
                  className="w-24 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                <button onClick={saveContractedL1} disabled={savingContracted}
                  className="text-xs font-medium text-gray-600 border border-gray-200 px-2.5 py-1 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  {savingContracted ? '…' : 'Salva'}
                </button>
                <span className="text-xs text-gray-300">vuoto = usa gli L1 reali dell&apos;assessment</span>
              </div>
            </div>
          );
        })()}


        {/* ── Professionisti assegnati (elenco a scomparsa) ───────────── */}
        <div>
          <button
            onClick={() => setShowProList(v => !v)}
            className="w-full flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50"
          >
            <span className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Professionisti</span>
            <span className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{assignedCount > 0 ? `${assignedCount} assegnat${assignedCount === 1 ? 'o' : 'i'}` : 'nessuno assegnato'}</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showProList ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>
          {showProList && (
            (!allProfessionals || allProfessionals.length === 0) ? (
              <div className="mt-2 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-400">
                Nessun professionista creato. Creane uno dal menu <Link href="/dashboard/professionals" className="text-blue-500 hover:underline">Professionisti</Link>.
              </div>
            ) : (
              <div className="mt-2 space-y-2">
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
            )
          )}
        </div>

        {/* ── Monitoraggio T3 / T6 / T12 ──────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">📡 Monitoraggio T3 / T6 / T12</h2>
          <div className="text-xs text-gray-400 mt-0.5 mb-4">
            T3/T6: mini-check ancorati al 1° ciclo del paziente — invio email automatico ogni mattina (richiede dominio email verificato).
            T12: re-assessment annuale con PGIC di tutta la popolazione. Qui i link personali per l&apos;invio manuale (HR/WhatsApp).
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { fase: 't3', label: 'Mini-check T3 (3 mesi)', done: monit.doneT3, due: monit.dueT3, color: 'blue' },
              { fase: 't6', label: 'Mini-check T6 (6 mesi)', done: monit.doneT6, due: monit.dueT6, color: 'purple' },
              { fase: 't12', label: 'Re-assessment T12 + PGIC', done: monit.doneT12, due: monit.dueT12, color: 'amber' },
            ].map(({ fase, label, done, due, color }) => {
              const colorCls = { blue: 'text-blue-700 border-blue-200 bg-blue-50', purple: 'text-purple-700 border-purple-200 bg-purple-50', amber: 'text-amber-700 border-amber-200 bg-amber-50' }[color];
              return (
                <div key={fase} className="border border-gray-100 rounded-xl p-3">
                  <div className={`text-xs font-bold px-2 py-1 rounded-lg border inline-block ${colorCls}`}>{label}</div>
                  <div className="text-xs text-gray-500 mt-2 mb-2">
                    <span className="font-semibold text-green-700">{done} compilati</span> · <span className={due.length > 0 ? 'font-semibold text-amber-700' : ''}>{due.length} da invitare</span>
                  </div>
                  {due.length === 0 ? (
                    <div className="text-xs text-gray-300">{done > 0 ? 'Tutti invitati o completati ✓' : fase === 't12' ? 'Nessun dipendente pronto' : 'Nessun ciclo arrivato a scadenza'}</div>
                  ) : (
                    <div className="space-y-1 max-h-44 overflow-y-auto">
                      {due.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                          <span className="truncate text-gray-700">{p.first_name} {p.last_name}{p.days != null ? <span className="text-gray-400"> · {p.days}gg</span> : ''}</span>
                          <button onClick={() => copyMonitorLink(p, fase)}
                            className={`shrink-0 font-medium px-2 py-0.5 rounded border ${copiedMonitor === p.id + fase ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50'}`}>
                            {copiedMonitor === p.id + fase ? '✓' : '🔗 Link'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sezione AI Reports ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">🤖 Report AI</h2>
              <div className="text-xs text-gray-400 mt-0.5">Generati con Claude Sonnet — richiedono 15-30 secondi</div>
            </div>
          </div>
          {/* Il Report di Attivazione vive nel report dati dell'assessment (📊 Report,
              sezione "Commento clinico AI") — qui solo i checkpoint successivi. */}
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            {[
              { type: 't3', label: '📊 Report T3 (3 mesi)', desc: 'KPI intermedi + trend NRS', color: 'blue' },
              { type: 't6', label: '📈 Report T6 (6 mesi)', desc: 'Review intermedia + KPI', color: 'purple' },
              { type: 't12', label: '🏆 Report Annuale (12 mesi)', desc: '3 KPI esito + prevalenza + OT23', color: 'amber' },
            ].map(({ type, label, desc, color }) => {
              const colorCls = {
                green: 'bg-green-600 hover:bg-green-700 disabled:bg-green-300',
                blue: 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300',
                purple: 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300',
                amber: 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300',
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
                <button key={r.id} onClick={() => openSavedReport(r)}
                  className="w-full flex items-center justify-between py-1.5 px-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors">
                  <span>{r.report_type === 'activation' ? '📋 Attivazione' : r.report_type === 'checkpoint_t12' ? '🏆 Annuale' : `📊 ${r.report_type?.replace('checkpoint_', '').toUpperCase()}`}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-gray-400">{new Date(r.created_at).toLocaleDateString('it-IT')}</span>
                    <span className="text-blue-600 font-medium">Apri →</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Referral B2C ────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">🔗 Referral B2C</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => generateCode('P')}
                disabled={!!generatingCode || referralCodes.some(c => (c.type || 'P') === 'P')}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50"
                title={referralCodes.some(c => (c.type || 'P') === 'P') ? 'Codice Dipendenti già presente' : 'Crea codice Dipendenti'}
              >
                {generatingCode === 'P' ? '…' : '+ Dipendenti'}
              </button>
              <button
                onClick={() => generateCode('F')}
                disabled={!!generatingCode || referralCodes.some(c => c.type === 'F')}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 disabled:opacity-50"
                title={referralCodes.some(c => c.type === 'F') ? 'Codice Famigliari già presente' : 'Crea codice Famigliari'}
              >
                {generatingCode === 'F' ? '…' : '+ Famigliari'}
              </button>
              <Link href="/dashboard/referrals" className="text-xs text-orange-600 hover:underline">Tutti →</Link>
            </div>
          </div>
          {referralCodes.length === 0 ? (
            <div className="bg-orange-50 rounded-xl border border-orange-200 px-4 py-3 text-sm text-orange-600">
              Nessun codice ancora generato. Crea un codice con i pulsanti “+ Dipendenti” / “+ Famigliari” quando vuoi attivare il referral B2C per questa azienda.
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
                              {(rc.type||'P') === 'F' ? '👨‍👩‍👧 Famigliari' : '👤 Dipendenti'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{new Date(rc.created_at).toLocaleDateString('it-IT')}</div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {uses.length > 0 ? (
                            <span className="text-xs">
                              <span className="bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">{uses.filter(u => u.status === 'redeemed').length} redenti</span>
                              <span className="text-gray-400 ml-1">/ {uses.length} rich.</span>
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
          {(() => {
            const leads = referralCodes
              .flatMap(c => (c.referral_uses || []).map(u => ({ ...u, codeType: c.type || 'P' })))
              .sort((a, b) => new Date(b.used_at || 0) - new Date(a.used_at || 0));
            if (leads.length === 0) return null;
            return (
              <div className="mt-3 bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">Lead recenti</div>
                <div className="divide-y divide-gray-50">
                  {leads.slice(0, 30).map(l => (
                    <div key={l.id} className="px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-medium text-gray-800">{l.patient_name || '—'}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ml-2 ${l.codeType === 'F' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{l.codeType === 'F' ? 'Fam.' : 'Dip.'}</span>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {l.patient_phone ? `📞 ${l.patient_phone}` : ''}{l.patient_email ? ` · ✉️ ${l.patient_email}` : ''}{l.preferred_when ? ` · 🕐 ${l.preferred_when}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {l.voucher_code && <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{l.voucher_code}</span>}
                        {l.status === 'redeemed'
                          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">redento{l.amount != null ? ` · €${l.amount}` : ''}</span>
                          : <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">richiesto</span>}
                        {l.confirm_response === 'done' && l.status !== 'redeemed' && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full" title="Paziente conferma la visita ma il pro non ha redento">⚠ conf. paziente</span>
                        )}
                        {l.confirm_response === 'done' && l.status === 'redeemed' && (
                          <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">✓ conf. paziente</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

      </main>
    </div>

    {/* ── Modal Report AI ────────────────────────────────────────── */}
    {reportModal && (
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-b border-gray-100">
            {reportModal.pdf_url && (
              <a href={reportModal.pdf_url} target="_blank" rel="noreferrer"
                className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl hover:bg-indigo-100">
                ⬇️ Scarica PDF
              </a>
            )}
            <button onClick={printReport}
              className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-xl hover:bg-green-100">
              🖨️ Stampa / PDF
            </button>
            <button onClick={() => { navigator.clipboard?.writeText(reportModal.content); }}
              className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl hover:bg-blue-100">
              📋 Copia
            </button>
            <button onClick={() => setReportModal(null)} className="text-gray-400 hover:text-gray-600 text-xl px-2">✕</button>
          </div>
          <div className="overflow-y-auto px-5 py-5 flex-1 bg-gray-50/60">
            <ReportDoc
              content={reportModal.content}
              title={reportModal.title}
              company={client.name}
              dateStr={reportModal.dateStr}
              source={reportModal.source}
            />
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

  let monitoring = { cycles: [], checks: [], reassessments: [] };
  try {
    monitoring = await getMonitoringByClient(clientId);
  } catch (_) {}

  let capacity = null;
  try {
    capacity = await getTreatmentCapacity(clientId);
  } catch (_) {}

  return { props: { client, assessments: assessmentsWithConsents, responses, assignments, patientsNrs, referralCodes, waitlist, generatedReports, allProfessionals, monitoring, capacity } };
});
