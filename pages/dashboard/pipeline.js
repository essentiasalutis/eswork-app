import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { requireAuthSsr } from '../../lib/auth';
import { CONFIG } from '../../lib/config';
import NavMenu from '../../components/NavMenu';

// ─── Costanti ─────────────────────────────────────────────────────────────────

const STAGES = [
  { id: 'contacted',          label: 'Contattato',       color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  { id: 'meeting_scheduled',  label: 'Colloquio fissato',color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { id: 'assessment_sent',    label: 'Assessment inviato',color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  { id: 'report_presented',   label: 'Report presentato',color: '#ca8a04', bg: '#fffbeb', border: '#fde68a' },
  { id: 'signed',             label: 'Contratto firmato',color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { id: 'lost',               label: 'Perso',            color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
];

const SOURCE_LABELS = {
  passaparola:       'Passaparola',
  contatto_diretto:  'Contatto diretto',
  social:            'Social media',
  evento:            'Evento',
  sito_web:          'Sito web',
  intermediario:     'Intermediario',
  altro:             'Altro',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stageIndex(id) {
  return STAGES.findIndex(s => s.id === id);
}

// ─── Componente card cliente ───────────────────────────────────────────────────

function ClientCard({ client, onMove }) {
  const stage = STAGES.find(s => s.id === client.pipeline_stage) || STAGES[0];
  const idx = stageIndex(client.pipeline_stage);

  return (
    <div
      className="bg-white rounded-xl border p-3 shadow-sm hover:shadow-md transition-shadow"
      style={{ borderColor: stage.border }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/dashboard/${client.id}`} className="font-semibold text-gray-900 text-sm leading-tight hover:text-green-700 flex-1 min-w-0 truncate">
          {client.name}
        </Link>
        <span className="text-xs text-gray-400 whitespace-nowrap">{client.employees} dip.</span>
      </div>

      {/* Fonte */}
      {client.source && (
        <div className="text-xs text-gray-500 mb-2">
          📌 {SOURCE_LABELS[client.source] || client.source}
        </div>
      )}

      {/* Referente */}
      {client.contact_name && (
        <div className="text-xs text-gray-500 mb-2 truncate">👤 {client.contact_name}</div>
      )}

      {/* Note pipeline */}
      {client.pipeline_notes && (
        <div className="text-xs text-gray-400 italic mb-2 line-clamp-2">{client.pipeline_notes}</div>
      )}

      {/* Navigazione rapida */}
      <div className="flex gap-1.5 flex-wrap mt-2">
        {idx > 0 && (
          <button
            onClick={() => onMove(client.id, STAGES[idx - 1].id)}
            className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            ← {STAGES[idx - 1].label}
          </button>
        )}
        {idx < STAGES.length - 1 && (
          <button
            onClick={() => onMove(client.id, STAGES[idx + 1].id)}
            className="text-xs px-2 py-1 rounded-lg font-medium hover:opacity-80"
            style={{ background: STAGES[idx + 1].bg, color: STAGES[idx + 1].color, borderColor: STAGES[idx + 1].border, border: '1px solid' }}
          >
            {STAGES[idx + 1].label} →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function PipelinePage({ clients: initialClients }) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [filterSource, setFilterSource] = useState('all');
  const [editingNotes, setEditingNotes] = useState(null); // { id, notes }
  const [saving, setSaving] = useState(false);

  async function moveClient(id, newStage) {
    // Ottimistica
    setClients(prev => prev.map(c => c.id === id ? { ...c, pipeline_stage: newStage } : c));
    await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage: newStage, last_contact_date: new Date().toISOString() }),
    });
  }

  async function saveNotes() {
    if (!editingNotes) return;
    setSaving(true);
    setClients(prev => prev.map(c => c.id === editingNotes.id ? { ...c, pipeline_notes: editingNotes.notes } : c));
    await fetch(`/api/clients/${editingNotes.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_notes: editingNotes.notes }),
    });
    setSaving(false);
    setEditingNotes(null);
  }

  const filtered = filterSource === 'all'
    ? clients
    : clients.filter(c => c.source === filterSource);

  // Statistiche
  const stats = {
    total: clients.length,
    signed: clients.filter(c => c.pipeline_stage === 'signed').length,
    active: clients.filter(c => !['signed', 'lost'].includes(c.pipeline_stage)).length,
    lost: clients.filter(c => c.pipeline_stage === 'lost').length,
  };

  // Sorgenti presenti
  const sourcesPresent = [...new Set(clients.map(c => c.source).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">← Dashboard</Link>
            <span className="text-gray-300">|</span>
            <div>
              <span className="text-xl font-bold text-gray-900">ES </span>
              <span className="text-xl font-bold text-green-600">Work</span>
              <span className="text-sm text-gray-500 ml-2">Pipeline CRM</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Filtro fonte */}
            {sourcesPresent.length > 0 && (
              <select
                value={filterSource}
                onChange={e => setFilterSource(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white text-gray-600 focus:outline-none"
              >
                <option value="all">Tutte le fonti</option>
                {sourcesPresent.map(s => (
                  <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-500 hover:text-gray-800 py-1.5 px-3 border border-gray-200 rounded-xl"
            >
              Lista aziende
            </button>
            <NavMenu />
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-2 flex gap-6 text-sm text-gray-600">
          <span>Totale: <strong>{stats.total}</strong></span>
          <span className="text-yellow-700">In lavorazione: <strong>{stats.active}</strong></span>
          <span className="text-green-700">Firmati: <strong>{stats.signed}</strong></span>
          <span className="text-red-600">Persi: <strong>{stats.lost}</strong></span>
        </div>
      </div>

      {/* Kanban */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {STAGES.map(stage => {
            const cols = filtered.filter(c => (c.pipeline_stage || 'contacted') === stage.id);
            return (
              <div key={stage.id} className="flex flex-col">
                {/* Intestazione colonna */}
                <div
                  className="rounded-xl px-3 py-2 mb-2 flex items-center justify-between"
                  style={{ background: stage.bg, border: `1px solid ${stage.border}` }}
                >
                  <span className="text-xs font-bold" style={{ color: stage.color }}>{stage.label}</span>
                  <span
                    className="text-xs font-semibold rounded-full px-1.5 py-0.5"
                    style={{ background: stage.color + '20', color: stage.color }}
                  >
                    {cols.length}
                  </span>
                </div>

                {/* Carte */}
                <div className="flex flex-col gap-2 min-h-20">
                  {cols.length === 0 && (
                    <div className="text-center text-xs text-gray-300 py-4">—</div>
                  )}
                  {cols.map(client => (
                    <div key={client.id}>
                      <ClientCard
                        client={client}
                        onMove={moveClient}
                      />
                      {/* Pulsante modifica note */}
                      <button
                        onClick={() => setEditingNotes({ id: client.id, notes: client.pipeline_notes || '' })}
                        className="w-full text-xs text-gray-400 hover:text-gray-600 text-left px-2 py-0.5"
                      >
                        ✏️ note
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modale note */}
      {editingNotes && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3">
            <h3 className="font-semibold text-gray-800 text-base">Note pipeline</h3>
            <textarea
              value={editingNotes.notes}
              onChange={e => setEditingNotes(p => ({ ...p, notes: e.target.value }))}
              rows={4}
              placeholder="Es. cliente molto interessato, vuole risentirci a settembre..."
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={saveNotes}
                disabled={saving}
                className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {saving ? 'Salvo...' : 'Salva'}
              </button>
              <button
                onClick={() => setEditingNotes(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const getServerSideProps = requireAuthSsr(async () => {
  const { getClients } = require('../../lib/store');
  const clients = await getClients();
  return {
    props: {
      clients: clients.map(c => ({
        ...c,
        pipeline_stage: c.pipeline_stage || 'contacted',
        source: c.source || null,
        pipeline_notes: c.pipeline_notes || null,
        last_contact_date: c.last_contact_date || null,
      })),
    },
  };
});
