/**
 * /q/c/[client_code] — Auto-dichiarazione dipendente
 *
 * Flusso GDPR-compliant:
 *   Fase 0  — Welcome screen (2 scelte: con dati / anonima)
 *   Fase 1b — Spiegazione modalità anonima
 *   Fase 2  — Consensi GDPR (solo modalità identificata)
 *   Fase 3  — Raccolta dati contatto (solo modalità identificata)
 *   Fase 4  — NMQ (9 zone)
 *   Fine    — Schermata completamento
 */

import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { BODY_ZONES } from '../../../lib/scoring';
import { INFORMATIVA_QUESTIONARIO } from '../../../lib/legal-texts';

// ─── NMQ: bottone Sì/No ───────────────────────────────────────────────────────

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

// ─── NMQ: zona corpo ──────────────────────────────────────────────────────────

function NMQZone({ zone, zi, answers, setAnswer }) {
  // Ordine: 7 giorni → 12 mesi → impatto. Le chiavi salvate restano invariate
  // (nmq_z_0 = 12 mesi, _1 = impatto, _2 = 7 giorni) per stratificazione e report.
  // Coerenza automatica (riduce risposte logicamente impossibili):
  //   7gg = SÌ  → 12 mesi auto-SÌ (bloccata) · impatto scelta libera
  //   7gg = NO  → 12 mesi scelta libera
  //     12 mesi = NO → impatto auto-NO (bloccato)
  //     12 mesi = SÌ → impatto scelta libera
  const k7 = `nmq_${zi}_2`, k12 = `nmq_${zi}_0`, kImp = `nmq_${zi}_1`;
  const v7 = answers[k7], v12 = answers[k12];

  const lock12 = v7 === 1;                  // dolore recente ⇒ rientra nei 12 mesi
  const lockImp = v7 === 0 && v12 === 0;    // nessun dolore ⇒ nessun impatto
  const impDisabled = v7 === undefined || (v7 === 0 && v12 === undefined) || lockImp;

  function set7(v) {
    setAnswer(k7, v);
    if (v === 1) {
      setAnswer(k12, 1);          // auto-flag 12 mesi
      setAnswer(kImp, undefined); // impatto: scelta esplicita
    } else {
      setAnswer(k12, undefined);  // 12 mesi torna scelta libera
      setAnswer(kImp, undefined);
    }
  }
  function set12(v) {
    if (lock12) return;
    setAnswer(k12, v);
    setAnswer(kImp, v === 0 ? 0 : undefined); // no+no → impatto auto-NO; sì → scelta
  }
  function setImp(v) {
    if (impDisabled) return;
    setAnswer(kImp, v);
  }

  const questions = [
    { key: k7, label: <>Negli ultimi <strong>7 giorni</strong>, hai avuto fastidi o dolori a: <strong>{zone.toLowerCase()}</strong>?</>, onSelect: set7, locked: false, note: null },
    { key: k12, label: <>E negli ultimi <strong>12 mesi</strong>?</>, onSelect: set12, locked: lock12, note: lock12 ? 'Compilata in automatico: se hai dolore negli ultimi 7 giorni, rientra anche negli ultimi 12 mesi.' : null },
    { key: kImp, label: <>Questo problema ti ha impedito di svolgere le normali attività?</>, onSelect: setImp, locked: impDisabled, note: lockImp ? 'Compilata in automatico: nessun dolore indicato.' : (v7 === undefined || (v7 === 0 && v12 === undefined)) ? 'Rispondi prima alle domande sopra.' : null },
  ];

  return (
    <div className="space-y-4">
      {/* Intestazione zona — solo nome, senza icona */}
      <div className="bg-green-50 rounded-2xl p-4 text-center">
        <div className="font-bold text-green-800 text-lg">{zone}</div>
      </div>
      {questions.map(q => (
        <div key={q.key} className={`bg-white rounded-2xl border border-gray-200 p-4 ${q.locked ? 'opacity-70' : ''}`}>
          <p className="text-sm text-gray-700 mb-3 leading-relaxed">{q.label}</p>
          <div className="flex gap-2">
            <YesNoBtn value={1} selected={answers[q.key] === 1} onSelect={v => q.onSelect(v)} />
            <YesNoBtn value={0} selected={answers[q.key] === 0} onSelect={v => q.onSelect(v)} />
          </div>
          {q.note && <p className="text-xs text-gray-400 mt-2">{q.note}</p>}
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

// ─── Logo ES Work ─────────────────────────────────────────────────────────────

function ESLogo({ size = 56 }) {
  return (
    <div
      className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm flex-shrink-0 bg-white"
      style={{ width: size, height: size }}
    >
      <img src="/logo-es.png" alt="Essentia Salutis" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
    </div>
  );
}

// ─── Fase 0: Welcome screen ───────────────────────────────────────────────────

function WelcomeScreen({ clientName, onIdentified }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-lg mx-auto w-full">
        <ESLogo size={64} />
        <div className="text-2xl font-bold text-gray-900 mt-4 mb-1 text-center">ES Work</div>
        {clientName && <div className="text-sm text-gray-500 mb-6 text-center">per {clientName}</div>}

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 w-full">
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            <strong>La tua azienda ha attivato ES Work</strong>, il programma di prevenzione e cura dell'apparato muscolo-scheletrico.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            Questo questionario raccoglie informazioni sugli eventuali disturbi fisici nelle varie zone del corpo. Si compila in circa 5 minuti.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            I tuoi dati sono trattati in modo <strong>riservato</strong> da Essentia Salutis, nel rispetto del segreto professionale: la tua azienda non vedrà mai le tue risposte individuali, solo risultati aggregati.
          </p>
        </div>

        <div className="w-full space-y-3">
          <button
            onClick={onIdentified}
            className="w-full py-4 rounded-2xl bg-green-600 text-white font-semibold text-base shadow-sm"
          >
            ✅ Sì, ho capito e proseguo
          </button>
          <p className="text-xs text-gray-400 text-center leading-relaxed px-2">
            Se preferisci non compilare il questionario puoi semplicemente chiudere questa pagina.
            In quel caso però non potrai essere contattato né accedere al programma di trattamento e prevenzione ES Work.
          </p>
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

        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 max-h-64 overflow-y-auto">
          {INFORMATIVA_QUESTIONARIO.sezioni.map(s => (
            <div key={s.id} className="mb-4">
              <div className="font-semibold text-gray-800 text-sm mb-1">{s.titolo}</div>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{s.testo}</p>
            </div>
          ))}
        </div>

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
          onClick={() => onContinue(INFORMATIVA_QUESTIONARIO.version)}
          disabled={!canContinue}
          className="w-full py-4 rounded-2xl bg-green-600 text-white font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continua →
        </button>
      </div>
    </div>
  );
}

// ─── Campo input — definito FUORI da ContactForm per evitare remount ──────────

function ContactField({ name, label, type, placeholder, required, value, error, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type || 'text'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full rounded-xl border px-4 py-3 text-sm outline-none ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ─── Fase 3: Raccolta dati contatto ──────────────────────────────────────────

function ContactForm({ onSubmit }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', location: '' });
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!form.first_name.trim() || form.first_name.trim().length < 2) e.first_name = 'Inserisci il nome (min. 2 caratteri)';
    if (!form.last_name.trim() || form.last_name.trim().length < 2) e.last_name = 'Inserisci il cognome (min. 2 caratteri)';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email non valida';
    if (!form.phone.trim()) {
      e.phone = 'Obbligatorio';
    } else if (!/^(\+39)?\s?[0-9]{9,10}$/.test(form.phone.replace(/\s/g, ''))) {
      e.phone = 'Formato non valido (es. 3331234567)';
    }
    if (!form.location.trim()) e.location = 'Obbligatorio';
    return e;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onSubmit(form);
  }

  function handleChange(name) {
    return e => {
      setForm(p => ({ ...p, [name]: e.target.value }));
      setErrors(p => ({ ...p, [name]: '' }));
    };
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Fase 2 di 2</div>
          <h2 className="text-xl font-bold text-gray-900">I tuoi dati di contatto</h2>
          <p className="text-sm text-gray-500 mt-1">Questi dati vengono trasmessi direttamente a Essentia Salutis e non all'azienda.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ContactField name="first_name" label="Nome" placeholder="Mario" required value={form.first_name} error={errors.first_name} onChange={handleChange('first_name')} />
          <ContactField name="last_name" label="Cognome" placeholder="Rossi" required value={form.last_name} error={errors.last_name} onChange={handleChange('last_name')} />
          <ContactField name="email" label="Email" type="email" placeholder="mario.rossi@email.com" required value={form.email} error={errors.email} onChange={handleChange('email')} />
          <ContactField name="phone" label="Telefono" type="tel" placeholder="3331234567" required value={form.phone} error={errors.phone} onChange={handleChange('phone')} />
          <ContactField name="location" label="Sede di lavoro" placeholder="Es. Milano, Stabilimento Nord…" required value={form.location} error={errors.location} onChange={handleChange('location')} />

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs text-blue-700">
              🔒 I tuoi dati sono trattati da Essentia Salutis come titolare autonomo del trattamento, nel rispetto del segreto professionale. L'azienda non ha accesso ai tuoi dati personali.
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

function NMQPhase({ answers, setAnswer, step, onNext, onBack, onSubmit, isLast, submitting, submitError, wantsContact }) {
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
            <div className={`text-xs px-2 py-1 rounded-full ${wantsContact ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {wantsContact ? 'Con i tuoi dati' : 'Anonimo'}
            </div>
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
          {submitError && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              ⚠️ {submitError}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={onBack}
              disabled={submitting}
              className="py-4 px-5 rounded-2xl border border-gray-300 text-gray-600 font-semibold text-base disabled:opacity-40"
            >
              ←
            </button>
            {isLast ? (
              <button
                onClick={onSubmit}
                disabled={!allAnswered || submitting}
                className="flex-1 py-4 rounded-2xl bg-green-600 text-white font-bold text-base disabled:opacity-40"
              >
                {submitting ? 'Invio in corso...' : '✓ Completa e invia'}
              </button>
            ) : (
              <button
                onClick={onNext}
                disabled={!allAnswered}
                className="flex-1 py-4 rounded-2xl bg-green-600 text-white font-bold text-base disabled:opacity-40"
              >
                Avanti →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Schermata completamento ──────────────────────────────────────────────────

function CompletionScreen({ level, wantsContact, tier, careToken }) {
  const isL1 = level === 'level1';
  const isL2 = level === 'level2';
  // Plus/Enterprise: i Livello 2 ricevono prevenzione attiva (4 sessioni/anno)
  const tierSupportsL2Prevention = tier === 'plus' || tier === 'enterprise';
  const [copiedLink, setCopiedLink] = useState(false);
  const personalUrl = careToken && typeof window !== 'undefined'
    ? `${window.location.origin}/employee/${careToken}` : null;

  function copyPersonal() {
    if (!personalUrl) return;
    navigator.clipboard.writeText(personalUrl).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  if (wantsContact) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center px-6 text-center">
        <ESLogo size={72} />
        <div className="mt-4 mb-1 text-lg font-bold text-gray-900">ES Work</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3 mt-4">Grazie!</h2>

        {/* L1 — ogni livello di servizio */}
        {isL1 && (
          <>
            <p className="text-gray-600 mb-2">Dalle tue risposte emerge un quadro che può beneficiare di un supporto osteopatico.</p>
            <p className="text-gray-600">Sarai contattato dall'osteopata per una <strong>pre-validazione clinica</strong> (videochiamata di circa 15 minuti) che confermerà il percorso più adatto a te.</p>
          </>
        )}

        {/* L2 — Plus/Enterprise: prevenzione attiva */}
        {isL2 && tierSupportsL2Prevention && (
          <>
            <p className="text-gray-600 mb-2">Hai riportato alcuni fastidi, senza un impatto sulle tue attività.</p>
            <p className="text-gray-600">Sei incluso nel programma di <strong>prevenzione attiva</strong> (4 sessioni dedicate durante l'anno) e nella formazione collettiva. Se la situazione peggiora, potrai <strong>segnalarlo</strong> (fino a 2 volte l'anno) per essere ricontattato dall'osteopata.</p>
          </>
        )}

        {/* L2 — Core: formazione + self-trigger */}
        {isL2 && !tierSupportsL2Prevention && (
          <>
            <p className="text-gray-600 mb-2">Hai riportato alcuni fastidi, senza un impatto sulle tue attività.</p>
            <p className="text-gray-600">Parteciperai alla <strong>formazione collettiva</strong> su postura ed ergonomia. Se la situazione peggiora, potrai <strong>segnalarlo</strong> (fino a 2 volte l'anno) per essere ricontattato dall'osteopata.</p>
          </>
        )}

        {/* L3 — ogni livello di servizio */}
        {!isL1 && !isL2 && (
          <>
            <p className="text-gray-600 mb-2">Non hai riportato disturbi in atto. Ottimo!</p>
            <p className="text-gray-600">Parteciperai alla <strong>formazione collettiva</strong> su postura ed ergonomia. Se inizi ad avvertire un disturbo, potrai <strong>segnalarlo</strong> (fino a 2 volte l'anno) per essere ricontattato dall'osteopata.</p>
          </>
        )}

        {/* Area personale: da qui il dipendente segnala disturbi (self-trigger),
            fa i mini-check e il re-assessment. Va salvata ORA: è l'unico momento
            in cui il link gli viene mostrato. */}
        {personalUrl && (
          <div className="mt-6 bg-green-50 border-2 border-green-300 rounded-2xl p-4 text-left w-full max-w-sm">
            <div className="text-sm font-bold text-green-800 mb-1">📌 La tua area personale ES Work</div>
            <p className="text-xs text-green-700 leading-relaxed mb-3">
              <strong>Salva questo link</strong> (aggiungilo ai preferiti o invialo a te stesso):
              da qui potrai <strong>segnalare un disturbo</strong> per essere ricontattato dall&apos;osteopata e completare i check periodici.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-xs text-gray-600 font-mono bg-white border border-green-200 rounded-lg px-2 py-2 truncate">{personalUrl}</div>
              <button onClick={copyPersonal}
                className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-lg border ${copiedLink ? 'border-green-400 text-green-700 bg-green-100' : 'border-green-300 text-green-700 bg-white'}`}>
                {copiedLink ? '✓ Copiato' : 'Copia'}
              </button>
            </div>
            <a href={personalUrl} className="block text-center mt-3 text-sm font-semibold text-green-700 underline">Apri ora la tua area personale →</a>
          </div>
        )}

        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-500 text-left w-full max-w-sm">
          <p>🔒 I tuoi dati sono al sicuro con Essentia Salutis, trattati nel rispetto del segreto professionale. Puoi richiedere modifica o cancellazione in qualsiasi momento scrivendo a info@essentiasalutis.it</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-6 text-center">
      <ESLogo size={72} />
      <div className="mt-4 mb-1 text-lg font-bold text-gray-900">ES Work</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3 mt-4">Grazie per il contributo!</h2>
      <p className="text-gray-600 mb-2">Le tue risposte sono state registrate e contribuiranno all'analisi aggregata del benessere aziendale.</p>
      <p className="text-sm text-gray-400 mt-4">Contributo registrato in forma anonima per le statistiche aggregate della popolazione, senza alcun dato identificativo.</p>
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

const PHASES = {
  WELCOME: 'welcome',
  CONSENT: 'consent',
  CONTACT: 'contact',
  NMQ: 'nmq',
  DONE: 'done',
};

export default function SelfDeclarePage({ client, error: serverError }) {
  const [phase, setPhase] = useState(PHASES.WELCOME);
  const [wantsContact, setWantsContact] = useState(true);
  const [contactData, setContactData] = useState(null);
  const [nmqStep, setNmqStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [level, setLevel] = useState(null);
  const [careToken, setCareToken] = useState(null);
  const [consentVersion, setConsentVersion] = useState(null);

  const STORAGE_KEY = client ? `eswork_q_${client.id}` : null;

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
    setSubmitError(null);
    try {
      const body = {
        first_name: contactData?.first_name || null,
        last_name: contactData?.last_name || null,
        email: contactData?.email || null,
        phone: contactData?.phone || null,
        location: contactData?.location || null,
        wants_to_be_contacted: wantsContact,
        answers,
        // Prova del consenso (l'utente ha spuntato entrambe le caselle per arrivare qui)
        consent_privacy: true,
        consent_health: true,
        informativa_version: consentVersion,
      };

      const res = await fetch(`/api/self-declare/${client.share_code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLevel(data.level || 'level3');
        setCareToken(data.care_token || null);
        if (STORAGE_KEY) { try { localStorage.removeItem(STORAGE_KEY); } catch {} }
        setPhase(PHASES.DONE);
      } else {
        setSubmitError(data.error || `Errore ${res.status} — riprova tra qualche secondo.`);
      }
    } catch (err) {
      setSubmitError('Errore di rete — controlla la connessione e riprova.');
    }
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
        />
      )}

      {phase === PHASES.CONSENT && (
        <ConsentScreen onContinue={(version) => { setConsentVersion(version); setPhase(PHASES.CONTACT); }} />
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
          onBack={() => {
            if (nmqStep > 0) {
              setNmqStep(s => s - 1);
            } else {
              setPhase(PHASES.CONTACT);
            }
          }}
          onSubmit={handleSubmit}
          isLast={nmqStep === BODY_ZONES.length - 1}
          submitting={submitting}
          submitError={submitError}
          wantsContact={wantsContact}
        />
      )}

      {phase === PHASES.DONE && (
        <CompletionScreen level={level} wantsContact={wantsContact} tier={client.tier} careToken={careToken} />
      )}
    </>
  );
}

export async function getServerSideProps({ params }) {
  const { client_code } = params;
  try {
    const { getClientByAssessmentShareCode } = await import('../../../lib/store');
    const client = await getClientByAssessmentShareCode(client_code);
    if (!client) return { props: { client: null, error: 'Link non valido' } };
    // tier: usa il valore salvato o derivalo dal numero di dipendenti
    const n = parseInt(client.employees) || 0;
    const tier = client.tier || (n <= 150 ? 'core' : n <= 500 ? 'plus' : 'enterprise');
    return { props: { client: { id: client.id, name: client.name, share_code: client_code, tier } } };
  } catch (e) {
    return { props: { client: null, error: 'Errore interno: ' + e.message } };
  }
}
