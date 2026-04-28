import { useState, useMemo, useRef, useEffect } from 'react';
import Head from 'next/head';
import {
  BODY_ZONES, NMQ_LABELS,
  PSS_QUESTIONS, PSS_OPTS,
  UWES_QUESTIONS, UWES_OPTS,
  TYPE_LABELS,
} from '../../lib/scoring';

// ─── Step builder ─────────────────────────────────────────────────────────────

function buildSteps(includePSS) {
  const steps = [];
  steps.push({ type: 'role' });
  BODY_ZONES.forEach((zone, zi) => steps.push({ type: 'nmq', zone, zi }));
  if (includePSS) steps.push({ type: 'pss' });
  steps.push({ type: 'uwes' });
  steps.push({ type: 'enps' });
  return steps;
}

const SECTION_COLORS = {
  role: '#6b7280',
  nmq: '#16a34a',
  pss: '#ca8a04',
  uwes: '#2563eb',
  enps: '#7c3aed',
};

const SECTION_TITLES = {
  role: 'Il tuo ruolo',
  nmq: 'Salute fisica',
  pss: 'Stress percepito',
  uwes: 'Engagement',
  enps: 'Clima aziendale',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function YesNoBtn({ value, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className="flex-1 py-3 rounded-xl border-2 text-base font-semibold transition-all"
      style={{
        borderColor: selected ? '#16a34a' : '#e5e7eb',
        background: selected ? '#dcfce7' : '#fff',
        color: selected ? '#166534' : '#6b7280',
      }}
    >
      {value === 1 ? 'Sì' : 'No'}
    </button>
  );
}

function LikertBtn({ label, selected, onSelect, color }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="py-2.5 px-3 rounded-xl border text-xs font-medium transition-all text-center"
      style={{
        borderColor: selected ? color : '#e5e7eb',
        background: selected ? color + '20' : '#fff',
        color: selected ? color : '#6b7280',
        fontWeight: selected ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

// ─── Section renderers ────────────────────────────────────────────────────────

function RoleSection({ answers, setAnswer }) {
  const options = [
    { value: 'production', label: 'In piedi / in movimento / in produzione', icon: '🏭' },
    { value: 'office', label: 'Seduto / al computer / in ufficio', icon: '💻' },
  ];
  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-base font-semibold text-gray-800 mb-6 text-center leading-relaxed">
          Il tuo lavoro è prevalentemente:
        </p>
        <div className="flex flex-col gap-3">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAnswer('role', opt.value)}
              className="p-4 rounded-xl border-2 text-left transition-all"
              style={{
                borderColor: answers.role === opt.value ? '#16a34a' : '#e5e7eb',
                background: answers.role === opt.value ? '#dcfce7' : '#fff',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{opt.icon}</span>
                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">
          Risposta anonima — usata solo per analisi aggregate
        </p>
      </div>
    </div>
  );
}

function NMQZone({ zone, zi, answers, setAnswer }) {
  return (
    <div className="space-y-2">
      <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-center">
        <div className="text-xs text-green-600 font-medium uppercase tracking-wide">Zona corporea</div>
        <div className="text-lg font-bold text-green-800">{zone}</div>
      </div>
      {NMQ_LABELS.map((label, qi) => (
        <div key={qi} className="bg-white rounded-xl border border-gray-200 p-3">
          <p className="text-sm text-gray-700 mb-2 leading-snug">
            {qi === 0 && 'Negli ultimi 12 mesi, hai avuto fastidi o dolori a: '}
            {qi === 1 && 'Questo problema ti ha impedito di svolgere le normali attività? '}
            {qi === 2 && 'Negli ultimi 7 giorni, hai avuto fastidi o dolori a: '}
            {qi === 0 || qi === 2 ? <strong>{zone.toLowerCase()}</strong> : null}
          </p>
          <div className="flex gap-2">
            <YesNoBtn
              value={1}
              selected={answers[`nmq_${zi}_${qi}`] === 1}
              onSelect={v => setAnswer(`nmq_${zi}_${qi}`, v)}
            />
            <YesNoBtn
              value={0}
              selected={answers[`nmq_${zi}_${qi}`] === 0}
              onSelect={v => setAnswer(`nmq_${zi}_${qi}`, v)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PSSSection({ answers, setAnswer }) {
  const color = SECTION_COLORS.pss;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 leading-relaxed">
        Indica con che frequenza hai vissuto le seguenti situazioni nell&apos;ultimo mese.
      </p>
      {PSS_QUESTIONS.map((q, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-sm text-gray-700 mb-3 leading-relaxed">{q.t}</p>
          <div className="flex flex-wrap gap-2">
            {PSS_OPTS.map((opt, oi) => (
              <LikertBtn
                key={oi}
                label={opt}
                selected={answers[`pss_${i}`] === oi}
                onSelect={() => setAnswer(`pss_${i}`, oi)}
                color={color}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function UWESSection({ answers, setAnswer }) {
  const color = SECTION_COLORS.uwes;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 leading-relaxed">
        Indica con che frequenza hai vissuto le seguenti esperienze lavorative.
      </p>
      {UWES_QUESTIONS.map((q, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-start gap-2 mb-3">
            <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
              style={{ background: color + '20', color }}>
              {q.d}
            </span>
            <p className="text-sm text-gray-700 leading-relaxed">{q.t}</p>
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
            {UWES_OPTS.map((opt, oi) => (
              <LikertBtn
                key={oi}
                label={opt}
                selected={answers[`uwes_${i}`] === oi}
                onSelect={() => setAnswer(`uwes_${i}`, oi)}
                color={color}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ENPSSection({ answers, setAnswer }) {
  const color = SECTION_COLORS.enps;
  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-base text-gray-700 mb-5 leading-relaxed text-center">
          Su una scala da <strong>0 a 10</strong>, quanto consiglieresti questa azienda come posto di lavoro a un amico?
        </p>
        <div className="grid grid-cols-6 gap-2 mb-4">
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setAnswer('enps', i)}
              className="aspect-square rounded-xl border-2 text-base font-bold transition-all"
              style={{
                borderColor: answers.enps === i ? color : '#e5e7eb',
                background: answers.enps === i ? color + '20' : '#fff',
                color: answers.enps === i ? color : '#6b7280',
              }}
            >
              {i}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-400 px-1">
          <span>Per niente</span>
          <span>Assolutamente sì</span>
        </div>
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ steps, current }) {
  const sections = ['role', 'nmq', 'pss', 'uwes', 'enps'].filter(s =>
    steps.some(step => step.type === s)
  );
  return (
    <div className="flex gap-1.5">
      {sections.map(s => {
        const sSteps = steps.filter(step => step.type === s);
        const first = steps.indexOf(sSteps[0]);
        const last = steps.indexOf(sSteps[sSteps.length - 1]);
        const isDone = current > last;
        const isActive = current >= first && current <= last;
        const color = SECTION_COLORS[s];
        return (
          <div key={s} className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-200">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: isDone ? '100%' : isActive
                  ? `${((current - first + 1) / sSteps.length) * 100}%`
                  : '0%',
                background: color,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Questionnaire({ assessment, client, error: serverError }) {
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(serverError || null);

  const steps = useMemo(
    () => assessment ? buildSteps(assessment.include_pss) : [],
    [assessment?.include_pss]
  );

  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [step]);

  const totalSteps = steps.length;
  const current = steps[step];
  const isLast = step === totalSteps - 1;

  function setAnswer(key, val) {
    setAnswers(prev => ({ ...prev, [key]: val }));
  }

  function countAnswered() {
    if (!current) return { answered: 0, total: 0 };
    if (current.type === 'role') {
      return { answered: answers.role !== undefined ? 1 : 0, total: 1 };
    }
    if (current.type === 'nmq') {
      const zi = current.zi;
      const keys = [`nmq_${zi}_0`, `nmq_${zi}_1`, `nmq_${zi}_2`];
      return { answered: keys.filter(k => answers[k] !== undefined).length, total: 3 };
    }
    if (current.type === 'pss') {
      return {
        answered: Array.from({ length: 10 }, (_, i) => answers[`pss_${i}`]).filter(v => v !== undefined).length,
        total: 10,
      };
    }
    if (current.type === 'uwes') {
      return {
        answered: Array.from({ length: 9 }, (_, i) => answers[`uwes_${i}`]).filter(v => v !== undefined).length,
        total: 9,
      };
    }
    if (current.type === 'enps') {
      return { answered: answers.enps !== undefined ? 1 : 0, total: 1 };
    }
    return { answered: 0, total: 0 };
  }

  function canAdvance() {
    if (!current) return false;
    const { answered, total } = countAnswered();
    return answered === total;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/respond/${assessment.share_code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const d = await res.json();
        setError(d.error || 'Errore durante l\'invio');
      }
    } catch {
      setError('Errore di rete. Riprova.');
    }
    setSubmitting(false);
  }

  if (error && !assessment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Link non disponibile</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <>
        <Head><title>Grazie! — ES Work</title></Head>
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
          <div className="text-center max-w-sm w-full">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Grazie!</h1>
            <p className="text-gray-500 text-base leading-relaxed mb-12">
              Le tue risposte sono state registrate in modo anonimo.<br/>
              Il tuo contributo aiuterà a migliorare il benessere in azienda.
            </p>
            <div className="border-t border-gray-100 pt-10">
              <img src="/logo-es.png" alt="Essentia Salutis" className="w-32 h-32 mx-auto mb-4" />
              <div className="text-xl font-bold text-gray-900 tracking-wide">ES Work</div>
              <div className="text-sm font-medium text-green-600 tracking-widest uppercase mt-1">
                by Essentia Salutis
              </div>
              <p className="text-xs text-gray-400 mt-3">Programma di prevenzione muscolo-scheletrica</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const { answered, total } = countAnswered();
  const sectionType = current?.type;
  const sectionColor = SECTION_COLORS[sectionType] || '#16a34a';

  return (
    <>
      <Head>
        <title>Questionario — {client?.name || 'ES Work'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 pt-4 pb-3">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-base font-bold text-gray-900">
                  ES <span className="text-green-600">Work</span>
                </div>
                {client?.name && (
                  <div className="text-xs text-gray-500">{client.name} · {TYPE_LABELS[assessment?.type]}</div>
                )}
              </div>
              <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Anonimo</div>
            </div>
            <ProgressBar steps={steps} current={step} />
            <div className="flex items-center justify-between mt-2">
              <div
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: sectionColor + '20', color: sectionColor }}
              >
                {SECTION_TITLES[sectionType]}
              </div>
              <div className="text-xs text-gray-400">
                Passo {step + 1} di {totalSteps}
                {total > 1 && ` · ${answered}/${total}`}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          <div className="max-w-lg mx-auto">
            {sectionType === 'role' && (
              <RoleSection answers={answers} setAnswer={setAnswer} />
            )}
            {sectionType === 'nmq' && (
              <NMQZone zone={current.zone} zi={current.zi} answers={answers} setAnswer={setAnswer} />
            )}
            {sectionType === 'pss' && (
              <PSSSection answers={answers} setAnswer={setAnswer} />
            )}
            {sectionType === 'uwes' && (
              <UWESSection answers={answers} setAnswer={setAnswer} />
            )}
            {sectionType === 'enps' && (
              <ENPSSection answers={answers} setAnswer={setAnswer} />
            )}
            {error && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Bottom nav */}
        <div className="bg-white border-t border-gray-200 px-4 pt-3 pb-4 safe-bottom">
          <div className="max-w-lg mx-auto">
            {!canAdvance() && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-amber-500 text-base">⚠️</span>
                <span className="text-xs text-amber-700 font-medium">
                  Rispondi a tutte le domande per continuare
                </span>
              </div>
            )}
            <div className="flex gap-3">
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="px-5 py-3.5 rounded-xl border border-gray-300 text-gray-600 font-medium text-sm"
                >
                  ← Indietro
                </button>
              )}
              {!isLast ? (
                <button
                  onClick={() => canAdvance() && setStep(s => s + 1)}
                  disabled={!canAdvance()}
                  className="flex-1 py-3.5 rounded-xl font-semibold text-white text-base transition-opacity"
                  style={{
                    background: sectionColor,
                    opacity: canAdvance() ? 1 : 0.4,
                    cursor: canAdvance() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Avanti →
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !canAdvance()}
                  className="flex-1 py-3.5 rounded-xl font-semibold text-white text-base bg-green-600 disabled:opacity-60"
                >
                  {submitting ? 'Invio in corso...' : 'Invia risposte ✓'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps({ params }) {
  const { share_code } = params;
  try {
    const { getAssessmentByShareCode, getClientById } = await import('../../lib/store');
    const assessment = await getAssessmentByShareCode(share_code);
    if (!assessment) {
      return { props: { assessment: null, client: null, error: 'Link non valido o scaduto.' } };
    }
    if (assessment.status !== 'active') {
      return { props: { assessment: null, client: null, error: 'Questo questionario è stato chiuso.' } };
    }
    const client = await getClientById(assessment.client_id);
    return {
      props: {
        assessment: {
          id: assessment.id,
          type: assessment.type,
          include_pss: assessment.include_pss,
          share_code: assessment.share_code,
        },
        client: { name: client?.name || '' },
        error: null,
      },
    };
  } catch {
    return { props: { assessment: null, client: null, error: 'Errore del server.' } };
  }
}
