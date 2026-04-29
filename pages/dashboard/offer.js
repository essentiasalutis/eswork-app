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
    <div className={`offer-page ${className}`}>
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
        @page { margin: 18mm 15mm; }
        body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
        .offer-page {
          max-width: 720px;
          margin: 0 auto;
          padding: 40px 32px;
          border-bottom: 1px solid #e5e7eb;
          page-break-after: always;
        }
        .offer-page:last-child { border-bottom: none; page-break-after: auto; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .offer-page { border-bottom: none; padding: 0; }
        }
        .section-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 8px;
          margin-top: 20px;
        }
        table.offer-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        table.offer-table td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; }
        table.offer-table td:last-child { text-align: right; font-weight: 600; }
        table.offer-table tr.total td { border-top: 2px solid #e5e7eb; font-weight: 700; font-size: 14px; }
      `}</style>

      {/* ── Pulsanti UI (no print) ─────────────────────────────────────── */}
      <div className="no-print flex gap-3 max-w-3xl mx-auto px-4 pt-4 pb-2 flex-wrap">
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
          Stampa / Salva PDF
        </button>
        <button
          onClick={openOfferEmail}
          className="flex items-center gap-1 text-sm text-blue-700 border border-blue-300 bg-blue-50 px-4 py-2 rounded-xl font-semibold"
        >
          ✉ Invia offerta via email
        </button>
      </div>

      {emailModal && <EmailModal modal={emailModal} onClose={() => setEmailModal(null)} />}

      {/* ── PAG 1: Copertina ───────────────────────────────────────────── */}
      <Page>
        <div style={{ minHeight: 600, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', paddingTop: 40 }}>
          <img src="/logo-es.png" alt="Essentia Salutis" style={{ width: 120, height: 120, objectFit: 'contain', marginBottom: 24 }} />
          <div style={{ fontSize: 42, fontWeight: 900, color: '#111827', letterSpacing: -1 }}>
            ES <span style={{ color: '#16a34a' }}>Work</span>
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6, letterSpacing: 1 }}>by Essentia Salutis</div>
          <div style={{ width: 60, height: 3, background: '#16a34a', margin: '28px auto' }} />
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', maxWidth: 400 }}>
            Report di Attivazione e proposta di intervento
          </div>
          <div style={{ fontSize: 16, color: '#374151', marginTop: 20, fontWeight: 600 }}>{client.name}</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>{date}</div>
        </div>
      </Page>

      {/* ── PAG 2: Cruscotto ──────────────────────────────────────────── */}
      <Page>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Cruscotto sintetico</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>{client.name} · {TYPE_LABELS[assessment.type]} · {assessment.n} risposte</div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${semaphoreData.length}, 1fr)`, gap: 12, marginBottom: 24 }}>
          {semaphoreData.map((s, i) => {
            const color = trafficLight(s.type, s.score);
            return (
              <div key={i} style={{ background: TL_BG[color], border: `1px solid ${TL_BORDER[color]}`, borderRadius: 16, padding: 16, textAlign: 'center' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: TL_COLOR[color], margin: '0 auto 8px', boxShadow: `0 0 8px ${TL_COLOR[color]}80` }} />
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: TL_COLOR[color] }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{s.sub}</div>
              </div>
            );
          })}
        </div>

        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}>
          <div className="section-label" style={{ marginTop: 0 }}>Sintesi</div>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: 0 }}>{summaryText}</p>
        </div>
      </Page>

      {/* ── PAG 3: Mappa corporea + 3 livelli ─────────────────────────── */}
      <Page>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Disturbi muscolo-scheletrici</div>

        <div className="section-label" style={{ marginTop: 0 }}>Zone corporee — ultimi 12 mesi</div>
        {nmq.zones.map((z, i) => {
          const c = z.pct12 > 50 ? '#dc2626' : z.pct12 > 30 ? '#ca8a04' : '#16a34a';
          const w = Math.max((z.pct12 / 100) * 100, z.pct12 > 0 ? 5 : 0);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 140, fontSize: 11, color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>{z.zone}</div>
              <div style={{ flex: 1, height: 18, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${w}%`, height: '100%', background: c, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6, minWidth: z.pct12 > 0 ? 30 : 0 }}>
                  {z.pct12 > 0 && <span style={{ color: 'white', fontSize: 10, fontWeight: 600 }}>{z.pct12}%</span>}
                </div>
              </div>
            </div>
          );
        })}

        <div className="section-label">Stratificazione — 3 livelli</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { count: nmq.level1.count, pct: nmq.level1.pct, label: 'Trattamento — Anno 1', sub: 'Impatto funzionale', bg: '#FFEBEE', border: '#E74C3C', color: '#E74C3C' },
            { count: nmq.level2.count, pct: nmq.level2.pct, label: 'Prevenzione — Anno 2', sub: 'Segnali da monitorare', bg: '#FFF8E1', border: '#F39C12', color: '#F39C12' },
            { count: nmq.level3.count, pct: nmq.level3.pct, label: 'Solo formazione', sub: 'Postura ed ergonomia', bg: '#E8F5E9', border: '#16a34a', color: '#16a34a' },
          ].map((l, i) => (
            <div key={i} style={{ background: l.bg, border: `1px solid ${l.border}`, borderRadius: 14, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: l.color }}>{l.count}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>dip. ({l.pct}%)</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: l.color, marginTop: 8 }}>{l.label}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{l.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 10 }}>
          Prevalenza generica: {nmq.prevalence.pct}% ha riportato almeno un fastidio negli ultimi 12 mesi (dato informativo)
        </div>
      </Page>

      {/* ── PAG 4: Stress (se PSS) ────────────────────────────────────── */}
      {pss && (
        <Page>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Stress percepito (PSS-10)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            {[
              { val: pss.low, label: 'Stress basso', sub: '≤ 13', bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' },
              { val: pss.mod, label: 'Moderato', sub: '14–26', bg: '#fefce8', border: '#fde68a', color: '#ca8a04' },
              { val: pss.high, label: 'Stress elevato', sub: '≥ 27', bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
            ].map((b, i) => (
              <div key={i} style={{ background: b.bg, border: `1px solid ${b.border}`, borderRadius: 16, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: b.color }}>{b.val}%</div>
                <div style={{ fontSize: 12, color: b.color, marginTop: 4 }}>{b.label}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{b.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 14, padding: 16, fontSize: 13, color: '#374151' }}>
            Score medio PSS-10: <strong style={{ fontSize: 18, color: trafficLight('pss', pss.mean) === 'red' ? '#dc2626' : trafficLight('pss', pss.mean) === 'yellow' ? '#ca8a04' : '#16a34a' }}>{pss.mean}</strong> / 40
          </div>
        </Page>
      )}

      {/* ── PAG 5: Engagement + eNPS ──────────────────────────────────── */}
      <Page>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Engagement e clima aziendale</div>

        <div className="section-label" style={{ marginTop: 0 }}>UWES-9 — Engagement lavorativo</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 8 }}>
          {[
            { l: 'Vigore', v: uwes.vigore },
            { l: 'Dedizione', v: uwes.dedizione },
            { l: 'Assorbimento', v: uwes.assorbimento },
          ].map(d => (
            <div key={d.l} style={{ textAlign: 'center', background: '#eff6ff', borderRadius: 14, padding: 16, border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{d.l}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#2563eb' }}>{d.v}</div>
              <div style={{ height: 6, background: '#dbeafe', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${(d.v / 6) * 100}%`, height: '100%', background: '#2563eb', borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
          Score globale: <strong style={{ color: '#2563eb', fontSize: 16 }}>{uwes.mean}</strong> / 6
        </div>

        <div className="section-label">eNPS — Clima aziendale</div>
        <div style={{ textAlign: 'center', fontSize: 48, fontWeight: 900, color: enps.score >= 20 ? '#16a34a' : enps.score >= 0 ? '#ca8a04' : '#dc2626', marginBottom: 16 }}>
          {enps.score > 0 ? '+' : ''}{enps.score}
        </div>
        <div style={{ display: 'flex', height: 28, borderRadius: 999, overflow: 'hidden' }}>
          {enps.promoters > 0 && <div style={{ width: `${enps.promoters}%`, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 600 }}>{enps.promoters}%</div>}
          {enps.passives > 0 && <div style={{ width: `${enps.passives}%`, background: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 600 }}>{enps.passives}%</div>}
          {enps.detractors > 0 && <div style={{ width: `${enps.detractors}%`, background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 600 }}>{enps.detractors}%</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
          <span>Promotori (9-10)</span><span>Passivi (7-8)</span><span>Detrattori (0-6)</span>
        </div>
      </Page>

      {/* ── PAG 6: Dati per ruolo (se disponibili) ────────────────────── */}
      {nmq.byRole.production.n >= 10 && nmq.byRole.office.n >= 10 && (
        <Page>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Analisi per tipologia di lavoro</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: 'In produzione', data: nmq.byRole.production },
              { label: 'In ufficio', data: nmq.byRole.office },
            ].map(({ label, data }) => (
              <div key={label} style={{ background: '#f9fafb', borderRadius: 16, padding: 16, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
                  {label} <span style={{ fontWeight: 400, color: '#9ca3af' }}>({data.n} risp.)</span>
                </div>
                {data.zones.slice(0, 5).map((z, i) => {
                  const c = z.pct12 > 50 ? '#dc2626' : z.pct12 > 30 ? '#ca8a04' : '#16a34a';
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <div style={{ width: 110, fontSize: 10, color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>{z.zone}</div>
                      <div style={{ flex: 1, height: 12, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${z.pct12}%`, height: '100%', background: c, borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7280', width: 28, flexShrink: 0 }}>{z.pct12}%</div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 12 }}>
                  <span style={{ color: '#E74C3C', fontWeight: 700 }}>L1: {data.level1.count}</span>
                  <span style={{ color: '#9ca3af', marginLeft: 4 }}>({data.level1.pct}%)</span>
                </div>
              </div>
            ))}
          </div>
        </Page>
      )}

      {/* ── PAG 7: Piano di intervento ────────────────────────────────── */}
      <Page>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>Piano di intervento proposto</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
          Criticità emerse dall&apos;assessment (zone con prevalenza &gt; 40%)
        </div>
        {interventions.length > 0 ? (
          <table className="offer-table">
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <td style={{ fontWeight: 700, color: '#374151', width: '30%' }}>Criticità emersa</td>
                <td style={{ fontWeight: 700, color: '#374151', width: '45%' }}>Intervento proposto</td>
                <td style={{ fontWeight: 700, color: '#374151', width: '25%', textAlign: 'right' }}>Risultato atteso</td>
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
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: 20, textAlign: 'center', color: '#16a34a' }}>
            Nessuna zona critica (&gt;40%). Si raccomanda formazione preventiva e monitoraggio.
          </div>
        )}

        <div style={{ marginTop: 20, background: '#f9fafb', borderRadius: 14, padding: 16, fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
          <strong>Nota metodologica:</strong> I dati sopra derivano dall&apos;assessment NMQ completato dai dipendenti.
          Il programma ES Work prevede un approccio integrato: sportello osteopatico individuale + formazione collettiva + monitoraggio continuo.
        </div>
      </Page>

      {/* ── PAG 8: Investimento ───────────────────────────────────────── */}
      {calc && (
        <Page>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Investimento</div>

          {/* Anno 1 */}
          <div style={{ background: '#16a34a', borderRadius: 20, padding: 24, color: 'white', marginBottom: 16 }}>
            <div style={{ fontSize: 11, opacity: 0.8, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Anno 1 — Programma completo</div>
            <div style={{ fontSize: 44, fontWeight: 900 }}>{fmt(calc.price_y1)}</div>
            <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
              {fmt(calc.price_monthly_y1)}/mese · {fmt(calc.price_per_employee_y1)}/dipendente
            </div>
          </div>

          {/* Mod 10: tabella servizi con descrizione, niente spaccato costi */}
          <div className="section-label">Il programma include</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
            <tbody>
              {[
                ['Assessment iniziale + Report di Attivazione', 'Check-up completo della salute muscolo-scheletrica con strumenti scientifici validati'],
                [`Sportello osteopatico in sede (${calc.days_osteo_y1} gg/anno)`, 'Trattamento individuale in sede per i dipendenti con disturbi'],
                [`Formazione postura ed ergonomia (${calc.training_sessions_y1} sessioni)`, 'Sessioni collettive teoria + pratica per tutti i dipendenti'],
                ['2 Review intermedie (3 e 6 mesi)', 'Assessment di monitoraggio + report alla direzione con aggiornamento KPI'],
                ['Assessment finale + Report annuale', 'Confronto completo baseline vs risultati, documentazione per OT23 INAIL'],
                ['Coordinamento e regia ES Work', 'Un unico interlocutore per tutto: professionisti, calendario, logistica, report'],
                ['Documentazione OT23 INAIL', 'Documentazione per la richiesta di riduzione del premio assicurativo INAIL'],
              ].map(([servizio, dettaglio], i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1e293b', width: '40%' }}>{servizio}</td>
                  <td style={{ padding: '8px 10px', color: '#6b7280', fontSize: 11 }}>{dettaglio}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Anno 2 */}
          <div style={{ background: '#eff6ff', borderRadius: 16, padding: 16, border: '1px solid #bfdbfe', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#2563eb', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Stima Anno 2+</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1d4ed8' }}>{fmt(calc.price_y2)}</div>
            <div style={{ fontSize: 12, color: '#2563eb' }}>Estensione a {calc.pop_y2} dip. (mantenimento + prevenzione)</div>
          </div>

          {/* Tempo — Mod 11: titoli aggiornati */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ background: '#fef2f2', borderRadius: 12, padding: 14, border: '1px solid #fecaca', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Tempo per dipendente TRATTATO</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{calc.hours_treated}h/anno</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Trattamento individuale + formazione</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>meno di 1 ora al mese</div>
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 14, border: '1px solid #bbf7d0', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 6 }}>Tempo per dipendente NON trattato</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>{calc.hours_untreated}h/anno</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Solo formazione collettiva</div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>postura ed ergonomia</div>
            </div>
          </div>

          {/* ROI */}
          {roi && (
            <div style={{ background: '#fffbeb', borderRadius: 14, padding: 14, border: '1px solid #fde68a' }}>
              <div style={{ fontSize: 11, color: '#ca8a04', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Analisi ROI</div>
              <div style={{ fontSize: 13, color: '#374151' }}>Stima costo assenze: <strong>{fmt(roi.estimated_cost)}</strong></div>
              <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>Riduzione necessaria per break-even: <strong style={{ color: '#ca8a04' }}>{roi.breakeven_pct}%</strong></div>
              {roi.saving_15pct > 0 && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Con una riduzione del 15% delle assenze, risparmio netto stimato: <strong style={{ color: '#16a34a' }}>{fmt(roi.saving_15pct)}</strong></div>
              )}
            </div>
          )}
        </Page>
      )}

      {/* ── PAG 9: Come funziona ──────────────────────────────────────── */}
      <Page>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 20 }}>Come funziona</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          {[
            { num: '1', title: 'Misurare', desc: 'Assessment NMQ + PSS + UWES + eNPS — già completato. I dati in questo report ne sono il risultato.' },
            { num: '2', title: 'Trattare', desc: 'Sportello osteopatico in sede secondo calendario concordato. Accesso prioritario per dipendenti Livello 1.' },
            { num: '3', title: 'Formare', desc: 'Sessioni formative collettive su postura, ergonomia e gestione del rischio muscolo-scheletrico.' },
            { num: '4', title: 'Monitorare', desc: 'Checkpoint a 3 e 6 mesi, report annuale, revisione del piano. Adattamento continuo ai risultati.' },
          ].map(s => (
            <div key={s.num} style={{ background: '#f9fafb', borderRadius: 16, padding: 18, border: '1px solid #e5e7eb' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, marginBottom: 10 }}>{s.num}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', marginBottom: 8 }}>Timeline Anno 1</div>
          <div style={{ display: 'flex', gap: 0 }}>
            {[
              ['Mese 1-2', 'Assessment + attivazione sportello', '#16a34a'],
              ['Mese 3-4', 'Sessioni intensive + formazione', '#2563eb'],
              ['Mese 5-6', 'Mantenimento + review 6 mesi', '#ca8a04'],
              ['Mese 7-10', 'Mantenimento continuo', '#7c3aed'],
              ['Mese 11-12', 'Assessment finale + report', '#16a34a'],
            ].map(([period, desc, color], i) => (
              <div key={i} style={{ flex: 1, borderLeft: `3px solid ${color}`, paddingLeft: 8, paddingRight: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color, marginBottom: 3 }}>{period}</div>
                <div style={{ fontSize: 9, color: '#6b7280', lineHeight: 1.4 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </Page>

      {/* ── PAG 10: Footer / Contatti ─────────────────────────────────── */}
      <Page>
        <div style={{ minHeight: 500, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <img src="/logo-es.png" alt="Essentia Salutis" style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 16 }} />
          <div style={{ fontSize: 28, fontWeight: 900, color: '#1e293b' }}>Essentia Salutis</div>
          <div style={{ fontSize: 14, color: '#16a34a', letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' }}>ES Work</div>

          <div style={{ width: 60, height: 3, background: '#e5e7eb', margin: '24px auto' }} />

          {(CONFIG.contact_phone || CONFIG.contact_email || CONFIG.contact_website) && (
            <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 2 }}>
              {CONFIG.contact_phone && <div>{CONFIG.contact_phone}</div>}
              {CONFIG.contact_email && <div>{CONFIG.contact_email}</div>}
              {CONFIG.contact_website && <div>{CONFIG.contact_website}</div>}
            </div>
          )}

          <div style={{ marginTop: 40, maxWidth: 480, fontSize: 14, color: '#374151', fontStyle: 'italic', lineHeight: 1.8 }}>
            &ldquo;I disturbi muscolo-scheletrici rappresentano il 77% delle malattie professionali in Italia. Noi lavoriamo su questo.&rdquo;
          </div>

          <div style={{ marginTop: 32, fontSize: 12, color: '#6b7280', lineHeight: 1.8 }}>
            <div>{CONFIG.company_address}</div>
            <div>Tel: {CONFIG.contact_phone} · {CONFIG.contact_email} · {CONFIG.contact_website}</div>
          </div>
          <div style={{ marginTop: 16, fontSize: 10, color: '#9ca3af', maxWidth: 480 }}>
            © 2026 {CONFIG.company_name} — Documento riservato e confidenziale. La riproduzione, anche parziale, è vietata senza autorizzazione scritta di Essentia Salutis.
          </div>
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
