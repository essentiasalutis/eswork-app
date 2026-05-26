/**
 * /q/c/[client_code] — Auto-dichiarazione dipendente
 *
 * Flusso GDPR-compliant:
 *   Fase 0  — Welcome screen (3 scelte)
 *   Fase 1b — Spiegazione modalità anonima
 *   Fase 2  — Consensi GDPR (solo modalità identificata)
 *   Fase 3  — Raccolta dati contatto (solo modalità identificata)
 *   Fase 4  — NMQ (9 zone, esistente)
 *   Fine    — Schermata completamento
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import Head from 'next/head';
import { BODY_ZONES, NMQ_LABELS } from '../../../lib/scoring';
import { INFORMATIVA_QUESTIONARIO } from '../../../lib/legal-texts';

// ─── NMQ Section (riusa logica da [share_code].js) ────────────────────────────

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

function NMQZone({ zone, zi, answers, setAnswer }) {
  const questions = [
    { key: `nmq_${zi}_0`, label: <>Negli ultimi 12 mesi, hai avuto fastidi o dolori a: <strong>{zone.toLowerCase()}</strong>?</> },
    { key: `nmq_${zi}_1`, label: <>Questo problema ti ha impedito di svolgere le normali attività?</> },
    { key: `nmq_${zi}_2`, label: <>Negli ultimi 7 giorni, hai avuto fastidi o dolori a: <strong>{zone.toLowerCase()}</strong>?</> },
  ];
  return (
    <div className="space-y-4">
      <div className="bg-green-50 rounded-2xl p-4 text-center">
        <div className="text-3xl mb-1">{NMQ_LABELS?.[zi]?.icon || '🫀'}</div>
        <div className="font-bold text-green-800 text-lg">{zone}</div>
      </div>
      {questions.map(q => (
        <div key={q.key} className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-sm text-gray-700 mb-3 leading-relaxed">{q.label}</p>
          <div className="flex gap-2">
            <YesNoBtn value={1} selected={answers[q.key] === 1} onSelect={v => setAnswer(q.key, v)} />
            <YesNoBtn value={0} selected={answers[q.key] === 0} onSelect={v => setAnswer(q.key, v)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Progress bar NMQ ─────────────────────────────────────────────────────────

function NMQProgress({ step, total }) {
  const pct = total > 0 ? Math.round((step / total) * 100) : 0;
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div className="h-1.5 rounded-full bg-green-500 transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Fase 0: Welcome screen ───────────────────────────────────────────────────

function WelcomeScreen({ clientName, onIdentified, onAnonymous, onExit }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-lg mx-auto w-full">
        <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center text-2xl mb-5">🌿</div>
        <div className="text-2xl font-bold text-gray-900 mb-1 text-center">ES Work</div>
        {clientName && <div className="text-sm text-gray-500 mb-6 text-center">per {clientName}</div>}

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 w-full">
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            <strong>La tua azienda ha attivato ES Work</strong>, il programma di prevenzione muscolo-scheletrica.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            Questo questionario raccoglie informazioni sui disturbi fisici nelle zone del corpo. Serve per orientare gli interventi di prevenzione dell'osteopata.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            <strong>Puoi scegliere come partecipare:</strong>
          </p>
          <ul className="mt-2 text-sm text-gray-600 space-y-1 pl-4 list-disc">
            <li><strong>Con i tuoi dati</strong>: puoi essere contattato dall'osteopata se hai bisogno di supporto</li>
            <li><strong>In modo anonimo</strong>: contribuisci ai dati aggregati aziendali, nessuno ti contatterà</li>
          </ul>
        </div>

        <div className="w-full space-y-3">
          <button
            onClick={onIdentified}
            className="w-full py-4 rounded-2xl bg-green-600 text-white font-semibold text-base shadow-sm"
          >
            ✅ Sì, ho capito e proseguo
          </button>
          <button
            onClick={onAnonymous}
            className="w-full py-4 rounded-2xl bg-white border-2 border-gray-300 text-gray-700 font-semibold text-base"
          >
            👤 Voglio contribuire in modalità anonima
          </button>
          <button
            onClick={onExit}
            className="w-full py-3 rounded-2xl text-gray-400 text-sm"
          >
            No, esco
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fase 1b: Spiegazione anonimato ──────────────────────────────────────────

function AnonymousExplanation({ onConfirm, onBack }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-lg mx-auto w-full">
        <div className="text-4xl mb-4 text-center">👤</div>
        <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">Modalità anonima</h2>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 space-y-3">
          <p className="text-sm text-gray-700 leading-relaxed">
            Compilando in <strong>modalità anonima</strong>:
          </p>
          <ul className="text-sm text-gray-600 space-y-2 pl-4 list-disc">
            <li>Le tue risposte contribuiscono ai dati aggregati dell'azienda</li>
            <li>Non viene registrato nessun dato identificativo (né nome, né email, né telefono)</li>
            <li>Nessuno potrà contattarti in seguito</li>
            <li>Non potrai accedere al programma di trattamento individuale</li>
          </ul>
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700">
              Se hai dolori frequenti o limitazioni funzionali, ti consigliamo di scegliere la modalità con i tuoi dati per poter essere contattato dall'osteopata.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onConfirm}
            className="w-full py-4 rounded-2xl bg-gray-700 text-white font-semibold text-base"
          >
            Sì, procedo anonimamente
          </button>
          <button
            onClick={onBack}
            className="w-full py-3 rounded-2xl border border-gray-300 text-gray-600 text-sm"
          >
            ← No, torno indietro
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fase 2: Consensi GDPR ───────────────────────────────────────────────────

function ConsentScreen({ onContinue }) {
  const [privacyOk, setPrivacyOk] = useState(false);
  const [healthOk, setHealthOk] = useState(false);
  const canContinue = privacyOk && healthOk;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Fase 1 di 2</div>
          <h2 className="text-xl font-bold text-gray-900">Informativa e consensi</h2>
        </div>

        {/* Informativa scrollabile */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 max-h-64 overflow-y-auto">
          {INFORMATIVA_QUESTIONARIO.sezioni.map(s => (
            <div key={s.id} className="mb-4">
              <div className="font-semibold text-gray-800 text-sm mb-1">{s.titolo}</div>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{s.testo}</p>
            </div>
          ))}
        </div>

        {/* Checkboxes */}
        <div className="space-y-3 mb-6">
          <label className="flex items-start gap-3 bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyOk}
              onChange={e => setPrivacyOk(e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-green-600 flex-shrink-0"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              Ho letto l'informativa sul trattamento dei dati personali e presto il consenso al trattamento dei dati forniti.
            </span>
          </label>

          <label className="flex items-start gap-3 bg-white rounded-2xl border border-gray-200 p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={healthOk}
              onChange={e => setHealthOk(e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-green-600 flex-shrink-0"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              Presto il consenso al trattamento dei dati relativi alla salute (art. 9 GDPR) per le finalità di prevenzione del programma ES Work.
            </span>
          </label>
        </div>

        <button
          onClick={onContinue}
          disabled={!canContinue}
          className="w-full py-4 rounded-2xl bg-green-600 text-white font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continua →
        </button>
      </div>
    </div>
  );
}

// ─── Fase 3: Raccolta dati contatto ──────────────────────────────────────────

function ContactForm({ onSubmit }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', location: '' });
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!form.first_name.trim()) e.first_name = 'Obbligatorio';
    if (!form.last_name.trim()) e.last_name = 'Obbligatorio';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email non valida';
    if (form.phone && !/^(\+39)?\s?[0-9]{9,10}$/.test(form.phone.replace(/\s/g, ''))) {
      e.phone = 'Formato non valido (es. 3331234567)';
    }
    return e;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onSubmit(form);
  }

  const Field = ({ name, label, type = 'text', placeholder, required }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={form[name]}
        onChange={e => { setForm(p => ({ ...p, [name]: e.target.value })); setErrors(p => ({ ...p, [name]: '' })); }}
        placeholder={placeholder}
        className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${errors[name] ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
      />
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Fase 2 di 2</div>
          <h2 className="text-xl font-bold text-gray-900">I tuoi dati di contatto</h2>
          <p className="text-sm text-gray-500 mt-1">Questi dati vengono trasmessi direttamente a Essentia Salutis e non all'azienda.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field name="first_name" label="Nome" placeholder="Mario" required />
          <Field name="last_name" label="Cognome" placeholder="Rossi" required />
          <Field name="email" label="Email" type="email" placeholder="mario.rossi@email.com" required />
          <Field name="phone" label="Telefono" type="tel" placeholder="3331234567" />
          <Field name="location" label="Sede di lavoro" placeholder="Es. Milano, Stabilimento Nord…" />

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs text-blue-700">
              🔒 I tuoi dati sono trattati da Essentia Salutis come titolare autonomo del trattamento. L'azienda non ha accesso ai tuoi dati personali.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-green-600 text-white font-semibold text-base mt-2"
          >
            Procedi al questionario →
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Fase 4: NMQ ─────────────────────────────────────────────────────────────

function NMQPhase({ answers, setAnswer, step, onNext, onSubmit, isLast, submitting }) {
  const zone = BODY_ZONES[step];
  const zi = step;
  const keys = [`nmq_${zi}_0`, `nmq_${zi}_1`, `nmq_${zi}_2`];
  const allAnswered = keys.every(k => answers[k] !== undefined);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 pt-4 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold text-gray-900">ES <span className="text-green-600">Work</span></div>
            <div className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">Anonimo</div>
          </div>
          <NMQProgress step={step} total={BODY_ZONES.length} />
          <div className="flex justify-between mt-1.5">
            <div className="text-xs font-semibold text-green-600">Salute fisica</div>
            <div className="text-xs text-gray-400">{step + 1} di {BODY_ZONES.length}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 max-w-lg mx-auto w-full">
        <NMQZone zone={zone} zi={zi} answers={answers} setAnswer={setAnswer} />
      </div>

      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto">
          {isLast ? (
            <button
              onClick={onSubmit}
              disabled={!allAnswered || submitting}
              className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-base disabled:opacity-40"
            >
              {submitting ? 'Invio...' : '✓ Completa e invia'}
            </button>
          ) : (
            <button
              onClick={onNext}
              disabled={!allAnswered}
              className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-base disabled:opacity-40"
            >
              Avanti →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Schermata completamento ──────────────────────────────────────────────────

function CompletionScreen({ level, wantsContact }) {
  const isL1 = level === 'level1';
  const isL2 = level === 'level2';

  if (wantsContact) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">{isL1 ? '📞' : isL2 ? '👁️' : '✅'}</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Grazie!</h2>
        {isL1 && (
          <>
            <p className="text-gray-600 mb-2">Dalle tue risposte emerge un quadro che potrebbe beneficiare di un supporto osteopatico.</p>
            <p className="text-gray-600">Sarai contattato dall'osteopata nei prossimi giorni per una valutazione.</p>
          </>
        )}
        {isL2 && (
          <p className="text-gray-600">Hai riportato alcuni fastidi. Il tuo profilo è stato registrato e riceverai aggiornamenti periodici sul programma.</p>
        )}
        {!isL1 && !isL2 && (
          <p className="text-gray-600">Non hai riportato problemi significativi. Ottimo! Continua a seguire le buone pratiche posturali.</p>
        )}
        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-500 text-left w-full max-w-sm">
          <p>🔒 I tuoi dati sono al sicuro con Essentia Salutis. Puoi richiedere modifica o cancellazione in qualsiasi momento scrivendo a info@essentiasalutis.it</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl mb-4">✅</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3">Grazie per il contributo!</h2>
      <p className="text-gray-600 mb-2">Le tue risposte anonime sono state registrate e contribuiranno all'analisi aggregata del benessere aziendale.</p>
      <p className="text-sm text-gray-400 mt-4">Nessun dato personale è stato salvato.</p>
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

const PHASES = {
  WELCOME: 'welcome',
  ANONYMOUS_EXPLAIN: 'anonymous_explain',
  CONSENT: 'consent',
  CONTACT: 'contact',
  NMQ: 'nmq',
  DONE: 'done',
  EXIT: 'exit',
};

export default function SelfDeclarePage({ client, error: serverError }) {
  const [phase, setPhase] = useState(PHASES.WELCOME);
  const [wantsContact, setWantsContact] = useState(true);
  const [contactData, setContactData] = useState(null);
  const [nmqStep, setNmqStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [level, setLevel] = useState(null);

  const STORAGE_KEY = client ? `eswork_q_${client.id}` : null;
  const scrollRef = useRef(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [phase, nmqStep]);

  // Autosave NMQ
  useEffect(() => {
    if (phase !== PHASES.NMQ || !STORAGE_KEY) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, nmqStep })); } catch {}
  }, [answers, nmqStep]);

  function setAnswer(key, val) {
    setAnswers(prev => ({ ...prev, [key]: val }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const body = {
        first_name: contactData?.first_name || null,
        last_name: contactData?.last_name || null,
        email: contactData?.email || null,
        phone: contactData?.phone || null,
        location: contactData?.location || null,
        wants_to_be_contacted: wantsContact,
        answers,
      };

      const res = await fetch(`/api/self-declare/${client.share_code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        setLevel(data.level);
        if (STORAGE_KEY) { try { localStorage.removeItem(STORAGE_KEY); } catch {} }
        setPhase(PHASES.DONE);
      }
    } catch {}
    setSubmitting(false);
  }

  if (serverError || !client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Link non valido</h1>
          <p className="text-gray-500">{serverError || 'Il link non è corretto o è scaduto.'}</p>
        </div>
      </div>
    );
  }

  if (phase === PHASES.EXIT) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 text-center">
        <div>
          <div className="text-4xl mb-4">👋</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Va bene!</h2>
          <p className="text-gray-500">Grazie. Se cambi idea, puoi sempre tornare al link.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Questionario — {client?.name || 'ES Work'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      {phase === PHASES.WELCOME && (
        <WelcomeScreen
          clientName={client.name}
          onIdentified={() => setPhase(PHASES.CONSENT)}
          onAnonymous={() => setPhase(PHASES.ANONYMOUS_EXPLAIN)}
          onExit={() => setPhase(PHASES.EXIT)}
        />
      )}

      {phase === PHASES.ANONYMOUS_EXPLAIN && (
        <AnonymousExplanation
          onConfirm={() => {
            setWantsContact(false);
            setPhase(PHASES.NMQ);
          }}
          onBack={() => setPhase(PHASES.WELCOME)}
        />
      )}

      {phase === PHASES.CONSENT && (
        <ConsentScreen onContinue={() => setPhase(PHASES.CONTACT)} />
      )}

      {phase === PHASES.CONTACT && (
        <ContactForm
          onSubmit={data => {
            setContactData(data);
            setWantsContact(true);
            setPhase(PHASES.NMQ);
          }}
        />
      )}

      {phase === PHASES.NMQ && (
        <NMQPhase
          answers={answers}
          setAnswer={setAnswer}
          step={nmqStep}
          onNext={() => setNmqStep(s => s + 1)}
          onSubmit={handleSubmit}
          isLast={nmqStep === BODY_ZONES.length - 1}
          submitting={submitting}
        />
      )}

      {phase === PHASES.DONE && (
        <CompletionScreen level={level} wantsContact={wantsContact} />
      )}
    </>
  );
}

export async function getServerSideProps({ params }) {
  const { client_code } = params;
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://eswork-app.vercel.app';
    const res = await fetch(`${base}/api/self-declare/${client_code}`);
    if (!res.ok) return { props: { client: null, error: 'Link non valido' } };
    const { client } = await res.json();
    return { props: { client: { ...client, share_code: client_code } } };
  } catch {
    return { props: { client: null, error: 'Errore di rete' } };
  }
}
