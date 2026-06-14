import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getProComplianceOverview } from '../../lib/store';

const DOC_COLS = [
  { type: 'identity', label: 'Identità' },
  { type: 'albo', label: 'Albo' },
  { type: 'rc_policy', label: 'Polizza RC' },
  { type: 'rc_receipt', label: 'Quietanza' },
  { type: 'contract', label: 'Contratto' },
];
const REQUIRED = new Set(['identity', 'albo', 'rc_policy', 'contract']);
const RC = {
  expired:   { txt: 'Scaduta',          cls: 'bg-red-100 text-red-700' },
  expiring:  { txt: 'In scadenza',      cls: 'bg-red-100 text-red-700' },
  valid:     { txt: 'Valida',           cls: 'bg-green-100 text-green-700' },
  no_expiry: { txt: 'Scadenza assente', cls: 'bg-amber-100 text-amber-700' },
  missing:   { txt: 'Mancante',         cls: 'bg-gray-100 text-gray-500' },
};
const fmt = d => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function ProCompliancePage({ overview: initial }) {
  const [rows, setRows] = useState(initial || []);

  async function download(id) {
    const r = await fetch(`/api/admin/pro-documents/${id}`);
    const j = await r.json();
    if (r.ok && j.url) window.open(j.url, '_blank'); else alert(j.error || 'Errore');
  }
  async function setExpiry(row, docId, expiry_date) {
    const r = await fetch(`/api/admin/pro-documents/${docId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiry_date }) });
    if (!r.ok) { alert('Errore'); return; }
    // ricalcolo stato RC lato client
    const now = Date.now(), in30 = now + 30 * 864e5;
    let rcStatus = 'no_expiry';
    if (expiry_date) { const e = Date.parse(expiry_date); rcStatus = e < now ? 'expired' : e <= in30 ? 'expiring' : 'valid'; }
    setRows(prev => prev.map(x => x.professional.id === row.professional.id
      ? { ...x, rcExpiry: expiry_date || null, rcStatus, rcBlocking: rcStatus === 'expired', docs: { ...x.docs, rc_policy: x.docs.rc_policy ? { ...x.docs.rc_policy, expiry_date: expiry_date || null } : x.docs.rc_policy } }
      : x));
  }

  const issues = rows.filter(r => r.rcStatus === 'expired' || r.rcStatus === 'expiring').length;

  return (
    <>
      <Head><title>Conformità professionisti — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-700">←</Link>
            <div>
              <h1 className="font-bold text-gray-900">🛡️ Conformità professionisti</h1>
              <p className="text-xs text-gray-500">Documenti obbligatori e scadenze polizza RC · {rows.length} professionisti{issues > 0 ? ` · ${issues} con RC da attenzionare` : ''}</p>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-6">
          {issues > 0 && (
            <div className="mb-4 text-sm bg-red-50 border border-red-200 text-red-800 rounded-2xl px-4 py-3">
              ⚠️ <strong>{issues}</strong> professionist{issues === 1 ? 'a' : 'i'} con polizza RC scaduta o in scadenza (≤30 giorni). Senza RC valida l&apos;operatività è sospesa (Art. 7.2 del contratto).
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Professionista</th>
                  {DOC_COLS.map(c => <th key={c.type} className="px-3 py-3 text-center">{c.label}</th>)}
                  <th className="px-4 py-3">Stato RC</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const rc = RC[row.rcStatus] || RC.missing;
                  const rcRed = row.rcStatus === 'expired' || row.rcStatus === 'expiring';
                  return (
                    <tr key={row.professional.id} className={`border-t border-gray-100 ${rcRed ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{row.professional.name}</div>
                        <div className="text-xs text-gray-400">{row.professional.email}{!row.professional.active && ' · disattivato'}</div>
                      </td>
                      {DOC_COLS.map(c => {
                        const d = row.docs[c.type];
                        return (
                          <td key={c.type} className="px-3 py-3 text-center">
                            {d ? (
                              <button onClick={() => download(d.id)} title={`${d.file_name || 'documento'} · ${fmt(d.uploaded_at)}`}
                                className="text-green-600 hover:text-green-800 font-bold">✓</button>
                            ) : (
                              <span className={REQUIRED.has(c.type) ? 'text-red-400' : 'text-gray-300'}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rc.cls}`}>{rc.txt}</span>
                          {row.docs.rc_policy && (
                            <input type="date" defaultValue={row.rcExpiry || ''} onBlur={e => { if (e.target.value !== (row.rcExpiry || '')) setExpiry(row, row.docs.rc_policy.id, e.target.value || null); }}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={DOC_COLS.length + 2} className="px-4 py-8 text-center text-gray-400">Nessun professionista.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            ✓ = documento presente (clicca per scaricarlo, accesso registrato). La scadenza della polizza RC è modificabile qui dal titolare. I documenti del professionista sono un trattamento distinto (art. 6.1.b) e non si mescolano coi dati clinici dei pazienti.
          </p>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async () => {
  let overview = [];
  try { overview = await getProComplianceOverview(); } catch (_) {}
  return { props: { overview: JSON.parse(JSON.stringify(overview)) } };
});
