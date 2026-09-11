import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { requireAuthSsr } from '../../lib/auth';
import NavMenu from '../../components/NavMenu';
import { STAGES, STAGES_LATERALI, TUTTI, trovaStage, normalizza, isFirmato, isChiuso } from '../../lib/pipeline';
import { oggiRoma, aggiungiGiorni, etichettaData } from '../../lib/checkup';

// ─── Costanti ─────────────────────────────────────────────────────────────────
// Stati, etichette e colori: fonte unica lib/pipeline.js (anche Finance e dashboard).

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

// Data breve nella card: "12 ottobre"; rossa se già passata.
function RigaData({ icona, testo, data, vuoto }) {
  if (!data) return vuoto ? <div className="text-xs text-gray-400 mb-2">{icona} {vuoto}</div> : null;
  const passata = data < oggiRoma();
  return (
    <div className={`text-xs mb-2 font-medium ${passata ? 'text-red-600' : 'text-gray-600'}`}>
      {icona} {testo} {etichettaData(data)}{passata ? ' — scaduta' : ''}
    </div>
  );
}

// ─── Componente card cliente ───────────────────────────────────────────────────

function ClientCard({ client, onMove }) {
  const stage = trovaStage(client.pipeline_stage);
  const idx = stageIndex(stage.id);

  return (
    <div
      className="bg-white rounded-xl border p-3 shadow-sm hover:shadow-md transition-shadow"
      style={{ borderColor: stage.border }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/dashboard/${client.id}`} className="font-semibold text-gray-900 text-sm leading-tight hover:text-green-700 flex-1 min-w-0 truncate">
          {client.name}
          {client.is_demo && <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded bg-gray-200 text-gray-500 align-middle">DEMO</span>}
          {client.binario && <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded bg-gray-900 text-white align-middle">{client.binario}</span>}
        </Link>
        <span className="text-xs text-gray-400 whitespace-nowrap">{client.employees} dip.</span>
      </div>

      {stage.id === 'not_now' && <RigaData icona="🔁" testo="Ricontattare il" data={client.ricontatto_il} />}
      {stage.id === 'offer_open' && <RigaData icona="⏳" testo="Scade il" data={client.offerta_scade_il} vuoto="senza scadenza" />}

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

      {/* Navigazione rapida lungo il percorso */}
      <div className="flex gap-1.5 flex-wrap mt-2">
        {idx > 0 && (
          <button
            onClick={() => onMove(client, STAGES[idx - 1].id)}
            className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            ← {STAGES[idx - 1].label}
          </button>
        )}
        {idx >= 0 && idx < STAGES.length - 1 && (
          <button
            onClick={() => onMove(client, STAGES[idx + 1].id)}
            className="text-xs px-2 py-1 rounded-lg font-medium hover:opacity-80"
            style={{ background: STAGES[idx + 1].bg, color: STAGES[idx + 1].color, borderColor: STAGES[idx + 1].border, border: '1px solid' }}
          >
            {STAGES[idx + 1].label} →
          </button>
        )}
      </div>
      {/* Qualsiasi stato, compresi Non ora / No / Declinato */}
      <select
        value=""
        onChange={e => { if (e.target.value) onMove(client, e.target.value); }}
        className="mt-2 w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-500 focus:outline-none"
      >
        <option value="">Sposta in…</option>
        {TUTTI.filter(s => s.id !== stage.id).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    </div>
  );
}

// Finestra per le due date che la pipeline chiede: ricontatto ("Non ora", obbligatoria)
// e scadenza dell'offerta ("Offerta aperta": A proposta dal Listino, B senza scadenza).
function ModaleData({ richiesta, onConferma, onAnnulla }) {
  const { client, target, proposta } = richiesta;
  const nonOra = target === 'not_now';
  const [data, setData] = useState(proposta || '');
  const oggi = oggiRoma();
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3">
        <h3 className="font-semibold text-gray-800 text-base">{client.name} → {nonOra ? 'Non ora' : 'Offerta aperta'}</h3>
        {nonOra ? (
          <>
            <p className="text-sm text-gray-600">Quando lo ricontatti? Comparirà in dashboard nella settimana della data.</p>
            <div className="flex gap-1.5 flex-wrap">
              {[[1, '+1 mese'], [3, '+3 mesi'], [6, '+6 mesi']].map(([m, lbl]) => (
                <button key={m} type="button" onClick={() => setData(aggiungiGiorni(oggi, m * 30))}
                  className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">{lbl}</button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-600">
            {client.binario === 'A'
              ? 'Binario A: l\'offerta scade in questa data (dal Listino). Puoi cambiarla.'
              : 'Binario B (o non deciso): nessuna scadenza — può essere un sì in attesa del nuovo budget. Metti una data solo se ti serve.'}
          </p>
        )}
        <input type="date" value={data} min={oggi} onChange={e => setData(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        <div className="flex gap-3">
          <button
            onClick={() => onConferma(nonOra ? { ricontatto_il: data } : { offerta_scade_il: data || null })}
            disabled={nonOra && !data}
            className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-40"
          >
            Conferma
          </button>
          <button onClick={onAnnulla} className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm">Annulla</button>
        </div>
      </div>
    </div>
  );
}

// Una colonna del kanban.
function Colonna({ stage, clienti, onMove, onNote }) {
  return (
    <div className="flex flex-col">
      <div
        className="rounded-xl px-3 py-2 mb-2 flex items-center justify-between"
        style={{ background: stage.bg, border: `1px solid ${stage.border}` }}
      >
        <span className="text-xs font-bold" style={{ color: stage.color }}>{stage.label}</span>
        <span className="text-xs font-semibold rounded-full px-1.5 py-0.5" style={{ background: stage.color + '20', color: stage.color }}>
          {clienti.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 min-h-20">
        {clienti.length === 0 && <div className="text-center text-xs text-gray-300 py-4">—</div>}
        {clienti.map(client => (
          <div key={client.id}>
            <ClientCard client={client} onMove={onMove} />
            <button
              onClick={() => onNote(client)}
              className="w-full text-xs text-gray-400 hover:text-gray-600 text-left px-2 py-0.5"
            >
              ✏️ note
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

export default function PipelinePage({ clients: initialClients, offertaGiorniA = 10 }) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [filterSource, setFilterSource] = useState('all');
  const [editingNotes, setEditingNotes] = useState(null); // { id, notes }
  const [saving, setSaving] = useState(false);
  const [richiestaData, setRichiestaData] = useState(null); // { client, target, proposta }

  // "Non ora" e "Offerta aperta" chiedono prima una data; gli altri stati si spostano subito.
  function onMove(client, target) {
    if (target === 'not_now') return setRichiestaData({ client, target, proposta: '' });
    if (target === 'offer_open') return setRichiestaData({ client, target, proposta: client.binario === 'A' ? aggiungiGiorni(oggiRoma(), offertaGiorniA) : '' });
    moveClient(client, target, {});
  }

  async function moveClient(client, newStage, extra) {
    setRichiestaData(null);
    const prima = client;
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, pipeline_stage: newStage, ...extra } : c));
    const r = await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage: newStage, last_contact_date: new Date().toISOString(), ...extra }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) {
      setClients(prev => prev.map(c => c.id === client.id ? prima : c));
      alert(j.error || 'Spostamento non salvato: riprova.');
    } else if (j.avviso) {
      alert(j.avviso);
    }
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

  // Statistiche — SOLO clienti reali (clients.is_demo, v49). Le aziende demo
  // restano visibili nelle colonne con badge, ma non vanno contate: un "Firmati: 1"
  // che in realtà è una demo è esattamente il numero che porta fuori strada.
  const realOnly = clients.filter(c => !c.is_demo);
  const demoCount = clients.length - realOnly.length;
  const conta = id => realOnly.filter(c => normalizza(c.pipeline_stage) === id).length;
  const stats = {
    total: realOnly.length,
    inCorso: realOnly.filter(c => !isFirmato(c.pipeline_stage) && !isChiuso(c.pipeline_stage) && normalizza(c.pipeline_stage) !== 'not_now').length,
    nonOra: conta('not_now'),
    signed: conta('signed'),
    no: conta('no'),
    lost: conta('lost'),
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
        <div className="max-w-7xl mx-auto px-4 py-2 flex gap-x-6 gap-y-1 flex-wrap text-sm text-gray-600">
          <span>Totale: <strong>{stats.total}</strong></span>
          <span className="text-yellow-700">In trattativa: <strong>{stats.inCorso}</strong></span>
          <span className="text-slate-600">Non ora: <strong>{stats.nonOra}</strong></span>
          <span className="text-green-700">Accettati: <strong>{stats.signed}</strong></span>
          <span className="text-gray-500">No: <strong>{stats.no}</strong></span>
          <span className="text-red-600">Declinati: <strong>{stats.lost}</strong></span>
          {demoCount > 0 && <span className="text-gray-400">(+{demoCount} demo, non conteggiate)</span>}
        </div>
      </div>

      {/* Kanban: il percorso, poi gli stati a lato */}
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {STAGES.map(stage => (
            <Colonna key={stage.id} stage={stage} clienti={filtered.filter(c => normalizza(c.pipeline_stage) === stage.id)}
              onMove={onMove} onNote={c => setEditingNotes({ id: c.id, notes: c.pipeline_notes || '' })} />
          ))}
        </div>
        <div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Fuori dal percorso</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {STAGES_LATERALI.map(stage => (
              <Colonna key={stage.id} stage={stage} clienti={filtered.filter(c => normalizza(c.pipeline_stage) === stage.id)}
                onMove={onMove} onNote={c => setEditingNotes({ id: c.id, notes: c.pipeline_notes || '' })} />
            ))}
          </div>
        </div>
      </div>

      {richiestaData && (
        <ModaleData
          richiesta={richiestaData}
          onConferma={extra => moveClient(richiestaData.client, richiestaData.target, extra)}
          onAnnulla={() => setRichiestaData(null)}
        />
      )}

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
  let offertaGiorniA = 10;
  try { offertaGiorniA = (await (await import('../../lib/org')).getOrgParams()).offertaGiorniA; } catch (_) {}
  return {
    props: {
      offertaGiorniA,
      clients: clients.map(c => ({
        ...c,
        pipeline_stage: normalizza(c.pipeline_stage), // i vecchi 'won'/'active'/'closed' letti come i nuovi
        source: c.source || null,
        pipeline_notes: c.pipeline_notes || null,
        last_contact_date: c.last_contact_date || null,
        ricontatto_il: c.ricontatto_il || null,
        offerta_scade_il: c.offerta_scade_il || null,
      })),
    },
  };
});
