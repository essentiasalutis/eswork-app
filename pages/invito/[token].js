// Pagina PUBBLICA del neoassunto — /invito/<token>. MUTA sull'azienda (nessun nome/logo
// cliente, nessun dipendente_id in DOM/SSR/headers): l'unica superficie che un estraneo
// può vedere. Riusa i componenti CONDIVISI del questionario NMQ e del consenso (una sola
// fonte del renderer clinico e del testo/versioning di consenso).
//
// Blocker chiusi qui:
//  B1 — care_token MAI in URL: torna nel BODY del submit; il link personale lo costruisce
//       il client dopo. Referrer-Policy: no-referrer (header + meta) → il token invito non
//       trapela come Referer.
//  B2 — client_id risolto server-side dentro l'RPC (mai dal body).
//  B3 — payload muto: getServerSideProps ritorna SOLO { alive } (nessun nome azienda / dip_id).
//  B4 — token nel BODY del POST (non ri-messo in URL sul submit).
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { BODY_ZONES } from '../../lib/scoring';
import { ConsentScreen } from '../../components/ConsentScreen';
import { NmqQuestionnaire } from '../../components/NmqQuestionnaire';

const PHASES = { WELCOME: 'welcome', CONSENT: 'consent', CONTACT: 'contact', NMQ: 'nmq', DONE: 'done' };

function DeadLink() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Link non valido</h1>
        <p className="text-gray-500">Il link non è corretto, è già stato usato o è scaduto.</p>
      </div>
    </div>
  );
}

function Welcome({ onContinue }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-gray-900">ES <span className="text-green-600">Work</span></div>
          <div className="text-sm text-gray-500 mt-1">Registrazione al programma</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <p className="text-sm text-gray-700 leading-relaxed"><strong>Benvenuto in ES Work</strong>, il programma di prevenzione e cura dell&apos;apparato muscolo-scheletrico.</p>
          <p className="text-sm text-gray-600 leading-relaxed">Questo questionario raccoglie informazioni sugli eventuali disturbi fisici nelle varie zone del corpo. Si compila in circa 5 minuti.</p>
          <p className="text-sm text-gray-600 leading-relaxed">I tuoi dati sono trattati in modo <strong>riservato</strong> da Essentia Salutis, nel rispetto del segreto professionale.</p>
          <button onClick={onContinue} className="w-full py-3.5 rounded-2xl bg-green-600 text-white font-bold mt-2">Inizia →</button>
        </div>
      </div>
    </div>
  );
}

function ContactForm({ onSubmit }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', location: '' });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => { setForm(p => ({ ...p, [k]: e.target.value })); setErrors(p => ({ ...p, [k]: '' })); };
  function submit(e) {
    e.preventDefault();
    const er = {};
    if (form.first_name.trim().length < 2) er.first_name = 'Inserisci il nome (min. 2 caratteri)';
    if (form.last_name.trim().length < 2) er.last_name = 'Inserisci il cognome (min. 2 caratteri)';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) er.email = 'Email non valida';
    if (!/^(\+39)?\s?[0-9]{9,10}$/.test(form.phone.replace(/\s/g, ''))) er.phone = 'Telefono non valido';
    if (!form.location.trim()) er.location = 'Obbligatorio';
    if (Object.keys(er).length) { setErrors(er); return; }
    onSubmit(form);
  }
  // Campi inline (NON un componente ricreato ogni render → niente remount degli input).
  const FIELDS = [
    ['first_name', 'Nome', 'text', 'Mario'],
    ['last_name', 'Cognome', 'text', 'Rossi'],
    ['email', 'Email', 'email', 'mario.rossi@email.com'],
    ['phone', 'Telefono', 'tel', '3331234567'],
    ['location', 'Sede di lavoro', 'text', 'Es. Milano'],
  ];
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-5">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Fase 2 di 2</div>
          <h2 className="text-xl font-bold text-gray-900">I tuoi dati di contatto</h2>
          <p className="text-sm text-gray-500 mt-1">Questi dati vengono trasmessi direttamente a Essentia Salutis.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {FIELDS.map(([k, label, type, ph]) => (
            <div key={k}>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{label} *</label>
              <input type={type} value={form[k]} onChange={set(k)} placeholder={ph}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500" />
              {errors[k] && <p className="text-xs text-red-600 mt-1">{errors[k]}</p>}
            </div>
          ))}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs text-blue-700">🔒 I tuoi dati sono trattati da Essentia Salutis come titolare autonomo del trattamento, nel rispetto del segreto professionale.</p>
          </div>
          <button type="submit" className="w-full py-4 rounded-2xl bg-green-600 text-white font-semibold text-base mt-2">Procedi al questionario →</button>
        </form>
      </div>
    </div>
  );
}

