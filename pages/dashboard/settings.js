import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { requireAuthSsr } from '../../lib/auth';
import { getAdminSettings } from '../../lib/store';

const GROUPS = [
  {
    label: 'Protocollo Clinico',
    icon: '🏥',
    keys: ['sessions_intensive', 'sessions_maintenance', 'sessions_prevention_y2', 'sessions_maintenance_y2', 'sessions_per_cycle', 'max_cycles_per_year', 'min_gap_between_cycles'],
  },
  {
    label: 'Regole Business',
    icon: '📋',
    keys: ['completion_rate', 'buffer_pct', 'max_acute_events_per_year'],
  },
  {
    label: 'Prezzi & Margini',
    icon: '💶',
    keys: ['hourly_rate', 'margin_y1', 'margin_y2'],
  },
  {
    label: 'Tier Aziende',
    icon: '🏢',
    keys: ['tier_core_max', 'tier_plus_max'],
  },
];

function SettingRow({ setting, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(setting.value);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: setting.key, value }),
      });
      if (res.ok) { onSave(setting.key, value); setEditing(false); }
    } catch {}
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800">{setting.label || setting.key}</div>
        {setting.description && <div className="text-xs text-gray-400 mt-0.5">{setting.description}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <input type="text" value={value} onChange={e => setValue(e.target.value)}
              className="w-24 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500"
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setValue(setting.value); setEditing(false); } }}
              autoFocus />
            <button onClick={save} disabled={saving}
              className="text-xs font-semibold text-white bg-green-600 px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
              {saving ? '...' : '✓'}
            </button>
            <button onClick={() => { setValue(setting.value); setEditing(false); }}
              className="text-xs text-gray-500 px-2 py-1.5 rounded-lg hover:bg-gray-100">
              ✕
            </button>
          </>
        ) : (
          <>
            <span className="text-sm font-bold text-gray-700 min-w-[60px] text-right">{setting.value}</span>
            <button onClick={() => setEditing(true)}
              className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-50">
              Modifica
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage({ settings: initialSettings }) {
  const [settings, setSettings] = useState(initialSettings);

  function handleSave(key, newValue) {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
  }

  const settingsByKey = Object.fromEntries(settings.map(s => [s.key, s]));

  return (
    <>
      <Head><title>Impostazioni — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="font-semibold text-gray-900">Impostazioni</div>
              <div className="text-xs text-gray-500">Parametri clinici e business — modifiche tracciate</div>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-6 space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
            <strong>⚠️ Attenzione:</strong> Modificare questi parametri influenza calcoli di preventivo, protocollo clinico e regole di business su tutti i clienti. Le modifiche hanno effetto immediato.
          </div>

          {GROUPS.map(group => {
            const groupSettings = group.keys.map(k => settingsByKey[k]).filter(Boolean);
            if (groupSettings.length === 0) return null;
            return (
              <div key={group.label} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="text-sm font-bold text-gray-700 mb-4">{group.icon} {group.label}</div>
                {groupSettings.map(s => (
                  <SettingRow key={s.key} setting={s} onSave={handleSave} />
                ))}
              </div>
            );
          })}

          {/* Impostazioni non in gruppo */}
          {(() => {
            const allGroupKeys = GROUPS.flatMap(g => g.keys);
            const ungrouped = settings.filter(s => !allGroupKeys.includes(s.key));
            if (ungrouped.length === 0) return null;
            return (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="text-sm font-bold text-gray-700 mb-4">⚙️ Altre impostazioni</div>
                {ungrouped.map(s => <SettingRow key={s.key} setting={s} onSave={handleSave} />)}
              </div>
            );
          })()}

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-700">
            Nota: le modifiche vengono salvate nel database e sono immediate. Il calcolatore usa sempre i valori da <code className="bg-blue-100 px-1 rounded">lib/config.js</code> — per sincronizzare aggiorna manualmente il file dopo le modifiche significative.
          </div>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async () => {
  try {
    const settings = await getAdminSettings();
    return { props: { settings } };
  } catch {
    return { props: { settings: [] } };
  }
});
