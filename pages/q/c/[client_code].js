/**
 * /q/c/[client_code] — Auto-dichiarazione dipendente
 *
 * Flusso GDPR-compliant (percorso unico, sempre identificato):
 *   Fase 0  — Welcome screen
 *   Fase 1  — Consensi GDPR (privacy + dati di salute art. 9), con prova persistita
 *   Fase 2  — Raccolta dati contatto (obbligatori)
 *   Fase 3  — NMQ (9 zone)
 *   Fine    — Schermata completamento
 */

import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { BODY_ZONES } from '../../../lib/scoring';
import { ConsentScreen } from '../../../components/ConsentScreen';
import { INFORMATIVA_QUESTIONARIO } from '../../../lib/legal-texts';
import { NmqQuestionnaire } from '../../../components/NmqQuestionnaire';

// ─── Logo ES Work ─────────────────────────────────────────────────────────────

// Senza cornice né fondo bianco: il marchio appoggia sulla pagina (Enrico, 13/9).
function ESLogo({ size = 56 }) {
  return (
    <img src="/logo-es.png" alt="Essentia Salutis"
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />
  );
}

// ─── Fase 0: Welcome screen ───────────────────────────────────────────────────

function WelcomeScreen({ clientName, chiudeFrase, firmato, onIdentified }) {
  const [informativa, setInformativa] = useState(false);
  const [altroSotto, setAltroSotto] = useState(true);   // il testo è lungo: all'apertura c'è sempre altro sotto
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-lg mx-auto w-full">
        {/* Logo grande e azienda in evidenza: chi apre il link deve capire in un colpo
            d'occhio da chi arriva e per quale azienda (Enrico, 13/9). */}
        <ESLogo size={180} />
        <div className="text-3xl font-bold text-gray-900 mt-5 mb-2 text-center">ES Work</div>
        {clientName && (
          <div className={`text-center ${chiudeFrase ? 'mb-3' : 'mb-6'}`}>
            <div className="text-xs uppercase tracking-widest text-gray-400 mb-1">per l&apos;azienda</div>
            <div className="text-4xl font-extrabold" style={{ color: '#1e3a5f' }}>{clientName}</div>
          </div>
        )}
        {chiudeFrase && (
          <div className="text-xs font-semibold text-green-800 bg-green-100 rounded-full px-3 py-1 mb-6">Aperto fino {chiudeFrase}</div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5 w-full">
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            {firmato
              ? <><strong>La tua azienda ha attivato ES Work</strong>, un programma di prevenzione e trattamento dei disturbi muscolo-scheletrici, e ti chiede di partecipare a un breve check-up.</>
              : <><strong>La tua azienda sta valutando la possibilità di attivare ES Work</strong>, un programma di prevenzione e trattamento dei disturbi muscolo-scheletrici, e ti chiede di partecipare a un breve check-up.</>}
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">
            Il questionario che segue raccoglie informazioni sugli eventuali disturbi fisici nelle varie zone del corpo. Si compila in circa 5 minuti.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            I tuoi dati sono trattati in modo riservato da Essentia Salutis, nel rispetto del segreto professionale: <strong>la tua azienda non vedrà mai le tue risposte individuali</strong>, solo risultati aggregati.
          </p>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed text-center mb-4 px-1">
          La partecipazione è volontaria e non comporta alcuna conseguenza per chi sceglie di non aderire.{' '}
          <button type="button" onClick={() => setInformativa(true)} className="text-green-700 underline font-medium">
            Informativa completa sul trattamento dei dati
          </button>
        </p>

        <div className="w-full space-y-3">
          <button
            onClick={onIdentified}
            className="w-full py-4 rounded-2xl bg-green-600 text-white font-semibold text-base shadow-sm"
          >
            ✅ Sì, ho capito e proseguo
          </button>
          <p className="text-xs text-gray-400 text-center leading-relaxed px-2">
            Se preferisci non compilare il check-up puoi semplicemente chiudere questa pagina.
          </p>
        </div>
      </div>

      {/* L'informativa completa è la stessa che si accetta alla schermata dopo:
          qui si può leggere prima di decidere se proseguire. */}
      {informativa && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setInformativa(false)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <div className="font-bold text-gray-900">{INFORMATIVA_QUESTIONARIO.titolo}</div>
                <div className="text-xs text-gray-500 mt-0.5">{INFORMATIVA_QUESTIONARIO.sottotitolo}</div>
              </div>
              <button onClick={() => setInformativa(false)} className="text-gray-400 text-xl leading-none px-1">✕</button>
            </div>
            <div className="overflow-y-auto px-5 py-4" onScroll={e => {
              const el = e.currentTarget;
              setAltroSotto(el.scrollHeight - el.scrollTop - el.clientHeight > 12);
            }}>
              {INFORMATIVA_QUESTIONARIO.sezioni.map(sez => (
                <div key={sez.id} className="mb-4">
                  <div className="font-semibold text-gray-800 text-sm mb-1">{sez.titolo}</div>
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{sez.testo}</p>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100">
              {altroSotto && <div className="text-[11px] text-gray-500 text-center mb-2">↓ scorri per leggere tutta l&apos;informativa</div>}
              <button onClick={() => setInformativa(false)} className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold">Chiudi</button>
            </div>
          </div>
        </div>
      )}
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

function ContactForm({ onSubmit, sedi = [] }) {
  // Una sola sede (o nessuna dichiarata): il campo non si chiede — si compila da sé
  // con quella dichiarata dall'azienda, che è l'unica possibile.
  // Un campo solo: si scrive «Mario Rossi» come viene. Alla consegna si divide —
  // prima parola nome, il resto cognome — perché il saluto dell'area personale usa
  // il nome («Ciao Mario») e la cartella vuole i due campi separati.
  const [form, setForm] = useState({ nome_completo: '', email: '', phone: '', location: sedi.length === 1 ? sedi[0] : '' });
  const [errors, setErrors] = useState({});
  const [altraSede, setAltraSede] = useState(false);

  function validate() {
    const e = {};
    const parti = form.nome_completo.trim().split(/\s+/).filter(Boolean);
    if (parti.length < 2 || parti.join('').length < 4) e.nome_completo = 'Scrivi nome e cognome (es. Mario Rossi)';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email non valida';
    if (!form.phone.trim()) {
      e.phone = 'Obbligatorio';
    } else if (!/^(\+39)?\s?[0-9]{9,10}$/.test(form.phone.replace(/\s/g, ''))) {
      e.phone = 'Formato non valido (es. 3331234567)';
    }
    if (sedi.length > 1 && !form.location.trim()) e.location = 'Obbligatorio';
    return e;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    const parti = form.nome_completo.trim().split(/\s+/).filter(Boolean);
    onSubmit({
      first_name: parti[0],
      last_name: parti.slice(1).join(' '),
      email: form.email,
      phone: form.phone,
      location: form.location,
    });
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
          <ContactField name="nome_completo" label="Nome e cognome" placeholder="Mario Rossi" required value={form.nome_completo} error={errors.nome_completo} onChange={handleChange('nome_completo')} />
          <ContactField name="email" label="Email" type="email" placeholder="mario.rossi@email.com" required value={form.email} error={errors.email} onChange={handleChange('email')} />
          <ContactField name="phone" label="Telefono" type="tel" placeholder="3331234567" required value={form.phone} error={errors.phone} onChange={handleChange('phone')} />
          {/* Sede di lavoro: a testo libero arrivavano venti scritture della stessa sede e
              l'aggregato per sede diventava inutile. Ora è una scelta fra quelle dichiarate
              dall'azienda al colloquio; «Altra sede» resta per i casi non previsti.
              Una sola sede → campo nascosto e compilato in automatico.
              NESSUNA sede dichiarata (colloquio non compilato) → si torna al campo
              libero: senza questo ripiego il campo spariva del tutto e la sede non
              veniva più raccolta, in silenzio. */}
          {sedi.length === 0 && (
            <ContactField name="location" label="Sede di lavoro" placeholder="Es. Milano, via Torino 12" value={form.location} error={errors.location} onChange={handleChange('location')} />
          )}
          {sedi.length === 1 && (
            <p className="text-xs text-gray-500">Sede di lavoro: <strong className="text-gray-700">{sedi[0]}</strong></p>
          )}
          {sedi.length > 1 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Sede di lavoro</label>
              <select
                value={altraSede ? '__altra__' : form.location}
                onChange={e => {
                  const v = e.target.value;
                  if (v === '__altra__') { setAltraSede(true); handleChange('location')({ target: { value: '' } }); }
                  else { setAltraSede(false); handleChange('location')({ target: { value: v } }); }
                }}
                className={`w-full px-4 py-3 rounded-xl border text-base bg-white ${errors.location ? 'border-red-400' : 'border-gray-300'}`}
              >
                <option value="">Seleziona…</option>
                {sedi.map(nome => <option key={nome} value={nome}>{nome}</option>)}
                <option value="__altra__">Altra sede…</option>
              </select>
              {altraSede && (
                <input
                  autoFocus
                  value={form.location}
                  onChange={handleChange('location')}
                  placeholder="Scrivi la tua sede"
                  className={`w-full mt-2 px-4 py-3 rounded-xl border text-base ${errors.location ? 'border-red-400' : 'border-gray-300'}`}
                />
              )}
              {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs text-blue-700">
              🔒 I tuoi dati di contatto servono al professionista osteopata per contattarti e prenderti in carico. Sono trattati da Essentia Salutis come titolare autonomo, nel rispetto del segreto professionale: la tua azienda non vi ha accesso.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-green-600 text-white font-semibold text-base mt-2"
          >
            Procedi al check-up →
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Schermata completamento ──────────────────────────────────────────────────

function CompletionScreen({ level, wantsContact, careToken, firmato = false, emailAttiva = false, email = '' }) {
  const isL1 = level === 'level1';
  const isL2 = level === 'level2';
  const [copiedLink, setCopiedLink] = useState(false);
  const [invio, setInvio] = useState(null); // null | 'invio' | 'ok' | 'errore'
  const personalUrl = careToken && typeof window !== 'undefined'
    ? `${window.location.origin}/employee/${careToken}` : null;

  function copyPersonal() {
    if (!personalUrl) return;
    navigator.clipboard.writeText(personalUrl).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  // Mandarsi il link da soli: apre l'app di posta DELLA PERSONA con oggetto e testo
  // già scritti, con il suo indirizzo come destinatario. Non passa dai nostri server,
  // quindi funziona da subito — non dipende dalla verifica del dominio mittente.
  const mailtoLink = personalUrl
    ? `mailto:${encodeURIComponent(email || '')}?subject=${encodeURIComponent('La mia area personale ES Work')}&body=${encodeURIComponent(`Questo è il link alla mia area personale riservata del programma ES Work:\n\n${personalUrl}\n\nÈ personale: meglio non condividerlo.`)}`
    : null;

  // «Inviamelo per email» dal nostro server: compare SOLO quando l'invio è davvero
  // attivo (il dominio mittente non è ancora verificato).
  async function inviaPerEmail() {
    if (!careToken || invio === 'invio') return;
    setInvio('invio');
    try {
      const r = await fetch('/api/employee/send-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: careToken }),
      });
      setInvio(r.ok ? 'ok' : 'errore');
    } catch { setInvio('errore'); }
  }

  return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center px-6 py-10 text-center">
        <ESLogo size={180} />
        <div className="mt-4 mb-1 text-lg font-bold text-gray-900">ES Work</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3 mt-4">Grazie!</h2>

        {/* I testi dipendono dallo STATO DEL CONTRATTO: prima della firma il programma
            è un'ipotesi, e prometterlo sarebbe una promessa che non possiamo mantenere.
            Stessa leva già usata per la schermata di benvenuto e per i kit. */}

        {/* Livello 1 — un disturbo che limita l'attività */}
        {isL1 && (firmato ? (
          <>
            <p className="text-gray-600 mb-2">Dalle tue risposte emerge un quadro che può beneficiare di un supporto osteopatico.</p>
            <p className="text-gray-600">Sarai contattato dall&apos;osteopata per una <strong>pre-validazione clinica</strong> (videochiamata di circa 15 minuti) che confermerà il percorso più adatto a te.</p>
          </>
        ) : (
          <>
            <p className="text-gray-600 mb-2">Dalle tue risposte emerge un quadro che può beneficiare di un supporto osteopatico.</p>
            <p className="text-gray-600">La tua azienda sta valutando l&apos;attivazione del programma: <strong>se il programma verrà attivato</strong>, sarai contattato dall&apos;osteopata per una <strong>pre-validazione clinica</strong> (videochiamata di circa 15 minuti) che confermerà il percorso più adatto a te.</p>
          </>
        ))}

        {/* Livello 2 — fastidi senza impatto. La prevenzione attiva spetta a OGNI
            Livello 2: dalla v61 non dipende più dalla configurazione dell'azienda. */}
        {isL2 && (firmato ? (
          <>
            <p className="text-gray-600 mb-2">Hai riportato alcuni fastidi, senza un impatto sulle tue attività.</p>
            <p className="text-gray-600">Sei incluso nella <strong>prevenzione attiva</strong>: 4 sessioni di prevenzione con l&apos;osteopata durante l&apos;anno, più la formazione collettiva. Se la situazione peggiora, puoi <strong>segnalarlo</strong> dalla tua area personale (fino a 2 volte l&apos;anno) per essere ricontattato dall&apos;osteopata.</p>
          </>
        ) : (
          <>
            <p className="text-gray-600 mb-2">Hai riportato alcuni fastidi, senza un impatto sulle tue attività.</p>
            <p className="text-gray-600">La tua azienda sta valutando l&apos;attivazione del programma: <strong>se verrà attivato</strong>, sarai incluso nella <strong>prevenzione attiva</strong> — 4 sessioni di prevenzione con l&apos;osteopata durante l&apos;anno — e nella formazione collettiva su postura ed ergonomia.</p>
          </>
        ))}

        {/* Livello 3 — nessun disturbo in atto. Va detto perché NON riceve una presa
            in carico individuale: chi sta bene, altrimenti, si chiede perché nessuno
            lo cerca (decisione di Enrico, 13/9). */}
        {!isL1 && !isL2 && (firmato ? (
          <>
            <p className="text-gray-600 mb-2">Non hai riportato disturbi in atto: è la risposta migliore.</p>
            <p className="text-gray-600">Per te il programma è la <strong>prevenzione</strong>: formazione collettiva su postura ed ergonomia e sistemazione della postazione. <strong>Non riceverai una chiamata dall&apos;osteopata, ed è un buon segno</strong>: le sedute individuali vanno a chi ha un disturbo in corso. Se inizi ad avvertirne uno, puoi <strong>segnalarlo</strong> dalla tua area personale in qualsiasi momento (fino a 2 volte l&apos;anno).</p>
          </>
        ) : (
          <>
            <p className="text-gray-600 mb-2">Non hai riportato disturbi in atto: è la risposta migliore.</p>
            <p className="text-gray-600"><strong>Chi sta bene non ha bisogno di una presa in carico individuale</strong> — per te il programma è la <strong>prevenzione</strong>: formazione collettiva su postura ed ergonomia e sistemazione della postazione di lavoro. La tua azienda sta valutando l&apos;attivazione: se verrà attivato, sarai coinvolto in queste attività.</p>
          </>
        ))}

        {/* Area personale: è l'unico momento in cui il link viene mostrato, quindi va
            salvato ORA. Prima della firma le funzioni del percorso non sono attive
            (il blocco vero sta sul server, lib/attivazione) e il testo lo dice. */}
        {personalUrl && (
          <div className="mt-6 bg-green-50 border-2 border-green-300 rounded-2xl p-4 text-left w-full max-w-sm">
            <div className="text-sm font-bold text-green-800 mb-1">📌 La tua area personale ES Work</div>
            <p className="text-xs text-green-700 leading-relaxed mb-3">
              {firmato ? (
                <><strong>Salva questo link</strong> (aggiungilo ai preferiti o invialo a te stesso):
                da qui potrai <strong>segnalare un disturbo</strong> per essere ricontattato dall&apos;osteopata e completare i check periodici.</>
              ) : (
                <><strong>Salva questo link</strong>: è la tua area personale riservata.
                Se il programma verrà attivato, da qui potrai segnalare un disturbo e completare i check periodici.</>
              )}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-xs text-gray-600 font-mono bg-white border border-green-200 rounded-lg px-2 py-2 truncate">{personalUrl}</div>
              <button onClick={copyPersonal}
                className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-lg border ${copiedLink ? 'border-green-400 text-green-700 bg-green-100' : 'border-green-300 text-green-700 bg-white'}`}>
                {copiedLink ? '✓ Copiato' : 'Copia'}
              </button>
            </div>
            {emailAttiva ? (
              <button onClick={inviaPerEmail} disabled={invio === 'invio' || invio === 'ok'}
                className="w-full mt-2 text-xs font-semibold px-3 py-2 rounded-lg border border-green-300 text-green-700 bg-white disabled:opacity-60">
                {invio === 'ok' ? '✓ Inviato al tuo indirizzo' : invio === 'invio' ? 'Invio…' : '✉️ Inviamelo per email'}
              </button>
            ) : mailtoLink && (
              <>
                <a href={mailtoLink}
                  className="block w-full mt-2 text-center text-xs font-semibold px-3 py-2 rounded-lg border border-green-300 text-green-700 bg-white">
                  ✉️ Apri la mia posta con il link
                </a>
                <p className="text-[11px] text-green-700 mt-1">Si apre la tua app di posta con il messaggio già scritto: devi solo premere invia.</p>
              </>
            )}
            {invio === 'errore' && (
              <p className="text-xs text-amber-700 mt-2">Invio non riuscito: salva il link qui sopra.</p>
            )}
            <a href={personalUrl} className="block text-center mt-3 text-sm font-semibold text-green-700 underline">Apri ora la tua area personale →</a>
          </div>
        )}

        <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-500 text-left w-full max-w-sm">
          <p>🔒 I tuoi dati sono al sicuro con Essentia Salutis, trattati nel rispetto del segreto professionale. Puoi richiedere modifica, cancellazione o revocare il consenso in qualsiasi momento scrivendo a info@essentiasalutis.it.</p>
        </div>
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

export default function SelfDeclarePage({ client, error: serverError, checkup, sedi = [], emailAttiva = false }) {
  const [phase, setPhase] = useState(PHASES.WELCOME);
  const [wantsContact, setWantsContact] = useState(true);
  const [contactData, setContactData] = useState(null);
  const [nmqStep, setNmqStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [chiusoMsg, setChiusoMsg] = useState(null); // check-up chiuso scoperto all'invio (oltre la grazia)
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
      } else if (res.status === 410 && data.codice === 'checkup_chiuso') {
        if (STORAGE_KEY) { try { localStorage.removeItem(STORAGE_KEY); } catch {} }
        setChiusoMsg(data.error);
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

  const chiusoAlCaricamento = checkup && (checkup.stato === 'chiuso' || checkup.stato === 'non_avviato');
  if (chiusoAlCaricamento || chiusoMsg) {
    const testo = chiusoMsg
      || (checkup.stato === 'non_avviato'
        ? 'Il check-up non è ancora aperto.'
        : `Il check-up si è chiuso${checkup.chiusoFrase ? ` ${checkup.chiusoFrase}` : ''}. Grazie per l'interesse.`);
    return (
      <>
        <Head><title>Check-up — {client?.name || 'ES Work'}</title></Head>
        <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <ESLogo size={56} />
            <div className="text-2xl font-bold text-gray-900 mt-4 mb-1">ES Work</div>
            {client?.name && <div className="text-sm text-gray-500 mb-6">per {client.name}</div>}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 text-sm text-gray-700 leading-relaxed">{testo}</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Check-up — {client?.name || 'ES Work'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      {phase === PHASES.WELCOME && (
        <WelcomeScreen
          clientName={client.name}
          chiudeFrase={checkup?.chiudeFrase || null}
          firmato={!!checkup?.firmato}
          onIdentified={() => setPhase(PHASES.CONSENT)}
        />
      )}

      {phase === PHASES.CONSENT && (
        <ConsentScreen onComplete={(version) => { setConsentVersion(version); setPhase(PHASES.CONTACT); }} />
      )}

      {phase === PHASES.CONTACT && (
        <ContactForm
          sedi={sedi}
          onSubmit={data => {
            setContactData(data);
            setWantsContact(true);
            setPhase(PHASES.NMQ);
          }}
        />
      )}

      {phase === PHASES.NMQ && (
        <NmqQuestionnaire
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
          onComplete={handleSubmit}
          isLast={nmqStep === BODY_ZONES.length - 1}
          submitting={submitting}
          submitError={submitError}
        />
      )}

      {phase === PHASES.DONE && (
        <CompletionScreen level={level} wantsContact={wantsContact} careToken={careToken} firmato={!!checkup?.firmato} emailAttiva={!!emailAttiva} email={contactData?.email || ''} />
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
    // Stato del check-up calcolato QUI, al caricamento: se è chiuso il dipendente
    // lo sa prima di iniziare, non dopo 5 minuti di risposte.
    const { statoCheckupCliente, isFirmato } = await import('../../../lib/checkup-server');
    const { ilGiorno, alGiorno, oggiRoma } = await import('../../../lib/checkup');
    const st = await statoCheckupCliente(client).catch(() => null);
    const checkup = st ? {
      stato: st.stato,
      firmato: isFirmato(client),  // la frase di benvenuto dipende dalla fase: "sta valutando" / "ha attivato"
      chiudeFrase: st.stato === 'aperto' && st.chiudeIl ? alGiorno(st.chiudeIl) : null,      // "al 15 settembre"
      chiusoFrase: st.stato === 'chiuso' && (st.chiusoAlle || st.chiudeIl)
        ? ilGiorno(st.chiusoAlle ? oggiRoma(new Date(st.chiusoAlle)) : st.chiudeIl) : null,  // "l'11 settembre"
    } : null;
    // Sedi dichiarate dall'azienda al colloquio: SOLO i nomi, per il menu a tendina
    // della sede di lavoro. A testo libero arrivavano venti scritture della stessa sede.
    let sedi = [];
    try {
      const { getFirstMeeting } = await import('../../../lib/store');
      const fm = await getFirstMeeting(client.id);
      const elenco = (fm && fm.data && fm.data.step2 && fm.data.step2.sedi) || [];
      // Una sede senza nome NON sparisce dal menu (sparirebbe in silenzio e il
      // dipendente non troverebbe la sua): prende il nome posizionale «Sede N».
      sedi = elenco.map((x, i) => {
        const nome = x && typeof x.nome === 'string' ? x.nome.trim() : '';
        return nome || `Sede ${i + 1}`;
      });
      sedi = [...new Set(sedi)];
    } catch (_) { sedi = []; }
    // «Inviamelo per email» si mostra solo se l'invio è davvero attivo (lib/email):
    // il dominio mittente non è ancora verificato, e un pulsante che promette un invio
    // che non parte è peggio di un pulsante assente.
    const { invioEmailAttivo } = await import('../../../lib/email');
    return { props: { client: { id: client.id, name: client.name, share_code: client_code, tier }, checkup, sedi, emailAttiva: invioEmailAttivo() } };
  } catch (e) {
    return { props: { client: null, error: 'Errore interno: ' + e.message } };
  }
}
