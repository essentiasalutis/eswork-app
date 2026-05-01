import { useState } from 'react';
import Head from 'next/head';
import { requireAuthSsr } from '../../lib/auth';
import { getAssessmentById, getClientById, getResponsesByAssessment } from '../../lib/store';
import {
  aggregateNMQ, aggregatePSS, aggregateUWES, aggregateENPS,
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

function generateInterventionPlan(nmq) {
  const MAP = {
    'Collo': 'Sportello osteopatico — protocollo cervicale + ergonomia postazione',
    'Spalle': 'Sportello osteopatico — protocollo spalle + formazione postura',
    'Schiena alta (dorsale)': 'Sportello osteopatico — rachide dorsale + ergonomia workstation',
    'Schiena bassa (lombare)': 'Sportello osteopatico — lombare + formazione movimentazione carichi',
    'Gomiti': 'Sportello osteopatico — arto superiore + analisi postura',
    'Polsi / Mani': 'Sportello osteopatico — polso/mano + ergonomia strumenti',
    'Anche / Cosce': 'Sportello osteopatico — arto inferiore + formazione stazione eretta',
    'Ginocchia': 'Sportello osteopatico — protocollo ginocchio + analisi del passo',
    'Caviglie / Piedi': 'Sportello osteopatico — arto inferiore distale + calzature professionali',
  };
  return nmq.zones
    .filter(z => z.pct12 > 40)
    .map(z => ({
      issue: `${z.pct12}% disturbi ${z.zone.toLowerCase()}`,
      intervention: MAP[z.zone] || 'Sportello osteopatico + formazione specifica',
      result: 'Riduzione dolore 20-30% in 12 mesi',
    }));
}

// ─── Print page wrapper ───────────────────────────────────────────────────────

function Page({ children, className = '' }) {
  return (
    <div className={`offer-page${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}

// ─── Offer Document ───────────────────────────────────────────────────────────

export default function OfferPage({ client, assessment, nmq, pss, uwes, enps, calc, roi, date }) {
  const [emailModal, setEmailModal] = useState(null);

  if (!client || !assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Dati non disponibili. Torna alla dashboard.
      </div>
    );
  }

  const interventions = generateInterventionPlan(nmq);
  const summaryText = generateSummaryText(nmq, pss, uwes, enps);

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
    { type: 'nmq', score: nmq.level1.pct, value: `${nmq.level1.pct}%`, label: 'Salute fisica', sub: 'Livello 1' },
    ...(pss ? [{ type: 'pss', score: pss.mean, value: pss.mean, label: 'Stress PSS-10', sub: 'score medio' }] : []),
    { type: 'uwes', score: uwes.mean, value: uwes.mean, label: 'Engagement', sub: 'UWES-9 medio' },
    { type: 'enps', score: enps.score, value: `${enps.score > 0 ? '+' : ''}${enps.score}`, label: 'Clima (eNPS)', sub: '' },
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
      <div className="no-print max-w-3xl mx-auto px-4 pt-4 pb-2">
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
      </div>
      </div>

      {emailModal && <EmailModal modal={emailModal} onClose={() => setEmailModal(null)} />}

      {/* ══════════════════════════════════════════════════════════════
          PAG 1 — Copertina
          ══════════════════════════════════════════════════════════════ */}
      <Page className="page-break">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 60, paddingBottom: 60 }}>
          <img src="/logo-es.png" alt="Essentia Salutis" style={{ width: 100, height: 100, objectFit: 'contain', marginBottom: 20 }} />
          <div style={{ fontSize: 40, fontWeight: 900, color: '#111827', letterSpacing: -1 }}>
            ES <span style={{ color: '#16a34a' }}>Work</span>
          </div>
          <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4, letterSpacing: 1 }}>by Essentia Salutis</div>
          <div style={{ width: 50, height: 3, background: '#16a34a', margin: '24px auto' }} />
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', maxWidth: 400 }}>
            Report di Attivazione e proposta di intervento
          </div>
          <div style={{ fontSize: 16, color: '#1e293b', marginTop: 18, fontWeight: 600 }}>{client.name}</div>
          <div style={{ fontSize: 13, color: '#4b5563', marginTop: 6 }}>{date}</div>

          <div style={{ marginTop: 48, width: '100%', maxWidth: 480, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: '16px 24px', textAlign: 'left' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>Contenuto del documento</div>
            {['Cruscotto sintetico e dati emersi dall\'assessment', 'Disturbi muscolo-scheletrici — mappa corporea e stratificazione', 'Engagement e clima aziendale (UWES-9, eNPS)', 'Piano di intervento proposto', 'Investimento e analisi costi', 'Metodologia e timeline anno 1'].map((v, i) => (
              <div key={i} style={{ fontSize: 12, color: '#374151', paddingTop: 5, paddingBottom: 5, borderBottom: i < 5 ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>{i + 1}.</span> {v}
              </div>
            ))}
          </div>
        </div>
      </Page>

      {/* ══════════════════════════════════════════════════════════════
          PAG 2 — Cruscotto + Disturbi MSK
          ══════════════════════════════════════════════════════════════ */}
      <Page className="page-break">
        {/* — Cruscotto — */}
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 2 }}>Cruscotto sintetico</div>
        <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 14 }}>{client.name} · {TYPE_LABELS[assessment.type]} · {assessment.n} risposte</div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${semaphoreData.length}, 1fr)`, gap: 10, marginBottom: 14 }}>
          {semaphoreData.map((s, i) => {
            const color = trafficLight(s.type, s.score);
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

        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 6 }}>Sintesi</div>
          <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.7, margin: 0 }}>{summaryText}</p>
        </div>

        <hr className="section-sep" />

        {/* — Disturbi MSK — */}
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>Disturbi muscolo-scheletrici</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          {/* colonna sinistra: barre */}
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

          {/* colonna destra: 3 livelli */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>Stratificazione — 3 livelli</div>
            {[
              { count: nmq.level1.count, pct: nmq.level1.pct, label: 'Trattamento — Anno 1', sub: 'Impatto funzionale', bg: '#FFEBEE', border: '#E74C3C', color: '#E74C3C' },
              { count: nmq.level2.count, pct: nmq.level2.pct, label: 'Prevenzione — Anno 2', sub: 'Segnali da monitorare', bg: '#FFF8E1', border: '#F39C12', color: '#F39C12' },
              { count: nmq.level3.count, pct: nmq.level3.pct, label: 'Solo formazione', sub: 'Postura ed ergonomia', bg: '#E8F5E9', border: '#16a34a', color: '#16a34a' },
            ].map((l, i) => (
              <div key={i} style={{ background: l.bg, border: `1px solid ${l.border}`, borderRadius: 12, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: l.color, minWidth: 32, textAlign: 'center' }}>{l.count}</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: l.color }}>{l.label}</div>
                  <div style={{ fontSize: 10, color: '#4b5563' }}>{l.pct}% dipendenti — {l.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Page>

      {/* ══════════════════════════════════════════════════════════════
          PAG 3 — Engagement + Piano di intervento
          ══════════════════════════════════════════════════════════════ */}
      <Page className="page-break">
        {/* — Engagement — */}
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>Engagement e clima aziendale</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          {/* UWES */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>UWES-9 — Engagement lavorativo</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              {[
                { l: 'Vigore', v: uwes.vigore },
                { l: 'Dedizione', v: uwes.dedizione },
                { l: 'Assorbimento', v: uwes.assorbimento },
              ].map(d => (
                <div key={d.l} style={{ textAlign: 'center', background: '#eff6ff', borderRadius: 12, padding: '10px 8px', border: '1px solid #bfdbfe', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  <div style={{ fontSize: 10, color: '#374151' }}>{d.l}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb' }}>{d.v}</div>
                  <div style={{ height: 4, background: '#dbeafe', borderRadius: 2, marginTop: 6, overflow: 'hidden', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    <div style={{ width: `${(d.v / 6) * 100}%`, height: '100%', background: '#2563eb', borderRadius: 2, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', fontSize: 12, color: '#374151' }}>
              Score globale: <strong style={{ color: '#2563eb', fontSize: 15 }}>{uwes.mean}</strong> / 6
            </div>
            {pss && (
              <div style={{ marginTop: 12, background: '#f9fafb', borderRadius: 12, padding: 12, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>PSS-10 — Stress percepito</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { val: pss.low, label: 'Basso', sub: '≤13', bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' },
                    { val: pss.mod, label: 'Moderato', sub: '14–26', bg: '#fefce8', border: '#fde68a', color: '#ca8a04' },
                    { val: pss.high, label: 'Elevato', sub: '≥27', bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
                  ].map((b, i) => (
                    <div key={i} style={{ flex: 1, background: b.bg, border: `1px solid ${b.border}`, borderRadius: 10, padding: '8px 4px', textAlign: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: b.color }}>{b.val}%</div>
                      <div style={{ fontSize: 10, color: b.color }}>{b.label}</div>
                      <div style={{ fontSize: 9, color: '#4b5563' }}>{b.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#374151', marginTop: 8, textAlign: 'center' }}>Score medio: <strong>{pss.mean}</strong> / 40</div>
              </div>
            )}
          </div>

          {/* eNPS */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>eNPS — Clima aziendale</div>
            <div style={{ textAlign: 'center', fontSize: 44, fontWeight: 900, color: enps.score >= 20 ? '#16a34a' : enps.score >= 0 ? '#ca8a04' : '#dc2626', marginBottom: 12 }}>
              {enps.score > 0 ? '+' : ''}{enps.score}
            </div>
            <div style={{ display: 'flex', height: 24, borderRadius: 999, overflow: 'hidden', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              {enps.promoters > 0 && <div style={{ width: `${enps.promoters}%`, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 600, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{enps.promoters}%</div>}
              {enps.passives > 0 && <div style={{ width: `${enps.passives}%`, background: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 600, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{enps.passives}%</div>}
              {enps.detractors > 0 && <div style={{ width: `${enps.detractors}%`, background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 600, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{enps.detractors}%</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#374151', marginTop: 4 }}>
              <span>Promotori (9-10)</span><span>Passivi (7-8)</span><span>Detrattori (0-6)</span>
            </div>
          </div>
        </div>

        <hr className="section-sep" />

        {/* — Piano di intervento — */}
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Piano di intervento proposto</div>
        <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 12 }}>Zone con prevalenza &gt; 40% — interventi e risultati attesi</div>

        {interventions.length > 0 ? (
          <table className="offer-table">
            <thead>
              <tr style={{ background: '#f9fafb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <td style={{ fontWeight: 700, color: '#1e293b', width: '28%', fontSize: 11 }}>Criticità emersa</td>
                <td style={{ fontWeight: 700, color: '#1e293b', width: '46%', fontSize: 11 }}>Intervento proposto</td>
                <td style={{ fontWeight: 700, color: '#1e293b', width: '26%', fontSize: 11, textAlign: 'right' }}>Risultato atteso</td>
              </tr>
            </thead>
            <tbody>
              {interventions.map((row, i) => (
                <tr key={i}>
                  <td style={{ color: '#dc2626', fontWeight: 600 }}>{row.issue}</td>
                  <td style={{ color: '#374151' }}>{row.intervention}</td>
                  <td style={{ color: '#16a34a', textAlign: 'right' }}>{row.result}</td>
                </tr>
              ))}
              <tr>
                <td style={{ color: '#374151', fontWeight: 600 }}>100% dipendenti</td>
                <td style={{ color: '#374151' }}>Formazione collettiva postura ed ergonomia</td>
                <td style={{ color: '#16a34a', textAlign: 'right' }}>Prevenzione primaria</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16, textAlign: 'center', color: '#16a34a', fontSize: 12 }}>
            Nessuna zona critica (&gt;40%). Si raccomanda formazione preventiva e monitoraggio.
          </div>
        )}

        <div style={{ marginTop: 12, background: '#f9fafb', borderRadius: 12, padding: 12, fontSize: 11, color: '#374151', lineHeight: 1.7 }}>
          <strong>Nota metodologica:</strong> I dati derivano dall&apos;assessment NMQ completato dai dipendenti.
          Il programma ES Work prevede un approccio integrato: sportello osteopatico individuale + formazione collettiva + monitoraggio continuo.
        </div>
      </Page>

      {/* ══════════════════════════════════════════════════════════════
          PAG 4 — Investimento
          ══════════════════════════════════════════════════════════════ */}
      {calc && (
        <Page className="page-break">
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 16 }}>Investimento</div>

          {/* Anno 1 */}
          <div style={{ background: '#16a34a', borderRadius: 18, padding: '18px 24px', color: 'white', marginBottom: 14, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div style={{ fontSize: 10, opacity: 0.9, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>Anno 1 — Programma completo</div>
            <div style={{ fontSize: 40, fontWeight: 900 }}>{fmt(calc.price_y1)}</div>
            <div style={{ fontSize: 13, opacity: 0.95, marginTop: 2 }}>
              {fmt(calc.price_monthly_y1)}/mese · {fmt(calc.price_per_employee_y1)}/dipendente
            </div>
          </div>

          {/* Tabella servizi */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>Il programma include</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 14 }}>
            <tbody>
              {[
                ['Assessment iniziale + Report di Attivazione', 'Check-up completo della salute muscolo-scheletrica con strumenti validati'],
                [`Sportello osteopatico in sede (${calc.days_osteo_y1} gg/anno)`, 'Trattamento individuale in sede per i dipendenti con disturbi'],
                [`Formazione postura ed ergonomia (${calc.training_sessions_y1} sessioni)`, 'Sessioni collettive teoria + pratica per tutti i dipendenti'],
                ['2 Review intermedie (3 e 6 mesi)', 'Assessment di monitoraggio + report alla direzione con KPI aggiornati'],
                ['Assessment finale + Report annuale', 'Confronto baseline vs risultati, documentazione per OT23 INAIL'],
                ['Coordinamento e regia ES Work', 'Un unico interlocutore: professionisti, calendario, logistica, report'],
                ['Documentazione OT23 INAIL', 'Documentazione per la riduzione del premio assicurativo INAIL'],
              ].map(([servizio, dettaglio], i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '7px 10px', fontWeight: 600, color: '#1e293b', width: '40%' }}>{servizio}</td>
                  <td style={{ padding: '7px 10px', color: '#4b5563' }}>{dettaglio}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {/* Anno 2 */}
            <div style={{ background: '#eff6ff', borderRadius: 14, padding: 14, border: '1px solid #bfdbfe', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <div style={{ fontSize: 10, color: '#2563eb', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Stima Anno 2+</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1d4ed8' }}>{fmt(calc.price_y2)}</div>
              <div style={{ fontSize: 11, color: '#2563eb' }}>Estensione a {calc.pop_y2} dip. (mantenimento + prevenzione)</div>
            </div>
            {/* ROI */}
            {roi ? (
              <div style={{ background: '#fffbeb', borderRadius: 14, padding: 14, border: '1px solid #fde68a', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <div style={{ fontSize: 10, color: '#ca8a04', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Analisi ROI</div>
                <div style={{ fontSize: 11, color: '#374151' }}>Stima costo assenze: <strong>{fmt(roi.estimated_cost)}</strong></div>
                <div style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>Break-even con riduzione: <strong style={{ color: '#ca8a04' }}>{roi.breakeven_pct}%</strong></div>
                {roi.saving_15pct > 0 && (
                  <div style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>Risparmio netto (−15% assenze): <strong style={{ color: '#16a34a' }}>{fmt(roi.saving_15pct)}</strong></div>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: '#fef2f2', borderRadius: 12, padding: 12, border: '1px solid #fecaca', textAlign: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>Dip. TRATTATO</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{calc.hours_treated}h/anno</div>
                  <div style={{ fontSize: 9, color: '#4b5563', marginTop: 2 }}>Tratt. + formazione</div>
                </div>
                <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 12, border: '1px solid #bbf7d0', textAlign: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>Dip. NON trattato</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{calc.hours_untreated}h/anno</div>
                  <div style={{ fontSize: 9, color: '#4b5563', marginTop: 2 }}>Solo formazione</div>
                </div>
              </div>
            )}
          </div>

          {/* Tempo dipendenti (se ROI presente, mostralo in riga separata) */}
          {roi && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: '#fef2f2', borderRadius: 12, padding: 12, border: '1px solid #fecaca', textAlign: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>Dipendente TRATTATO</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>{calc.hours_treated}h/anno</div>
                <div style={{ fontSize: 9, color: '#4b5563' }}>Trattamento + formazione · meno di 1h/mese</div>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 12, border: '1px solid #bbf7d0', textAlign: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>Dipendente NON trattato</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>{calc.hours_untreated}h/anno</div>
                <div style={{ fontSize: 9, color: '#4b5563' }}>Solo formazione collettiva</div>
              </div>
            </div>
          )}
        </Page>
      )}

      {/* ══════════════════════════════════════════════════════════════
          PAG 5 — Come funziona + Footer
          ══════════════════════════════════════════════════════════════ */}
      <Page>
        {/* — Come funziona — */}
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 14 }}>Come funziona</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            { num: '1', title: 'Misurare', desc: 'Assessment NMQ + PSS + UWES + eNPS — già completato. I dati in questo report ne sono il risultato.' },
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
      </Page>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => {
  const { assessmentId, n, l1, l2 } = ctx.query;

  if (!assessmentId) {
    return { props: { client: null, assessment: null, nmq: null, pss: null, uwes: null, enps: null, calc: null, roi: null, date: today() } };
  }

  try {
    const assessment = await getAssessmentById(assessmentId);
    if (!assessment) return { notFound: true };

    const [client, responses] = await Promise.all([
      getClientById(assessment.client_id),
      getResponsesByAssessment(assessmentId),
    ]);

    const nmq = aggregateNMQ(responses);
    const pss = assessment.include_pss ? aggregatePSS(responses) : null;
    const uwes = aggregateUWES(responses);
    const enps = aggregateENPS(responses);

    const totalN = n ? parseInt(n) : (client?.employees || responses.length);
    const l1v = l1 !== undefined ? parseInt(l1) : nmq.level1.count;
    const l2v = l2 !== undefined ? parseInt(l2) : nmq.level2.count;

    const calc = calculatePricing(totalN, l1v, l2v);
    const roi = null; // ROI only from calculator (requires absence days input)

    return {
      props: {
        client,
        assessment: { ...assessment, n: responses.length },
        nmq, pss, uwes, enps,
        calc,
        roi,
        date: today(),
      },
    };
  } catch (e) {
    console.error(e);
    return { notFound: true };
  }
});
