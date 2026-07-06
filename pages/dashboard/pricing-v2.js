import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import NavMenu from '../../components/NavMenu';
import { requireAuthSsr } from '../../lib/auth';

// Etichette umane dei fattori numerici v2 (la v1 è congelata nel codice e NON
// compare qui: impossibile modificarla da UI).
const PARAM_LABELS = {
  l2_multiplier: 'Moltiplicatore L2 (L2 attesi = L1 × m)',
  sessions_per_l1: 'Sedute per ciclo L1',
  session_duration_min: 'Durata seduta (minuti)',
  prevention_sessions_per_l2: 'Sessioni prevenzione per L2',
  tariffa_sessione_prevenzione: 'Tariffa sessione prevenzione (€)',
  buffer_pct: 'Buffer clinico (es. 0.20 = 20%) — solo su clinica',
  capienza_aula: 'Capienza aula (formazione)',
  training_modules_y1: 'Moduli formazione Anno 1',
  training_modules_y2: 'Moduli formazione Anno 2+',
  ergonomia_minuti_persona: 'Ergonomia ufficio: minuti a persona',
  ergonomia_minuti_postazione: 'Ergonomia produzione: minuti a postazione tipo',
  ergonomia_minimo_ore: 'Ergonomia: minimo fatturabile (ore)',
  soglia_ingresso: 'Soglia pacchetto prevenzione (dipendenti max)',
  assessment_prezzo_per_dipendente: 'Assessment nel pacchetto: € per dipendente dichiarato',
};

const TEXT_LABELS = {
  nota_validazione_report: 'Nota di validazione (in fondo a OGNI report: Attivazione + checkpoint)',
  naming_cliente_programma_completo: 'Nome cliente-facing: programma completo',
  naming_cliente_pacchetto_prevenzione: 'Nome cliente-facing: pacchetto prevenzione',
  testo_evoluzione_pacchetto: 'Report pacchetto: testo "evoluzione verso il programma completo"',
  argomentario_prevenzione_l2: 'Argomentario — Prevenzione L2',
  argomentario_ergonomia: 'Argomentario — Ergonomia',
  argomentario_buffer: 'Argomentario — Buffer clinico',
  argomentario_formazione: 'Argomentario — Formazione',
  argomentario_assessment_pacchetto: 'Argomentario — Assessment (pacchetto)',
};

const CONFIGS = ['core', 'plus', 'enterprise'];

export default function PricingV2Page() {
  const [cfg, setCfg] = useState(null);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/pricing-config');
    if (!r.ok) { setErr('Errore di caricamento'); return; }
    setCfg(await r.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function put(body, okMsg) {
    setErr('');
    const r = await fetch('/api/admin/pricing-config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || 'Errore'); return false; }
    setFlash(okMsg); setTimeout(() => setFlash(''), 1500);
    return true;
  }

  if (!cfg) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">{err || 'Caricamento…'}</div>;

  const { params, texts, servizi } = cfg;
  const voci = [...new Map(servizi.map(s => [s.voce, s.ordine])).entries()].sort((a, b) => a[1] - b[1]).map(([v]) => v);
  const byVoceCfg = (voce, c) => servizi.find(s => s.voce === voce && s.configurazione === c);
  const box = 'bg-white rounded-2xl border border-gray-200 p-5';
  const inputCls = 'px-3 py-1.5 rounded-lg border border-gray-200 text-sm w-full focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <>
      <Head><title>Listino v2 — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-5 py-3 flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-700">←</Link>
            <div className="flex-1">
              <h1 className="font-bold text-gray-900">⚙️ Listino v2 — parametri, servizi e argomentari</h1>
              <p className="text-xs text-gray-500">Solo nuove aziende (v2). Il listino v1 dei clienti esistenti è congelato nel codice e non è modificabile da qui. Gli argomentari sono SOLO interni: mai nei documenti generati.</p>
            </div>
            {flash && <span className="text-xs text-green-600 font-semibold">✓ {flash}</span>}
            <NavMenu />
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-5 py-6 space-y-5">
          {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</div>}

          {/* Fattori numerici */}
          <div className={box}>
            <h2 className="font-semibold text-gray-800 mb-3">Fattori di calcolo (v2)</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {Object.keys(PARAM_LABELS).map(k => (
                <label key={k} className="text-xs text-gray-500">{PARAM_LABELS[k]}
                  <input type="number" step="any" defaultValue={params[k]} className={`${inputCls} mt-1`}
                    onBlur={e => { if (String(params[k]) !== e.target.value && e.target.value !== '') put({ tipo: 'setting', key: k, value: e.target.value }, 'parametro salvato'); }} />
                </label>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-3">Solo fattori primitivi: i costi si calcolano (es. ergonomia ufficio = minuti/60 × tariffa oraria sportello del cliente; assessment pacchetto = n dipendenti × €/dipendente).</p>
          </div>

          {/* Servizi & deliverable */}
          <div className={box}>
            <h2 className="font-semibold text-gray-800 mb-1">Servizi &amp; deliverable — valori dichiarati (€/anno)</h2>
            <p className="text-xs text-gray-500 mb-3">Le configurazioni (core/plus/enterprise) sono nomi interni: nei documenti cliente compaiono solo le voci con i valori — mai un totale, mai «in omaggio».</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="py-2">Voce</th>{CONFIGS.map(c => <th key={c} className="capitalize">{c}</th>)}
                </tr></thead>
                <tbody>
                  {voci.map(voce => (
                    <tr key={voce} className="border-b border-gray-50 align-top">
                      <td className="py-2 pr-3 font-medium text-gray-800">
                        {voce}
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[11px] text-gray-400">argomentario (solo interno)</summary>
                          {CONFIGS.map(c => { const row = byVoceCfg(voce, c); return row ? (
                            <div key={c} className="mt-1">
                              <div className="text-[10px] uppercase text-gray-400">{c}</div>
                              <textarea rows={2} defaultValue={row.descrizione_argomentario || ''} className={`${inputCls} text-xs font-normal`}
                                onBlur={e => { if ((row.descrizione_argomentario || '') !== e.target.value) put({ tipo: 'servizio', id: row.id, descrizione_argomentario: e.target.value }, 'argomentario salvato'); }} />
                            </div>
                          ) : null; })}
                        </details>
                      </td>
                      {CONFIGS.map(c => { const row = byVoceCfg(voce, c); return (
                        <td key={c} className="py-2 pr-2">
                          {row ? (
                            <input type="number" step="any" defaultValue={row.valore_dichiarato} className={inputCls}
                              onBlur={e => { if (String(row.valore_dichiarato) !== e.target.value && e.target.value !== '') put({ tipo: 'servizio', id: row.id, valore_dichiarato: e.target.value }, 'valore salvato'); }} />
                          ) : '—'}
                        </td>
                      ); })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Testi: naming + argomentari componenti */}
          <div className={box}>
            <h2 className="font-semibold text-gray-800 mb-3">Naming cliente-facing e argomentari componenti</h2>
            <div className="space-y-3">
              {Object.keys(TEXT_LABELS).map(k => (
                <label key={k} className="block text-xs text-gray-500">{TEXT_LABELS[k]}
                  <textarea rows={k.startsWith('naming') ? 1 : 2} defaultValue={texts[k] || ''} className={`${inputCls} mt-1`}
                    onBlur={e => { if ((texts[k] || '') !== e.target.value) put({ tipo: 'setting', key: k, value: e.target.value }, 'testo salvato'); }} />
                </label>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async () => ({ props: {} }));
