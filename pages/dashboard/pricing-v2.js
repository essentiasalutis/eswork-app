import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import NavMenu from '../../components/NavMenu';
import { requireAuthSsr } from '../../lib/auth';
import ArgomentarioVoci from '../../components/ArgomentarioVoci';

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
  ergonomia_minuti_addetto: 'Ergonomia reparto: formazione addetto sulla sua postazione, minuti a persona',
  ergonomia_forfait_postazione: 'Ergonomia reparto: studio postazione tipo, € a forfait',
  ergonomia_minuti_postazione: 'Ergonomia reparto: tempo in sede per studio postazione (minuti — solo pianificazione e minimo ore, NON prezzo)',
  ergonomia_minimo_ore: 'Ergonomia: minimo fatturabile (ore)',
  soglia_ingresso: 'Soglia pacchetto prevenzione (dipendenti max)',
  assessment_prezzo_per_dipendente: 'Check-up nel pacchetto: € per dipendente dichiarato',
};

const TEXT_LABELS = {
  nota_report: 'Nota in fondo al report — testo scritto dalla piattaforma (senza AI)',
  nota_report_ai: 'Nota in fondo al report — testo generato con l\'AI',
  validatore_nome: 'Nome nella riga di validazione dei report (es. «Dott. … (osteopata)»)',
  naming_cliente_programma_completo: 'Nome cliente-facing: programma completo',
  naming_cliente_pacchetto_prevenzione: 'Nome cliente-facing: pacchetto prevenzione',
  testo_evoluzione_pacchetto: 'Report pacchetto: testo "evoluzione verso il programma completo"',
};

