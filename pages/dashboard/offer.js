import { useState, useEffect } from 'react';
import Head from 'next/head';
import { requireAuthSsr } from '../../lib/auth';
import { getAssessmentById, getClientById, getResponsesByAssessment, getFirstMeeting } from '../../lib/store';
import {
  aggregateNMQ,
  trafficLight, TL_COLOR, TL_BG, TL_BORDER, TYPE_LABELS, generateSummaryText, BODY_ZONES,
} from '../../lib/scoring';
import { calculatePricing, calculateROI, fmt } from '../../lib/calculator';
import { CONFIG } from '../../lib/config';

// ─── Firma standard ───────────────────────────────────────────────────────────

const FIRMA = `Cordiali saluti,
Dott. Enrico Maiolo — founder @ Essentia Salutis
Tel: ${CONFIG.contact_phone}
${CONFIG.contact_email}`;

// ─── Modale email ─────────────────────────────────────────────────────────────

function EmailModal({ modal, onClose }) {
  const [to, setTo] = useState(modal.to);
  const [subject, setSubject] = useState(modal.subject);
  const [body, setBody] = useState(modal.body);

  const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-3 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Invia via email</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">A</label>
          <input
            value={to}
            onChange={e => setTo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Oggetto</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Testo</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>
        <div className="flex gap-3">
          <a
            href={href}
            className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold text-center hover:bg-green-700"
          >
            Apri in Mail
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

// generateInterventionPlan rimossa — ora usa AI via /api/ai/intervention-plan

// ─── Print page wrapper ───────────────────────────────────────────────────────

function Page({ children, className = '' }) {
  return (
    <div className={`offer-page${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}

// ─── Offer Document ───────────────────────────────────────────────────────────

export default function OfferPage({ client, assessment, nmq, calc, roi, forchetta, date }) {
  const [emailModal, setEmailModal] = useState(null);
  const [aiPlan, setAiPlan] = useState(null);       // null = caricamento, [] = pronto
  const [aiSource, setAiSource] = useState(null);   // 'ai' | 'fallback' | 'fallback_no_key'

  useEffect(() => {
    if (!nmq) return;
    fetch('/api/ai/intervention-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zones: nmq.zones,
        clientName: client?.name || 'Azienda',
        sector: client?.sector ?? 2,
        level1Count: nmq.level1.count,
      }),
    })
      .then(r => r.json())
      .then(d => { setAiPlan(d.plan || []); setAiSource(d.source); })
      .catch(() => { setAiPlan([]); setAiSource('fallback'); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!client || !assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Dati non disponibili. Torna alla dashboard.
      </div>
    );
  }

  const summaryText = generateSummaryText(nmq);

  // ─── Blocco B — Servizi di piattaforma e gestione (differenziato per tier) ────
  // I nomi dei tier NON compaiono nel PDF: cambia solo il contenuto mostrato.
  const offerTier = calc?.tier || 'core';
  const withPrevention = offerTier === 'plus' || offerTier === 'enterprise';
  const mgmtServices = (CONFIG.management_services && CONFIG.management_services[offerTier])
    || (CONFIG.management_services && CONFIG.management_services.core) || [];
  const mgmtTotal = mgmtServices.reduce((s, x) => s + (x.value || 0), 0);
  const showMgmtValues = mgmtTotal > 0;

  function openOfferEmail() {
    const referente = client.contact_name ? `Gentile ${client.contact_name},` : `Gentile referente,`;
    const prezzoY1 = calc ? fmt(calc.price_y1) : '–';
    const body = `${referente}

Le invio in allegato la proposta di intervento per ${client.name}, elaborata a seguito dell'assessment ES Work.

In sintesi, il programma anno 1 prevede:
• Sportello osteopatico in sede (trattamento individuale)
• Formazione collettiva su postura ed ergonomia
• 2 review intermedie (3 e 6 mesi) + report annuale finale
• Coordinamento completo e documentazione INAIL OT23

Investimento Anno 1: ${prezzoY1}

Il documento allegato contiene tutti i dettagli: dati emersi dall'assessment, piano di intervento, analisi ROI e metodologia.

Sono disponibile per qualsiasi domanda o per fissare una call di approfondimento.

${FIRMA}`;

    setEmailModal({
      to: client.contact_email || '',
      subject: `Proposta ES Work — ${client.name}`,
      body,
    });
  }

  const semaphoreData = [
    { type: 'nmq', score: nmq.level1.pct, value: `${nmq.level1.pct}%`, label: 'Livello 1', sub: 'Trattamento' },
    { type: 'plain', score: nmq.level2.pct, value: `${nmq.level2.pct}%`, label: 'Livello 2', sub: 'Monitoraggio', color: 'yellow' },
    { type: 'plain', score: nmq.level3.pct, value: `${nmq.level3.pct}%`, label: 'Livello 3', sub: 'Formazione', color: 'green' },
  ];

  return (
    <>
      <Head>
        <title>Offerta ES Work — {client.name}</title>
      </Head>

      <style>{`
        @page { size: A4; margin: 1.2cm 1.5cm; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          background: #fff;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .offer-page {
          max-width: 720px;
          margin: 0 auto;
          padding: 28px 32px;
        }
        .page-break { page-break-after: always; }
        .page-before { page-break-before: always; break-inside: avoid; page-break-inside: avoid; }
        .page-keep { break-inside: avoid; page-break-inside: avoid; }
        .section-sep {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 20px 0;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
        .section-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #4b5563;
          margin-bottom: 8px;
          margin-top: 16px;
        }
        table.offer-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        table.offer-table td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
        table.offer-table tr.total td { border-top: 2px solid #e5e7eb; font-weight: 700; font-size: 13px; }
      `}</style>

      {/* ── Pulsanti UI (no print) ─────────────────────────────────────── */}
      <div className="no-print max-w-5xl mx-auto px-6 pt-4 pb-2">
        <div className="flex gap-3 flex-wrap mb-2">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 rounded-xl"
          >
            ← Indietro
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1 text-sm text-green-700 border border-green-300 bg-green-50 px-4 py-2 rounded-xl font-semibold"
          >
            🖨 Stampa / Salva PDF
          </button>
          <button
            onClick={openOfferEmail}
            className="flex items-center gap-1 text-sm text-blue-700 border border-blue-300 bg-blue-50 px-4 py-2 rounded-xl font-semibold"
          >
            ✉ Invia offerta via email
          </button>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800">
          <strong>Per un PDF pulito:</strong> nel dialog di stampa Chrome → <em>Altre impostazioni</em> → deseleziona <strong>&quot;Intestazioni e piè di pagina&quot;</strong> → salva come PDF
        </div>

        {/* Confronto con la stima del colloquio — SOLO vista admin, mai nel PDF */}
        {forchetta && calc && (() => {
          const inRange = calc.price_y1 >= forchetta.min && calc.price_y1 <= forchetta.max;
          return (
            <div className={`mt-2 rounded-xl px-4 py-2.5 text-xs border ${inRange ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              📐 <strong>Forchetta colloquio</strong> (scenari min–max, stessi parametri): {fmt(forchetta.min)} – {fmt(forchetta.max)} (medio {fmt(forchetta.avg)}) ·
              <strong> Questo preventivo (dati reali): {fmt(calc.price_y1)}</strong> {inRange
                ? '✓ dentro la forchetta presentata al colloquio'
                : '⚠ FUORI forchetta — rivedi i parametri o prepara la motivazione col cliente'}
            </div>
          );
        })()}
      </div>

      {emailModal && <EmailModal modal={emailModal} onClose={() => setEmailModal(null)} />}

      {/* ══════════════════════════════════════════════════════════════
          PAG 1 — Copertina
          ══════════════════════════════════════════════════════════════ */}
      <Page className="page-break">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 60, paddingBottom: 60 }}>
          <img src="/logo-es.png" alt="Essentia Salutis" style={{ width: 130, height: 130, objectFit: 'contain', marginBottom: 24 }} />
          <div style={{ fontSize: 52, fontWeight: 900, color: '#111827', letterSpacing: -1 }}>
            ES <span style={{ color: '#16a34a' }}>Work</span>
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 5, letterSpacing: 1 }}>by Essentia Salutis</div>
          <div style={{ width: 50, height: 3, background: '#16a34a', margin: '28px auto' }} />
          <div style={{ lineHeight: 1.3, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 400, color: '#6b7280' }}>Report di Attivazione</div>
            <div style={{ fontSize: 14, fontWeight: 300, color: '#9ca3af', marginTop: 2 }}>e</div>
            <div style={{ fontSize: 18, fontWeight: 400, color: '#6b7280', marginTop: 2 }}>proposta di intervento</div>
          </div>
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Azienda cliente</div>
            <div style={{ fontSize: 22, color: '#1e293b', fontWeight: 700 }}>{client.name}</div>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>{date}</div>

          <div style={{ marginTop: 48, width: '100%', maxWidth: 480, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: '16px 24px', textAlign: 'left' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>Contenuto del documento</div>
            {['Cruscotto sintetico e dati emersi dall\'assessment', 'Disturbi muscolo-scheletrici — mappa corporea e stratificazione', 'Piano di intervento proposto', 'Investimento e analisi costi', 'Metodologia e timeline anno 1'].map((v, i, arr) => (
              <div key={i} style={{ fontSize: 12, color: '#374151', paddingTop: 5, paddingBottom: 5, borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>{i + 1}.</span> {v}
              </div>
            ))}
          </div>
        </div>
      </Page>

      {/* ══════════════════════════════════════════════════════════════
          PAG 2 — Cruscotto + Disturbi MSK (flusso continuo, niente interruzioni forzate)
          ══════════════════════════════════════════════════════════════ */}
      <Page>
        {/* — Cruscotto — */}
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 2 }}>Cruscotto sintetico</div>
        <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 14 }}>{client.name} · {TYPE_LABELS[assessment.type]} · {assessment.n} risposte</div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${semaphoreData.length}, 1fr)`, gap: 10, marginBottom: 14 }}>
          {semaphoreData.map((s, i) => {
            const color = s.color || trafficLight(s.type, s.score);
            return (
              <div key={i} style={{ background: TL_BG[color], border: `1px solid ${TL_BORDER[color]}`, borderRadius: 14, padding: 12, textAlign: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: TL_COLOR[color], margin: '0 auto 6px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />
                <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: TL_COLOR[color] }}>{s.value}</div>
                {s.sub && <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>{s.sub}</div>}
              </div>
            );
          })}
        </div>

        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 6 }}>Sintesi</div>
          <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.7, margin: 0 }}>{summaryText}</p>
        </div>

        {/* AI branding box */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '8px 12px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', marginBottom: 1 }}>Tecnologia ES Work AI</div>
            <div style={{ fontSize: 10, color: '#3b82f6', lineHeight: 1.5 }}>
              Piattaforma digitale con intelligenza artificiale per la prevenzione e cura dell'apparato muscolo-scheletrico e la salute dei dipendenti.
              I risultati e il piano di intervento sono elaborati automaticamente dai dati reali della vostra azienda.
            </div>
          </div>
        </div>

        <hr className="section-sep" />

        {/* — Disturbi MSK — */}
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>Disturbi muscolo-scheletrici</div>

        <div>
          {/* zone corporee — barre (sopra) */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>Zone corporee — ultimi 12 mesi</div>
            {nmq.zones.map((z, i) => {
              const c = z.pct12 > 50 ? '#dc2626' : z.pct12 > 30 ? '#ca8a04' : '#16a34a';
              const w = Math.max((z.pct12 / 100) * 100, z.pct12 > 0 ? 5 : 0);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <div style={{ width: 120, fontSize: 10, color: '#374151', textAlign: 'right', flexShrink: 0 }}>{z.zone}</div>
                  <div style={{ flex: 1, height: 16, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    <div style={{ width: `${w}%`, height: '100%', background: c, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 5, minWidth: z.pct12 > 0 ? 28 : 0, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                      {z.pct12 > 0 && <span style={{ color: 'white', fontSize: 9, fontWeight: 600 }}>{z.pct12}%</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 10, color: '#4b5563', marginTop: 8 }}>
              Prevalenza: {nmq.prevalence.pct}% ha almeno un disturbo negli ultimi 12 mesi
            </div>
          </div>

          {/* 3 livelli (sotto le zone corporee) */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>Stratificazione — 3 livelli</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { count: nmq.level1.count, pct: nmq.level1.pct, label: 'Trattamento — Anno 1', sub: 'Impatto funzionale', bg: '#FFEBEE', border: '#E74C3C', color: '#E74C3C' },
                { count: nmq.level2.count, pct: nmq.level2.pct, label: 'Prevenzione — Anno 2', sub: 'Segnali da monitorare', bg: '#FFF8E1', border: '#F39C12', color: '#F39C12' },
                { count: nmq.level3.count, pct: nmq.level3.pct, label: 'Solo formazione', sub: 'Postura ed ergonomia', bg: '#E8F5E9', border: '#16a34a', color: '#16a34a' },
              ].map((l, i) => (
                <div key={i} style={{ background: l.bg, border: `1px solid ${l.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: l.color, lineHeight: 1 }}>{l.count}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: l.color }}>{l.label}</div>
                  <div style={{ fontSize: 10, color: '#4b5563', lineHeight: 1.4 }}>{l.pct}% dipendenti — {l.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Page>

      {/* ══════════════════════════════════════════════════════════════
          Piano di intervento (subito sotto i disturbi, niente interruzione)
          ══════════════════════════════════════════════════════════════ */}
      <Page>
        {/* — Piano di intervento — */}
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Piano di intervento proposto</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />
          <span style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>
            Piano generato da ES Work AI sulla base dei dati specifici della vostra azienda
            {aiSource === 'ai' && <span style={{ marginLeft: 6, color: '#3b82f6', fontWeight: 600 }}>✦ AI</span>}
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 12 }}>
          Zone con prevalenza ≥ 30% — interventi e risultati attesi
        </div>

        {aiPlan === null ? (
          /* Caricamento AI */
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              <span style={{ display: 'inline-block', marginRight: 8 }}>⏳</span>
              Generazione piano AI in corso…
            </div>
          </div>
        ) : (
          <>
            <table className="offer-table">
              <thead>
                <tr style={{ background: '#f9fafb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  <td style={{ fontWeight: 700, color: '#1e293b', width: '28%', fontSize: 11 }}>Criticità emersa</td>
                  <td style={{ fontWeight: 700, color: '#1e293b', width: '46%', fontSize: 11 }}>Intervento proposto</td>
                  <td style={{ fontWeight: 700, color: '#1e293b', width: '26%', fontSize: 11, textAlign: 'right' }}>Risultato atteso</td>
                </tr>
              </thead>
              <tbody>
                {aiPlan.map((row, i) => (
                  <tr key={i}>
                    <td style={{ color: '#dc2626', fontWeight: 600 }}>{row.criticita}</td>
                    <td style={{ color: '#374151' }}>{row.intervento}</td>
                    <td style={{ color: '#16a34a', textAlign: 'right' }}>{row.risultato}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ color: '#374151', fontWeight: 600 }}>100% dipendenti</td>
                  <td style={{ color: '#374151' }}>Formazione collettiva postura ed ergonomia</td>
                  <td style={{ color: '#16a34a', textAlign: 'right' }}>Prevenzione primaria</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <div style={{ marginTop: 12, background: '#f9fafb', borderRadius: 12, padding: 12, fontSize: 11, color: '#374151', lineHeight: 1.7 }}>
          <strong>Nota metodologica:</strong> I dati derivano dall&apos;assessment NMQ completato dai dipendenti.
          Il programma ES Work prevede un approccio integrato: sportello osteopatico individuale + formazione collettiva + monitoraggio continuo.
        </div>
      </Page>

      {/* ══════════════════════════════════════════════════════════════
          Investimento (subito sotto, niente interruzione)
          ══════════════════════════════════════════════════════════════ */}
      {calc && (
        <Page className="page-keep">
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 10 }}>Investimento</div>

          {/* Anno 1 */}
          <div style={{ background: '#16a34a', borderRadius: 14, padding: '12px 18px', color: 'white', marginBottom: 10, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div style={{ fontSize: 9, opacity: 0.9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 1 }}>Anno 1 — Programma completo</div>
            <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.1 }}>{fmt(calc.price_y1)}</div>
            <div style={{ fontSize: 12, opacity: 0.95, marginTop: 1 }}>
              {fmt(calc.price_monthly_y1)}/mese · {fmt(calc.price_per_employee_y1)}/dipendente
            </div>
          </div>

          {/* ── BLOCCO A — Servizi clinici ── */}
          <div style={{ fontSize: 11, fontWeight: 800, color: '#1e293b', marginBottom: 3 }}>Il programma include</div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 3 }}>Servizi clinici</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5, marginBottom: 10 }}>
            <tbody>
              {[
                ['Assessment iniziale + Report di Attivazione', 'Fotografia clinica della salute muscolo-scheletrica dell\'intera popolazione aziendale. Ogni dipendente compila un questionario validato in meno di 5 minuti. Produce la stratificazione dei bisogni e il piano di intervento personalizzato per la vostra azienda.'],
                [`Sportello osteopatico in sede (${calc.days_osteo_y1} gg/anno)`, 'Trattamento osteopatico individuale erogato direttamente nella vostra sede, riservato ai dipendenti con reale indicazione clinica. Ogni percorso è preceduto da una pre-validazione con l\'osteopata e monitorato sessione per sessione con misure di esito oggettive.'],
                ['Pre-validazioni cliniche', 'Valutazione clinica iniziale con l\'osteopata prima di ogni percorso di trattamento: conferma l\'indicazione, definisce gli obiettivi e garantisce che le risorse vadano a chi ne ha realmente bisogno.'],
                ...(withPrevention ? [['Prevenzione attiva L2', 'Sessioni di prevenzione attiva dedicate ai dipendenti con segnali precoci, per intervenire prima che il disturbo evolva in patologia conclamata.']] : []),
                [`Formazione postura ed ergonomia (${calc.training_sessions_y1} sessioni)`, 'Sessioni collettive in piccoli gruppi su postura, ergonomia e prevenzione dei disturbi muscolo-scheletrici, calibrate sul vostro settore. Anno 1: due moduli dedicati (prevenzione attiva). Anni successivi: un modulo avanzato (correlazione con alimentazione, attività motoria e benessere psicofisico).'],
              ].map(([servizio, dettaglio], i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '4px 8px', fontWeight: 600, color: '#1e293b', width: '34%', verticalAlign: 'top' }}>{servizio}</td>
                  <td style={{ padding: '4px 8px', color: '#4b5563', lineHeight: 1.4 }}>{dettaglio}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── BLOCCO B — Servizi di piattaforma e gestione (sfondo distinto) ── */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 12px', marginBottom: 10, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#16a34a', textTransform: 'uppercase', marginBottom: 6 }}>Servizi di piattaforma e gestione</div>
            {mgmtServices.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, padding: '4px 0', borderBottom: i < mgmtServices.length - 1 ? '1px solid #dcfce7' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#1e293b' }}>{s.label}</div>
                  {s.note && <div style={{ fontSize: 9, color: '#4b5563', lineHeight: 1.4, marginTop: 1 }}>{s.note}</div>}
                </div>
                {showMgmtValues && s.value != null && (
                  <div style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap', flexShrink: 0, paddingTop: 1 }}>valore {fmt(s.value)}/anno</div>
                )}
              </div>
            ))}
            {showMgmtValues ? (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '2px solid #16a34a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>Valore dei servizi di piattaforma e gestione</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{fmt(mgmtTotal)}/anno</div>
                </div>
                <div style={{ fontSize: 9.5, color: '#15803d', lineHeight: 1.5, marginTop: 4 }}>
                  Tutte queste voci sono parte integrante del programma e sono <strong>già comprese nell&apos;investimento annuale di {fmt(calc.price_y1)}</strong>: l&apos;azienda riceve questo valore in aggiunta ai servizi clinici, all&apos;interno dello stesso investimento.
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #dcfce7', fontSize: 10, fontWeight: 600, color: '#16a34a' }}>
                Tutti i servizi di piattaforma e gestione sono inclusi nel programma annuale.
              </div>
            )}
          </div>

          {/* Anno 2 — descrizione + cifra (perché quel valore) */}
          <div style={{ background: '#eff6ff', borderRadius: 12, padding: '10px 14px', border: '1px solid #bfdbfe', marginBottom: 10, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <div style={{ fontSize: 9, color: '#2563eb', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Stima Anno 2+</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>{fmt(calc.price_y2)}/anno</div>
            </div>
            <div style={{ fontSize: 9.5, color: '#1e3a8a', lineHeight: 1.5, marginTop: 4 }}>
              Dal secondo anno il programma entra nella fase di <strong>mantenimento e prevenzione</strong>, estesa ai dipendenti di Livello 1 e Livello 2 ({calc.pop_y2} persone): sportello osteopatico per consolidare i risultati, prevenzione attiva, un modulo formativo avanzato, piattaforma con AI, monitoraggio continuo e Report Annuale. L&apos;investimento si riduce rispetto all&apos;Anno 1 perché la fase intensiva iniziale di trattamento è già stata completata: si protegge il risultato raggiunto e si previene la ricaduta.
            </div>
          </div>

          {/* Tempo dipendenti */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: roi ? 10 : 0 }}>
            <div style={{ background: '#fef2f2', borderRadius: 12, padding: '8px 10px', border: '1px solid #fecaca', textAlign: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#dc2626', marginBottom: 2 }}>Dipendente TRATTATO</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#dc2626' }}>{calc.hours_treated}h/anno</div>
              <div style={{ fontSize: 8.5, color: '#4b5563' }}>Trattamento + formazione · meno di 1h/mese</div>
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '8px 10px', border: '1px solid #bbf7d0', textAlign: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#16a34a', marginBottom: 2 }}>Dipendente NON trattato</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{calc.hours_untreated}h/anno</div>
              <div style={{ fontSize: 8.5, color: '#4b5563' }}>Solo formazione collettiva</div>
            </div>
          </div>

          {/* ROI (solo se disponibili i giorni di assenza) */}
          {roi && (
            <div style={{ background: '#fffbeb', borderRadius: 12, padding: '10px 14px', border: '1px solid #fde68a', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <div style={{ fontSize: 9, color: '#ca8a04', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Analisi ROI</div>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 10, color: '#374151' }}>
                <span>Stima costo assenze: <strong>{fmt(roi.estimated_cost)}</strong></span>
                <span>Break-even con riduzione: <strong style={{ color: '#ca8a04' }}>{roi.breakeven_pct}%</strong></span>
                {roi.saving_15pct > 0 && (
                  <span>Risparmio netto (−15% assenze): <strong style={{ color: '#16a34a' }}>{fmt(roi.saving_15pct)}</strong></span>
                )}
              </div>
            </div>
          )}
        </Page>
      )}

      {/* ══════════════════════════════════════════════════════════════
          PAG 5 — Come funziona + Footer (flusso continuo, tenuta insieme)
          ══════════════════════════════════════════════════════════════ */}
      <Page className="page-keep">
        <div>
        {/* — Come funziona — */}
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 14 }}>Come funziona</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            { num: '1', title: 'Misurare', desc: 'Assessment scientifico con analisi AI dei dati — già completato. I risultati in questo report sono generati dalla piattaforma ES Work con intelligenza artificiale.' },
            { num: '2', title: 'Trattare', desc: 'Sportello osteopatico in sede secondo calendario concordato. Accesso prioritario per dipendenti Livello 1.' },
            { num: '3', title: 'Formare', desc: 'Sessioni formative collettive su postura, ergonomia e gestione del rischio muscolo-scheletrico.' },
            { num: '4', title: 'Monitorare', desc: 'Checkpoint a 3 e 6 mesi, report annuale, revisione del piano. Adattamento continuo ai risultati.' },
          ].map(s => (
            <div key={s.num} style={{ background: '#f9fafb', borderRadius: 14, padding: 14, border: '1px solid #e5e7eb', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{s.num}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: 16, marginBottom: 24, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', marginBottom: 10 }}>Timeline Anno 1</div>
          <div style={{ display: 'flex' }}>
            {[
              ['Mese 1-2', 'Assessment + attivazione sportello', '#16a34a'],
              ['Mese 3-4', 'Sessioni intensive + formazione', '#2563eb'],
              ['Mese 5-6', 'Mantenimento + review 6 mesi', '#ca8a04'],
              ['Mese 7-10', 'Mantenimento continuo', '#7c3aed'],
              ['Mese 11-12', 'Assessment finale + report', '#16a34a'],
            ].map(([period, desc, color], i) => (
              <div key={i} style={{ flex: 1, borderLeft: `3px solid ${color}`, paddingLeft: 8, paddingRight: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color, marginBottom: 3 }}>{period}</div>
                <div style={{ fontSize: 9, color: '#374151', lineHeight: 1.4 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* — Accettazione e firma — */}
        <div style={{ marginTop: 24, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>Accettazione offerta</div>
          <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.7, marginBottom: 20 }}>
            Il/La sottoscritto/a dichiara di accettare integralmente la presente proposta di intervento ES Work per <strong>{client.name}</strong>, nei termini e alle condizioni indicate.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>Data e luogo</div>
              <div style={{ borderBottom: '1px solid #d1d5db', height: 28 }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>Per {client.name} — timbro e firma</div>
                <div style={{ borderBottom: '1px solid #d1d5db', height: 44 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>Per Essentia Salutis — Dott. Enrico Maiolo</div>
                <div style={{ borderBottom: '1px solid #d1d5db', height: 44 }} />
              </div>
            </div>
          </div>
        </div>

        <hr className="section-sep" />

        {/* — Footer contatti — */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src="/logo-es.png" alt="Essentia Salutis" style={{ width: 52, height: 52, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#1e293b' }}>Essentia Salutis</div>
              <div style={{ fontSize: 11, color: '#16a34a', letterSpacing: 1, textTransform: 'uppercase' }}>ES Work</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#374151', textAlign: 'right', lineHeight: 1.8 }}>
            {CONFIG.contact_phone && <div>{CONFIG.contact_phone}</div>}
            {CONFIG.contact_email && <div>{CONFIG.contact_email}</div>}
            {CONFIG.contact_website && <div>{CONFIG.contact_website}</div>}
            {CONFIG.company_address && <div>{CONFIG.company_address}</div>}
          </div>
        </div>

        <div style={{ marginTop: 16, background: '#f9fafb', borderRadius: 12, padding: '12px 16px', border: '1px solid #e5e7eb' }}>
          <p style={{ fontSize: 12, color: '#374151', fontStyle: 'italic', textAlign: 'center', margin: 0, lineHeight: 1.7 }}>
            &ldquo;I disturbi muscolo-scheletrici rappresentano il 77% delle malattie professionali in Italia. Noi lavoriamo su questo.&rdquo;
          </p>
        </div>

        <div style={{ marginTop: 12, fontSize: 9, color: '#4b5563', textAlign: 'center' }}>
          © 2026 {CONFIG.company_name} — Documento riservato e confidenziale. Riproduzione vietata senza autorizzazione scritta di Essentia Salutis.
        </div>
        </div>{/* end flex column */}
      </Page>
    </>
  );
}

// Parametri custom dalla scheda colloquio (tier, gruppi, tariffe, IVA) → il PDF
// usa ESATTAMENTE gli stessi numeri della scheda.
function readPricingParams(q) {
  const has = q.rs != null || q.tier || q.groups != null || q.vat != null;
  if (!has) return null;
  return {
    tier: q.tier || undefined,
    groups: q.groups != null ? parseInt(q.groups) : undefined,
    vatExempt: q.vat != null ? q.vat === '1' : undefined,
    rates: q.rs != null ? {
      sportello_sell: +q.rs, sportello_cost: +q.rsc,
      prevalidation_sell: +q.rps, prevalidation_cost: +q.rpc,
      training_sell: +q.rts, training_cost: +q.rtc,
    } : undefined,
  };
}
function syntheticNmq(n, l1, l2) {
  const l3 = Math.max(0, n - l1 - l2);
  const pct = c => (n > 0 ? Math.round((c / n) * 100) : 0);
  const empty = { count: 0, pct: 0 };
  return {
    zones: [],
    level1: { count: l1, pct: pct(l1) },
    level2: { count: l2, pct: pct(l2) },
    level3: { count: l3, pct: pct(l3) },
    prevalence: { count: l1 + l2, pct: pct(l1 + l2) },
    byRole: { production: { n: 0, level1: empty, level2: empty, level3: empty, zones: [] }, office: { n: 0, level1: empty, level2: empty, level3: empty, zones: [] }, unknown: { n: 0, level1: empty, level2: empty, level3: empty, zones: [] } },
    n,
  };
}

export const getServerSideProps = requireAuthSsr(async (ctx) => {
  const q = ctx.query;
  const { assessmentId, clientId, n, l1, l2 } = q;
  const custom = readPricingParams(q);

  // MODALITÀ PREVENTIVO da scheda colloquio: clientId + numeri stimati, nessun assessment
  if (!assessmentId && clientId) {
    try {
      const client = await getClientById(clientId);
      if (!client) return { notFound: true };
      const totalN = n ? parseInt(n) : (client.employees || 0);
      const l1v = l1 != null ? parseInt(l1) : 0;
      const l2v = l2 != null ? parseInt(l2) : 0;
      const calc = custom
        ? calculatePricing({ n: totalN, l1: l1v, l2: l2v, ...custom })
        : calculatePricing(totalN, l1v, l2v);
      return {
        props: {
          client,
          assessment: { type: 'initial', n: totalN, client_id: clientId, estimate: true },
          nmq: syntheticNmq(totalN, l1v, l2v),
          calc,
          roi: null,
          date: today(),
        },
      };
    } catch (e) { console.error(e); return { notFound: true }; }
  }

  if (!assessmentId) {
    return { props: { client: null, assessment: null, nmq: null, calc: null, roi: null, date: today() } };
  }

  try {
    const assessment = await getAssessmentById(assessmentId);
    if (!assessment) return { notFound: true };

    const [client, responses] = await Promise.all([
      getClientById(assessment.client_id),
      getResponsesByAssessment(assessmentId),
    ]);

    const nmq = aggregateNMQ(responses);

    const totalN = n ? parseInt(n) : (client?.employees || responses.length);
    const l1v = l1 !== undefined ? parseInt(l1) : nmq.level1.count;
    const l2v = l2 !== undefined ? parseInt(l2) : nmq.level2.count;

    // ── Parametri salvati dalla scheda colloquio ─────────────────────────────
    // Il preventivo post-assessment usa le STESSE condizioni concordate al
    // colloquio (tier, tariffe, IVA, gruppi) con i numeri REALI dell'assessment.
    // Priorità: override in query > parametri scheda > default di config.
    let schedaDefaults = null;
    let forchetta = null; // stima colloquio min/med/max (vista admin, non nel PDF)
    try {
      const fm = await getFirstMeeting(assessment.client_id);
      const fmd = fm?.data;
      if (fmd) {
        const s2 = fmd.step2 || {};
        const sp = fmd.params || {};
        const sedi = Array.isArray(s2.sedi) ? s2.sedi : [];
        const cap = Math.max(1, parseInt(s2.capienza) || CONFIG.classroom_capacity_default);
        const fmN = sedi.reduce((a, e) => a + (parseInt(e.employees) || 0), 0) || totalN;
        const fmGroups = s2.training_mode === 'accorpa'
          ? Math.max(1, Math.ceil(fmN / cap))
          : (sedi.reduce((a, e) => a + Math.ceil((parseInt(e.employees) || 0) / cap), 0) || Math.max(1, Math.ceil(totalN / cap)));
        schedaDefaults = {
          tier: s2.tier || undefined,
          groups: fmGroups,
          rates: sp.rates || undefined,
          vatExempt: sp.vat_exempt,
        };
        // Forchetta del colloquio: scenari di prevalenza min/med/max con gli stessi parametri
        const sectorKey = fmd.step1?.sector || (client?.sector === 1 ? 'manufacturing' : 'services');
        const prevs = CONFIG.l1_prevalence[sectorKey] || CONFIG.l1_prevalence.mix;
        const l2Mult = sp.l2_mult != null ? Number(sp.l2_mult) : CONFIG.l2_multiplier_default;
        const prices = prevs.map(p => {
          const fl1 = Math.round(fmN * p);
          const c = calculatePricing({ n: fmN, l1: fl1, l2: Math.round(fl1 * l2Mult), ...schedaDefaults });
          return c ? c.price_y1 : null;
        });
        if (prices.every(p => p != null)) forchetta = { min: prices[0], avg: prices[1], max: prices[2] };
      }
    } catch (_) {}

    const effective = custom || schedaDefaults;
    const calc = effective
      ? calculatePricing({ n: totalN, l1: l1v, l2: l2v, ...effective })
      : calculatePricing(totalN, l1v, l2v);
    const roi = null; // ROI only from calculator (requires absence days input)

    return {
      props: {
        client,
        assessment: { ...assessment, n: responses.length },
        nmq,
        calc,
        roi,
        forchetta,
        date: today(),
      },
    };
  } catch (e) {
    console.error(e);
    return { notFound: true };
  }
});