function Done({ careToken }) {
  const [copied, setCopied] = useState(false);
  const url = careToken && typeof window !== 'undefined' ? `${window.location.origin}/employee/${careToken}` : null;
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center px-6 text-center">
      <div className="text-2xl font-bold text-gray-900">ES <span className="text-green-600">Work</span></div>
      <h2 className="text-2xl font-bold text-gray-900 mb-3 mt-4">Grazie!</h2>
      <p className="text-sm text-gray-600 max-w-md">Il tuo questionario è stato registrato. Qui sotto trovi il link alla tua area personale, dove seguirai il tuo percorso.</p>
      {url && (
        <div className="mt-5 w-full max-w-md">
          <div className="flex items-center gap-2">
            <code className="text-xs bg-white border border-gray-200 px-3 py-2 rounded-lg flex-1 min-w-0 truncate">{url}</code>
            <button onClick={() => { navigator.clipboard.writeText(url).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg">{copied ? '✓' : 'Copia'}</button>
          </div>
          <a href={url} className="block mt-3 w-full py-3.5 rounded-2xl bg-green-600 text-white font-bold text-center">Vai alla mia area personale →</a>
        </div>
      )}
    </div>
  );
}

export default function InvitoPage({ alive }) {
  const router = useRouter();
  const token = router.query.token;
  const [phase, setPhase] = useState(PHASES.WELCOME);
  const [consentVersion, setConsentVersion] = useState(null);
  const [contact, setContact] = useState(null);
  const [answers, setAnswers] = useState({});
  const [nmqStep, setNmqStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [careToken, setCareToken] = useState(null);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [phase, nmqStep]);

  const setAnswer = (k, v) => setAnswers(prev => ({ ...prev, [k]: v }));

  async function handleSubmit() {
    setSubmitting(true); setSubmitError(null);
    try {
      const res = await fetch('/api/invito/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, answers,
          first_name: contact?.first_name || null,
          last_name: contact?.last_name || null,
          email: contact?.email || null,
          phone: contact?.phone || null,
          location: contact?.location || null,
          wants_to_be_contacted: true,
          informativa_version: consentVersion,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.care_token) {
        setCareToken(data.care_token); // B1: care_token dal BODY, mai da URL
        setPhase(PHASES.DONE);
      } else {
        setSubmitError(data.message || 'Non è stato possibile completare la registrazione, riprova.');
      }
    } catch {
      setSubmitError('Errore di rete — controlla la connessione e riprova.');
    }
    setSubmitting(false);
  }

  return (
    <>
      <Head>
        <title>Registrazione</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      {!alive ? <DeadLink />
        : phase === PHASES.WELCOME ? <Welcome onContinue={() => setPhase(PHASES.CONSENT)} />
        : phase === PHASES.CONSENT ? <ConsentScreen onComplete={(version) => { setConsentVersion(version); setPhase(PHASES.CONTACT); }} />
        : phase === PHASES.CONTACT ? <ContactForm onSubmit={(data) => { setContact(data); setPhase(PHASES.NMQ); }} />
        : phase === PHASES.NMQ ? (
          <NmqQuestionnaire
            answers={answers}
            setAnswer={setAnswer}
            step={nmqStep}
            onNext={() => setNmqStep(s => s + 1)}
            onBack={() => { if (nmqStep > 0) setNmqStep(s => s - 1); else setPhase(PHASES.CONTACT); }}
            onComplete={handleSubmit}
            isLast={nmqStep === BODY_ZONES.length - 1}
            submitting={submitting}
            submitError={submitError}
          />
        )
        : <Done careToken={careToken} />}
    </>
  );
}

// getServerSideProps MUTO: ritorna SOLO { alive } (booleano). Nessun nome azienda,
// nessun dipendente_id. Referrer-Policy: no-referrer sulla route (oltre alla meta).
export async function getServerSideProps({ params, res }) {
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    const { invitoTokenAlive } = await import('../../lib/org');
    const alive = await invitoTokenAlive(params.token);
    return { props: { alive: !!alive } };
  } catch {
    return { props: { alive: false } };
  }
}