// Testi del Report Annuale (T12) — sezione "L'andamento del programma".
// A differenza degli argomentari (solo interni), QUESTI compaiono nel report generato.
// I {token} sono sostituiti coi numeri; default nel codice (lib/pricing/settings.js).
const ANDAMENTO_T12_LABELS = {
  report_t12_andamento_titolo: 'Titolo sezione',
  report_t12_andamento_intro: 'Intro (numerosità coorti T0/T12, {t0N} {t12N} {ratioPct})',
  report_t12_andamento_a_vantaggio: 'Confronto A — sotto l\'atteso di settore / vantaggio ({aPoint} {obsPct} {midPct} {gapPts})',
  report_t12_andamento_a_pari_sopra: 'Confronto A — in linea o sopra l\'atteso ({aPoint} {obsPct} {midPct})',
  report_t12_andamento_b_riduzione: 'Confronto B — prevalenza L1 in riduzione ({ratioPct} {t0L1pct} {t12L1pct} {deltaAbs})',
  report_t12_andamento_b_stabile: 'Confronto B — prevalenza L1 stabile ({ratioPct} {t0L1pct} {t12L1pct})',
  report_t12_andamento_b_aumento: 'Confronto B — prevalenza L1 in aumento, lettura onesta ({ratioPct} {t0L1pct} {t12L1pct} {deltaAbs})',
  report_t12_andamento_b_coorte_parziale: 'Confronto B — coorte parziale <70%, dato indicativo ({ratioPct} {t12N} {t0N} {t12L1pct} {t0L1pct})',
  report_t12_andamento_degrado_kanon: 'Degrado k-anon — numerosità sotto soglia ({t0N} {t12N} {kMin})',
  report_t12_andamento_chiusura_rinnovo: 'Chiusura — frame rinnovo / mantenimento del vantaggio ({t12L1pct} {midPct})',
  report_t12_andamento_chiusura_consolidamento: 'Chiusura — consolidamento (prevalenza in aumento)',
  report_t12_andamento_chiusura_neutra: 'Chiusura — neutra / consolidare',
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
            <p className="text-[11px] text-gray-400 mt-3">Solo fattori primitivi: i costi si calcolano (es. ergonomia ufficio e reparto = minuti/60 × tariffa oraria sportello del cliente; studio postazione = forfait × n postazioni; check-up pacchetto = n dipendenti × €/dipendente).</p>
          </div>

          {/* Parametri formazione (org) — turnover/recupero */}
          <div className={box}>
            <h2 className="font-semibold text-gray-800 mb-3">Parametri formazione (turnover / recupero)</h2>
            <div className="grid md:grid-cols-3 gap-3">
              {[['listino_concentrata', 'Listino base concentrata (€/gruppo)'], ['listino_base_completa', 'Listino base completa (€/gruppo)'], ['finestra_recupero_mesi', 'Finestra recupero (mesi)'], ['hr_ingressi_max_per_ora', 'Rate-limit HR (max ingressi/ora per azienda)']].map(([k, lbl]) => (
                <label key={k} className="text-xs text-gray-500">{lbl}
                  <input type="number" step="any" defaultValue={texts[k] ?? ''} className={`${inputCls} mt-1`}
                    onBlur={e => { if ((texts[k] ?? '') !== e.target.value && e.target.value !== '') put({ tipo: 'setting', key: k, value: e.target.value }, 'parametro salvato'); }} />
                </label>
              ))}
            </div>
            <label className="block text-xs text-gray-500 mt-3">Soglie recupero per fascia (JSON: max=null = oltre)
              <textarea rows={2} defaultValue={texts.soglia_recupero_fasce || ''} className={`${inputCls} mt-1 font-mono text-xs`}
                onBlur={e => { if ((texts.soglia_recupero_fasce || '') !== e.target.value) put({ tipo: 'setting', key: 'soglia_recupero_fasce', value: e.target.value }, 'soglie salvate'); }} />
            </label>
            <p className="text-[11px] text-gray-400 mt-2">Globali, editabili qui. Override per-azienda opzionale sui listini (colonna cliente); capienza gruppo resta per-azienda. Precedenza: override cliente → questi → default.</p>
          </div>

          {/* Check-up: durata proposta all'avvio (modificabile caso per caso) */}
          <div className={box}>
            <h2 className="font-semibold text-gray-800 mb-3">Check-up</h2>
            <label className="block text-xs text-gray-500 max-w-xs">Giorni di apertura proposti all'avvio (1–60)
              <input type="number" min="1" max="60" step="1" defaultValue={texts.checkup_giorni_default ?? ''} placeholder="10" className={`${inputCls} mt-1`}
                onBlur={e => { const v = e.target.value; if ((texts.checkup_giorni_default ?? '') !== v && /^\d+$/.test(v) && +v >= 1 && +v <= 60) put({ tipo: 'setting', key: 'checkup_giorni_default', value: v }, 'giorni del check-up salvati'); }} />
            </label>
            <label className="block text-xs text-gray-500 max-w-xs mt-3">Massimo check-up aperti non convertiti (1–20)
              <input type="number" min="1" max="20" step="1" defaultValue={texts.checkup_max_aperti ?? ''} placeholder="3" className={`${inputCls} mt-1`}
                onBlur={e => { const v = e.target.value; if ((texts.checkup_max_aperti ?? '') !== v && /^\d+$/.test(v) && +v >= 1 && +v <= 20) put({ tipo: 'setting', key: 'checkup_max_aperti', value: v }, 'limite dei check-up salvato'); }} />
            </label>
            <p className="text-[11px] text-gray-400 mt-2">Non convertiti = aziende reali in Check-up inviato, Report presentato o Offerta aperta. Oltre il limite, all&apos;avvio di un nuovo check-up compare un avviso (non un blocco).</p>
            <p className="text-[11px] text-gray-400 mt-2">La data di chiusura parte da oggi + questi giorni e si può cambiare a ogni avvio. Il check-up chiude alle 23:59 di quel giorno; chi aveva già iniziato ha 30 minuti per inviare.</p>
          </div>

          {/* Leve della presentazione del Report: il costo delle assenze è sempre uno scenario dichiarato */}
          <div className={box}>
            <h2 className="font-semibold text-gray-800 mb-3">Leve della presentazione — costo delle assenze</h2>
            <div className="grid md:grid-cols-2 gap-3 max-w-xl">
              <label className="block text-xs text-gray-500">Incidenza ipotizzata del programma (%)
                <input type="number" min="1" max="100" step="any" defaultValue={texts.assenze_incidenza_pct ?? ''} placeholder="10" className={`${inputCls} mt-1`}
                  onBlur={e => { const v = e.target.value; if ((texts.assenze_incidenza_pct ?? '') !== v && +v > 0 && +v <= 100) put({ tipo: 'setting', key: 'assenze_incidenza_pct', value: v }, 'incidenza salvata'); }} />
              </label>
              <label className="block text-xs text-gray-500">Costo di una giornata di assenza (€)
                <input type="number" min="1" step="any" defaultValue={texts.costo_giornata_assenza ?? ''} placeholder="160" className={`${inputCls} mt-1`}
                  onBlur={e => { const v = e.target.value; if ((texts.costo_giornata_assenza ?? '') !== v && +v > 0) put({ tipo: 'setting', key: 'costo_giornata_assenza', value: v }, 'costo giornata salvato'); }} />
              </label>
            </div>
            <label className="block text-xs text-gray-500 max-w-xs mt-3">Scarto Livello 2 — soglia di avviso (punti %)
              <input type="number" min="1" max="100" step="1" defaultValue={texts.scarto_l2_soglia ?? ''} placeholder="15" className={`${inputCls} mt-1`}
                onBlur={e => { const v = e.target.value; if ((texts.scarto_l2_soglia ?? '') !== v && +v >= 1 && +v <= 100) put({ tipo: 'setting', key: 'scarto_l2_soglia', value: v }, 'soglia salvata'); }} />
            </label>
            <p className="text-[11px] text-gray-400 mt-2">Scarto = differenza tra il Livello 2 osservato nel check-up e quello usato dal prezzo (Livello 1 × moltiplicatore). Oltre la soglia ti avviso prima di presentare e sull&apos;Offerta; il prezzo non cambia.</p>
            <p className="text-[11px] text-gray-400 mt-2">Compaiono sempre in chiaro nella frase («ipotizzando un&apos;incidenza del 10%», «un costo stimato di €160 per giornata»). Solo risparmio lordo, mai al netto del prezzo. Senza i giorni di malattia dal colloquio la leva non si mostra.</p>
          </div>

          {/* Offerta: validità per il binario A (il B non scade) */}
          <div className={box}>
            <h2 className="font-semibold text-gray-800 mb-3">Offerta</h2>
            <label className="block text-xs text-gray-500 max-w-xs">Validità dell'offerta — binario A (giorni, 1–90)
              <input type="number" min="1" max="90" step="1" defaultValue={texts.offerta_giorni_a ?? ''} placeholder="10" className={`${inputCls} mt-1`}
                onBlur={e => { const v = e.target.value; if ((texts.offerta_giorni_a ?? '') !== v && /^\d+$/.test(v) && +v >= 1 && +v <= 90) put({ tipo: 'setting', key: 'offerta_giorni_a', value: v }, 'validità dell\'offerta salvata'); }} />
            </label>
            <p className="text-[11px] text-gray-400 mt-2">Quando in Pipeline sposti un&apos;azienda del binario A in &laquo;Offerta aperta&raquo; la scadenza parte da oggi + questi giorni (modificabile). Binario B e non deciso: nessuna scadenza, la data si mette a mano solo se serve.</p>
          </div>

          {/* Argomentario delle 12 voci (testi di Enrico, sola lettura: stessi di Stima e Offerta) */}
          <div className={box}>
            <h2 className="font-semibold text-gray-800 mb-2">Argomentario</h2>
            <ArgomentarioVoci />
            <p className="text-[11px] text-gray-400 mt-2">Le 12 voci e i loro testi (per il cliente e per te) sono una lista unica, la stessa della Stima, del Report di Attivazione e dell&apos;Offerta. Per cambiarli chiedi a me.</p>
          </div>

          {/* Servizi & deliverable */}
          <div className={box}>
            <h2 className="font-semibold text-gray-800 mb-1">Servizi &amp; deliverable — valori dichiarati (€/anno)</h2>
            <p className="text-xs text-gray-500 mb-3">Solo per te, per ragionare: questi valori <strong>non compaiono mai</strong> nei documenti del cliente (decisione del 11/9: niente euro accanto alle voci, un solo numero — l&apos;investimento). Le configurazioni (core/plus/enterprise) sono nomi interni.</p>
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

          {/* Testi del Report Annuale (T12) — sezione "L'andamento del programma" */}
          <div className={box}>
            <h2 className="font-semibold text-gray-800 mb-1">Report Annuale (T12) — sezione «L&apos;andamento del programma»</h2>
            <p className="text-xs text-gray-500 mb-3">Questi testi <strong>compaiono nel report generato</strong> (a differenza degli argomentari, solo interni). I <code>{'{token}'}</code> sono sostituiti automaticamente con i numeri. Il template usato dipende dai dati (confronto vs settore, andamento anno-su-anno, soglia coorte, anonimato): non tutti compaiono in ogni report.</p>
            <div className="space-y-3">
              {Object.keys(ANDAMENTO_T12_LABELS).map(k => (
                <label key={k} className="block text-xs text-gray-500">{ANDAMENTO_T12_LABELS[k]}
                  <textarea rows={k.endsWith('titolo') ? 1 : 3} defaultValue={texts[k] || ''} className={`${inputCls} mt-1`}
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
