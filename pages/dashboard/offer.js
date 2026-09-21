import { useState } from 'react';
import Head from 'next/head';
import { requireAuthSsr } from '../../lib/auth';
import { datiOffertaDaCheckup } from '../../lib/offerta-server';
import {
  trafficLight, TL_COLOR, TL_BG, TL_BORDER, TYPE_LABELS, generateSummaryText, BODY_ZONES,
} from '../../lib/scoring';
import { fmt } from '../../lib/calculator';
import { CONFIG } from '../../lib/config';
import { nomeLivello } from '../../lib/livelli';
import { oggiRoma, aggiungiGiorni } from '../../lib/checkup';
import { finoAl, fraseValidita, scartoLivello2, testoScartoLivello2 } from '../../lib/offerta';
import { normalizza } from '../../lib/pipeline';
import { VOCI_PROGRAMMA, RIGA_CHIUSURA, quantitaPrimoAnno } from '../../lib/programma';
import { vistaRiservata, K_ANON, SUPPRESSED } from '../../lib/kanon';
import { pianoDeterministico } from '../../lib/piano';
import { legendaLivelli } from '../../lib/livelli';
import ArgomentarioVoci from '../../components/ArgomentarioVoci';
import { dataIt } from '../../lib/date-it.mjs';
import { DICITURA_IVA, DICITURA_IVA_BREVE } from '../../lib/iva.mjs';
import { valutaSconto, rigaRinnovo, MOTIVO_MIN, pctIt, conArticolo } from '../../lib/sconto.mjs';
import { ETICHETTA_POSIZIONE } from '../../lib/forbice.mjs';

// ─── Firma standard ───────────────────────────────────────────────────────────

const FIRMA = `Cordiali saluti,
Dott. Enrico Maiolo — founder @ Essentia Salutis
Tel: ${CONFIG.contact_phone}
${CONFIG.contact_email}`;

// ─── Modale email ─────────────────────────────────────────────────────────────

// Scadenza proposta sulla pagina: quella già salvata se l'offerta è aperta, altrimenti
// la scadenza si PROPONE sempre (oggi + giorni del Listino) e si può cancellare.
function scadenzaIniziale(client, giorniA) {
  if (!client) return '';
  if (normalizza(client.pipeline_stage) === 'offer_open') return client.offerta_scade_il || '';
  return aggiungiGiorni(oggiRoma(), giorniA);
}

function EmailModal({ modal, onClose, onInvia }) {
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
            onClick={() => { if (onInvia) onInvia(); }}
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
  return dataIt(new Date(), { day: '2-digit', month: 'long', year: 'numeric' });
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

// ─── Prezzo Anno 1 applicato (sconto) — SOLO vista admin, mai nel PDF ──────────
// Regole in lib/sconto.mjs (Enrico, 21/9): motivazione obbligatoria, sotto la soglia
// del Listino serve la conferma, sotto il costo è rifiutato. Il documento mostra solo
// il totale finale; l'Anno 2 resta a prezzo pieno.

function PrezzoApplicato({ client, query, prezzoBase, costoAnno1, sogliaMargine, sconto, margineFinale, rinnovoPieno, revisioneForbice, posizione, minimoForbice, prezzoFissato, conTetto }) {
  const [aperto, setAperto] = useState(false);
  const [prezzo, setPrezzo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [conferma, setConferma] = useState(false);
  const [esito, setEsito] = useState(null);
  const [lavoro, setLavoro] = useState(false);
  if (prezzoBase == null || costoAnno1 == null) return null;

  const stato = sconto ? sconto.stato : 'nessuno';
  const reg = sconto && sconto.registrato;
  const sogliaPct = Math.round((sogliaMargine ?? 0.4) * 1000) / 10;
  const p = prezzo === '' ? null : Number(prezzo);
  const v = p == null ? null : valutaSconto({ prezzoBase, prezzoScontato: p, costo: costoAnno1, sogliaPct: sogliaMargine, conferma, controllaMotivo: false });
  const motivoOk = motivo.trim().length >= MOTIVO_MIN;
  const puoi = v && (v.ok || (v.stato === 'serve_conferma' && conferma)) && motivoOk && !lavoro;

  async function invia(corpo) {
    setLavoro(true); setEsito(null);
    const r = await fetch(`/api/clients/${client.id}/offerta`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...corpo,
        assessment_id: query?.assessmentId || null,
        ...(query?.n ? { n: query.n } : {}),
        ...(query?.l1 ? { l1: query.l1 } : {}),
        ...(query?.l2 ? { l2: query.l2 } : {}),
      }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setLavoro(false);
    if (!r || !r.ok) { setEsito({ ok: false, testo: j.error || 'Operazione non riuscita: riprova.' }); return; }
    window.location.reload();   // il documento deve ricalcolarsi col prezzo applicato
  }

  const colore = stato === 'attivo' ? 'bg-sky-50 border-sky-200 text-sky-900'
    : stato === 'sospeso' ? 'bg-amber-50 border-amber-300 text-amber-900'
    : 'bg-gray-50 border-gray-200 text-gray-700';

  return (
    <div className={`mt-2 rounded-xl px-4 py-2.5 text-xs border ${colore}`}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <strong>Prezzo Anno 1 · solo per te</strong>
        <span>calcolato {fmt(prezzoBase)}{conTetto ? ' (con il tetto della forbice)' : ''} · costo Anno 1 {fmt(costoAnno1)} (professionisti e 30% della quota) · margine {pctIt(margineFinale && margineFinale.marginePct)}{stato === 'attivo' ? ' sul prezzo applicato' : ''}</span>
      </div>

      {revisioneForbice && (
        <div className="mt-1.5">⚠ <strong>Il massimo della forbice porta il margine {conArticolo(revisioneForbice.marginePct, 'a')}</strong> ({fmt(revisioneForbice.margineEur)}), sotto la soglia {conArticolo(revisioneForbice.sogliaPct)}. Il tetto resta: è una promessa scritta. All&apos;invio dell&apos;offerta si registra come <strong>avviso di revisione dei parametri della forbice</strong> (lo trovi nel Listino).</div>
      )}

      {stato === 'attivo' && (
        <div className="mt-1.5 space-y-1">
          <div>✓ {rigaRinnovo(sconto)}</div>
          <div className="text-sky-800">Registrato il {dataIt(reg.at)}{reg.conferma ? ' · margine sotto la soglia, confermato' : ''} · motivazione: {reg.motivo}</div>
          {posizione === 'sotto_per_sconto' && <div>{ETICHETTA_POSIZIONE.sotto_per_sconto}: il prezzo applicato è sotto il minimo della Stima ({fmt(minimoForbice)}), per questa scelta registrata.</div>}
          <div className="text-sky-800">Il documento mostra solo il totale finale; l&apos;Anno 2 resta a prezzo pieno ({fmt(rinnovoPieno)}).</div>
        </div>
      )}
      {stato === 'sospeso' && (
        <div className="mt-1.5">⚠ <strong>Prezzo applicato sospeso</strong>: {fmt(reg.prezzo)} era stato deciso il {dataIt(reg.at)} su un calcolato di {fmt(reg.calcolato)}; il calcolato ora è {fmt(prezzoBase)}. Il documento mostra il prezzo calcolato finché non lo registri di nuovo o lo revochi.</div>
      )}

      {prezzoFissato ? (
        <div className="mt-1.5 text-gray-500">Il Report di Attivazione è già stato generato: il prezzo dell&apos;Anno 1 è fissato e non si modifica più.</div>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-3">
          <button onClick={() => { setAperto(a => !a); setEsito(null); }} className="underline font-semibold">
            {stato === 'nessuno' ? 'Applica un prezzo più basso…' : 'Registra un altro prezzo…'}
          </button>
          {stato !== 'nessuno' && (
            <button disabled={lavoro} onClick={() => invia({ azione: 'revoca_sconto' })} className="underline font-semibold disabled:opacity-40">Revoca: torna al prezzo calcolato</button>
          )}
        </div>
      )}

      {aperto && !prezzoFissato && (
        <div className="mt-2 rounded-lg bg-white border border-gray-200 p-3 space-y-2 text-gray-700">
          <label className="block font-semibold text-gray-600">Prezzo Anno 1 applicato (€, IVA esclusa)
            <input inputMode="numeric" value={prezzo} onChange={e => { setPrezzo(e.target.value.replace(/[^0-9]/g, '')); setConferma(false); }}
              placeholder={String(prezzoBase)} className="mt-1 w-40 block px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-normal" />
          </label>
          {v && (
            <div className={v.ok ? 'text-green-700' : v.stato === 'serve_conferma' ? 'text-amber-800' : 'text-red-700'}>
              {v.scontoEur > 0 && <>Sconto {fmt(v.scontoEur)} ({pctIt(v.scontoPct)}) · </>}{v.messaggio}
            </div>
          )}
          {/* Resta visibile anche dopo la spunta (allora la valutazione è «valido»):
              la conferma si deve poter togliere. */}
          {v && (v.stato === 'serve_conferma' || (v.ok && v.sottoSoglia)) && (
            <label className="flex items-start gap-2 text-amber-900">
              <input type="checkbox" checked={conferma} onChange={e => setConferma(e.target.checked)} className="mt-0.5" />
              <span>Confermo il prezzo con un margine {conArticolo(v.marginePct)} ({fmt(v.margineEur)}), sotto la soglia {conArticolo(sogliaPct)}.</span>
            </label>
          )}
          <label className="block font-semibold text-gray-600">Motivazione (obbligatoria, interna: non compare in nessun documento del cliente)
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2}
              placeholder="Es. prima azienda del distretto, concordato con il titolare per l'ingresso nel programma"
              className="mt-1 w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-normal" />
          </label>
          {!motivoOk && motivo.length > 0 && <div className="text-gray-500">Almeno {MOTIVO_MIN} caratteri ({motivo.trim().length}).</div>}
          <div className="text-gray-500">Vale solo per l&apos;Anno 1: il rinnovo resta a prezzo pieno ({fmt(rinnovoPieno)}). Si modifica fino al Report di Attivazione.</div>
          <button disabled={!puoi} onClick={() => invia({ azione: 'registra_sconto', prezzo: p, motivo: motivo.trim(), conferma_margine: conferma })}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-40">
            {lavoro ? 'Registrazione…' : 'Registra il prezzo applicato'}
          </button>
        </div>
      )}
      {esito && <div className={`mt-1.5 font-semibold ${esito.ok ? 'text-green-700' : 'text-red-700'}`}>{esito.testo}</div>}
    </div>
  );
}

// ─── Offer Document ───────────────────────────────────────────────────────────

export default function OfferPage({ client, assessment, nmq, calc, roi, forchetta, tetto = null, query = null, date, offertaGiorni = 10, scartoL2 = null, pianoBase = [], prezzo = null, errore = null }) {
  const [emailModal, setEmailModal] = useState(null);
  const [scadenza, setScadenza] = useState(() => scadenzaIniziale(client, offertaGiorni));
  const [esitoInvio, setEsitoInvio] = useState(null); // { ok, testo }
  // Sforamento del massimo promesso: il server risponde 409 e qui si chiede la
  // conferma consapevole + la motivazione (interna, mai nel documento).
  const [sforamento, setSforamento] = useState(null); // { calcolato, massimo, scostamento }
  const [motivoSforamento, setMotivoSforamento] = useState('');
  // Il piano c'è già all'apertura: è quello della piattaforma, calcolato lato server.
  // L'AI entra SOLO con il pulsante qui sotto (nessuna chiamata al montaggio, 12/9).
  const [piano, setPiano] = useState(pianoBase);
  const [pianoAi, setPianoAi] = useState(false);
  const [aiStato, setAiStato] = useState(null); // null | 'attesa' | 'non_riuscito'

  async function generaPianoAi() {
    if (!nmq || aiStato === 'attesa') return;
    // Riservatezza: le zone sotto soglia non escono (sarebbero stampate con la loro
    // percentuale).
    const r = assessment ? vistaRiservata(nmq) : null;
    if (r && !r.pubblicabile) return;
    setAiStato('attesa');
    try {
      const res = await fetch('/api/ai/intervention-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zones: (r ? r.zone.filter(z => !z.soppressa) : nmq.zones).map(z => ({ zone: z.zone, pct12: z.pct12 })),
          sector: client?.sector ?? 2,
          // Il numero di persone in Livello 1 esce solo se è sopra la soglia di
          // riservatezza: se non si mostra sul documento, non esce nemmeno (12/9).
          level1Count: (!r || r.l1Visibile) ? nmq.level1.count : null,
        }),
      });
      const d = await res.json();
      // Solo un piano davvero dell'AI sostituisce la tabella: il testo di riserva
      // dell'API è lo stesso che è già a video.
      if (d.source === 'ai' && Array.isArray(d.plan) && d.plan.length) {
        setPiano(d.plan); setPianoAi(true); setAiStato(null);
      } else setAiStato('non_riuscito');
    } catch { setAiStato('non_riuscito'); }
  }

  if (errore) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div role="alert" className="max-w-lg bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-800">
          <strong>Offerta non generata.</strong> {errore}
        </div>
      </div>
    );
  }
  if (!client || !assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Dati non disponibili. Torna alla dashboard.
      </div>
    );
  }

  // Programma completo sul listino v2: le 12 voci di Enrico + le quantità del primo anno.
  // Mai valori in euro accanto alle voci (decisione Enrico): un solo numero, l'investimento.
  const nuovoProgramma = (client.pricing_version || 'v1') === 'v2' && client.tipo_prodotto !== 'pacchetto_prevenzione';
  // Riservatezza: stesse soglie del Report sulla scheda (lib/kanon.js).
  const riservata = vistaRiservata(nmq);
  const nonPubblicabile = !!(riservata && !riservata.pubblicabile);
  const cella = (key) => {
    const l = nmq[{ l1: 'level1', l2: 'level2', l3: 'level3' }[key]];
    if (!riservata) return { count: l.count, pct: l.pct, suppressed: false };
    return riservata.livelli ? riservata.livelli.find(c => c.key === key) : { count: null, pct: null, suppressed: true };
  };
  const zoneMostrate = riservata ? riservata.zone : nmq.zones;
  const prevalenzaMostrata = riservata ? riservata.prevalenza : nmq.prevalence.pct;
  const summaryText = (() => {
    if (!riservata) return generateSummaryText(nmq);
    if (!riservata.pubblicabile) return '';
    const soppressi = riservata.livelli.some(c => c.suppressed);
    const top = riservata.zone.find(z => !z.soppressa && z.pct12 > 0);
    if (!soppressi) return generateSummaryText({ ...nmq, zones: top ? [top] : [] });
    return `Su ${riservata.n} risposte, la distribuzione di dettaglio per livello non è mostrata: uno o più gruppi contano meno di ${K_ANON} persone e vengono soppressi a tutela della riservatezza.${top ? ` La zona più colpita è ${top.zone} (${top.pct12}%).` : ''}`;
  })();
  const dettaglioVoce = n => (!calc ? '' : n === 3 && calc.days_osteo_y1 ? ` (${calc.days_osteo_y1} giornate nel primo anno)` : n === 6 && calc.training_sessions_y1 ? ` (${calc.training_sessions_y1} sessioni nel primo anno)` : '');

  // Emissione dell'offerta. Il prezzo è già capato al massimo promesso: emettere
  // non chiede nulla. Il server registra la traccia dello scostamento, e per
  // superare il massimo serve prima l'autorizzazione (pulsante nel riquadro).
  async function registraInvio() {
    const r = await fetch(`/api/clients/${client.id}/offerta`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        azione: 'inviata', scade_il: scadenza || null,
        assessment_id: query?.assessmentId || null,
        // Solo gli override VALORIZZATI: passare null significherebbe «nessun valore»
        // e il server lo tratta come assente — ma qui non lo mandiamo proprio.
        ...(query?.n ? { n: query.n } : {}),
        ...(query?.l1 ? { l1: query.l1 } : {}),
        ...(query?.l2 ? { l2: query.l2 } : {}),
      }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) setEsitoInvio({ ok: false, testo: j.error || 'Offerta non registrata in Pipeline: riprova.' });
    else {
      if (j.spostata) setEsitoInvio({ ok: true, testo: 'Azienda spostata in «Offerta aperta».' });
      else if (j.stage === 'offer_open') setEsitoInvio({ ok: true, testo: 'Scadenza dell\'offerta aggiornata in Pipeline.' });
    }
  }

  // Superare il massimo promesso è un atto separato dall'invio: si autorizza qui,
  // con una motivazione che resta sulla scheda. Revocabile.
  async function autorizzaSforamento(motivo) {
    const r = await fetch(`/api/clients/${client.id}/offerta`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ azione: 'autorizza_sforamento', motivo }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setEsitoInvio({ ok: false, testo: j.error || 'Autorizzazione non registrata.' }); return; }
    setSforamento(null); setMotivoSforamento('');
    window.location.reload();   // il documento deve ricalcolarsi col prezzo pieno
  }
  async function revocaSforamento() {
    await fetch(`/api/clients/${client.id}/offerta`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ azione: 'revoca_sforamento' }),
    }).catch(() => null);
    window.location.reload();
  }

  // ─── Blocco B — Servizi di piattaforma e gestione (differenziato per tier) ────
  // I nomi dei tier NON compaiono nel PDF: cambia solo il contenuto mostrato.
  const offerTier = calc?.tier || 'core';
  // La prevenzione attiva dei Livello 2 in v2 è di TUTTI (v61): il PDF la elencava
  // solo a Plus/Enterprise, e un'azienda v2 «Core» leggeva un'offerta senza una voce
  // che sta comunque nel prezzo. Per i contratti v1 la regola resta quella firmata.
  const withPrevention = (client.pricing_version || 'v1') === 'v2' || offerTier === 'plus' || offerTier === 'enterprise';
  const mgmtServices = (CONFIG.management_services && CONFIG.management_services[offerTier])
    || (CONFIG.management_services && CONFIG.management_services.core) || [];

  function openOfferEmail() {
    const referente = client.contact_name ? `Gentile ${client.contact_name},` : `Gentile referente,`;
    const prezzoY1 = calc ? fmt(calc.price_y1) : '–';
    const body = `${referente}

Le invio in allegato la proposta di intervento per ${client.name}, elaborata a seguito del check-up ES Work.

In sintesi, il programma anno 1 prevede:
• Sportello osteopatico in sede (trattamento individuale)
• Formazione collettiva su postura ed ergonomia
• 2 review intermedie (3 e 6 mesi) + report annuale finale
• Coordinamento completo e documentazione INAIL OT23

Investimento Anno 1: ${prezzoY1} (${DICITURA_IVA_BREVE})
${scadenza ? `\n${fraseValidita(scadenza)}\n` : ''}
Il documento allegato contiene tutti i dettagli: dati emersi dal check-up, piano di intervento, analisi ROI e metodologia.

Sono disponibile per qualsiasi domanda o per fissare una call di approfondimento.

${FIRMA}`;

    setEmailModal({
      to: client.contact_email || '',
      subject: `Proposta ES Work — ${client.name}`,
      body,
    });
  }

  const semaforo = (key, base) => { const c = cella(key); return c.suppressed ? { ...base, value: SUPPRESSED, color: 'gray', sub: `gruppo < ${K_ANON}` } : { ...base, score: c.pct, value: `${c.pct}%` }; };
  const semaphoreData = [
    semaforo('l1', { type: 'nmq', label: 'Livello 1', sub: nomeLivello('level1') }),
    semaforo('l2', { type: 'plain', label: 'Livello 2', sub: nomeLivello('level2'), color: 'yellow' }),
    semaforo('l3', { type: 'plain', label: 'Livello 3', sub: nomeLivello('level3'), color: 'green' }),
  ];

  return (
    <>
      <Head>
        <title>{`Offerta ES Work — ${client.name}`}</title>
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
          <a href={`/dashboard/presentazione/${client.id}`} className="flex items-center gap-1 text-sm text-white bg-gray-900 px-4 py-2 rounded-xl font-semibold">🖥 Presenta</a>
          <a href={`/dashboard/sintesi/${client.id}`} className="flex items-center gap-1 text-sm text-gray-700 border border-gray-300 bg-white px-4 py-2 rounded-xl font-semibold">📄 Sintesi</a>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800">
          <strong>Per un PDF pulito:</strong> nel dialog di stampa Chrome → <em>Altre impostazioni</em> → deseleziona <strong>&quot;Intestazioni e piè di pagina&quot;</strong> → salva come PDF
        </div>

        {/* Validità dell'offerta — scelta qui, stampata nel documento se c'è una data */}
        <div className="mt-2 rounded-xl px-4 py-2.5 text-xs border bg-white border-gray-200 text-gray-700 flex items-center gap-2 flex-wrap">
          <strong>⏳ Validità dell&apos;offerta</strong>
          <input type="date" value={scadenza} min={oggiRoma()} onChange={e => setScadenza(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1" />
          {scadenza
            ? <button onClick={() => setScadenza('')} className="text-gray-500 underline">togli la scadenza</button>
            : <span className="font-semibold text-gray-600">senza scadenza</span>}
          <span className="text-gray-500">
            {`Scadenza proposta dal Listino (${offertaGiorni} giorni): cancellala se questa offerta non deve scadere.`}
            {' '}Con «Invia offerta via email» l&apos;azienda passa in «Offerta aperta» con questa data.
          </span>
          {esitoInvio && <span className={`font-semibold ${esitoInvio.ok ? 'text-green-700' : 'text-red-600'}`}>{esitoInvio.testo}</span>}
        </div>

        {scartoL2 && scartoL2.sopra && (
          <div className="mt-2 rounded-xl px-4 py-2.5 text-xs border bg-amber-50 border-amber-300 text-amber-900">⚠ <strong>Solo per te:</strong> {testoScartoLivello2(scartoL2)}</div>
        )}
        <div className="mt-2"><ArgomentarioVoci /></div>

        {/* Forbice della Stima — SOLO vista admin, mai nel PDF. Tre situazioni da
            distinguere: dentro il tetto, tetto applicato, nessuna forbice promessa.
            «Nessun tetto» e «prezzo dentro il tetto» non sono la stessa cosa quando
            si rilegge un'offerta a settimane di distanza (Enrico, 14/9). */}
        {calc && tetto && (() => {
          // Senza calcolo o senza tetto il riquadro non c'è (prima la pagina andava in
          // errore su tetto.min).
          const st = tetto.stato;
          const stile = st === 'capato' ? 'bg-amber-50 border-amber-300 text-amber-900'
            : st === 'sopra_autorizzato' ? 'bg-red-50 border-red-200 text-red-800'
            : st === 'dentro' ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-gray-50 border-gray-300 text-gray-700';
          return (
            <div className={`mt-2 rounded-xl px-4 py-2.5 text-xs border ${stile}`}>
              {st === 'nessuna_forbice' ? (
                <>📐 <strong>Nessuna forbice di riferimento</strong>: per questa azienda non è stata emessa una Stima, quindi nessuna promessa economica e <strong>nessun tetto applicato</strong>. Prezzo dai dati reali: <strong>{fmt(tetto.prezzo)}</strong>.</>
              ) : (
                <>📐 <strong>Forbice della Stima</strong>: {fmt(tetto.min)} – {fmt(tetto.max)}{forchetta?.avg ? ` (medio ${fmt(forchetta.avg)})` : ''} ·{' '}
                {st === 'dentro' && <><strong>preventivo dai dati reali {fmt(tetto.prezzo)}</strong> ✓ dentro la forbice, nessun tetto applicato.</>}
                {st === 'capato' && <><strong>tetto applicato</strong>: il dimensionamento reale vale {fmt(tetto.calcolato)}, si propone il massimo promesso <strong>{fmt(tetto.max)}</strong> ({fmt(tetto.scostamento)} assorbiti). L&apos;offerta si invia così com&apos;è; lo scostamento resta registrato per la trattativa dell&apos;Anno 2.{' '}
                  <button onClick={() => setSforamento({ calcolato: tetto.calcolato, massimo: tetto.max, scostamento: tetto.scostamento })}
                    className="underline font-semibold">Superare il massimo promesso…</button></>}
                {st === 'sopra_autorizzato' && <><strong>⚠ sopra il massimo, autorizzato</strong>: proposto {fmt(tetto.calcolato)} contro un massimo promesso di {fmt(tetto.max)} ({fmt(tetto.scostamento)} oltre). Motivazione registrata il {client?.sforamento_forbice_at ? dataIt(client.sforamento_forbice_at) : '—'}.{' '}
                  <button onClick={revocaSforamento} className="underline font-semibold">Torna al massimo promesso</button></>}
                </>
              )}
            </div>
          );
        })()}
        {calc && tetto && prezzo && <PrezzoApplicato client={client} query={query} {...prezzo} />}
      </div>

      {emailModal && <EmailModal modal={emailModal} onClose={() => setEmailModal(null)} onInvia={() => registraInvio()} />}

      {/* Conferma consapevole dello sforamento. Non è una spunta sola: senza una
          motivazione scritta l'offerta non parte — l'eccezione deve lasciare
          traccia, e non deve poter accadere per distrazione (Enrico, 14/9). */}
      {sforamento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ WebkitPrintColorAdjust: 'exact' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-3 shadow-2xl">
            <h3 className="font-semibold text-gray-900">Questa offerta supera il massimo promesso</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Nella Stima avete indicato un massimo di <strong>{fmt(sforamento.massimo)}</strong>. Il dimensionamento reale vale <strong>{fmt(sforamento.calcolato)}</strong>: <strong>{fmt(sforamento.scostamento)}</strong> oltre.
              Puoi proporre lo stesso il prezzo pieno, ma la motivazione resta registrata sulla scheda — è interna, non compare in nessun documento del cliente. Finché non autorizzi, l&apos;offerta resta al massimo promesso.
            </p>
            <label className="block text-xs font-semibold text-gray-500">Perché superi il massimo promesso (obbligatorio)
              <textarea value={motivoSforamento} onChange={e => setMotivoSforamento(e.target.value)} rows={3}
                placeholder="Es. la popolazione è cresciuta da 80 a 140 dipendenti dopo il colloquio, concordato con il referente il…"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-xl text-sm font-normal" />
            </label>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setSforamento(null); setMotivoSforamento(''); }} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold">
                Annulla — resto al massimo promesso
              </button>
              <button disabled={motivoSforamento.trim().length < 15} onClick={() => autorizzaSforamento(motivoSforamento.trim())}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-40">
                Autorizzo: proponi il prezzo pieno
              </button>
            </div>
            {motivoSforamento.trim().length < 15 && <p className="text-xs text-gray-400">Scrivi la motivazione (almeno 15 caratteri) per poter procedere.</p>}
          </div>
        </div>
      )}

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
            {['Cruscotto sintetico e dati emersi dal check-up', 'Disturbi muscolo-scheletrici — mappa corporea e stratificazione', 'Piano di intervento proposto', 'Investimento e analisi costi', 'Metodologia e timeline anno 1'].map((v, i, arr) => (
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

        {nonPubblicabile && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: 14, marginBottom: 14, fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
            🔒 <strong>Risultati aggregati non pubblicabili.</strong> Le risposte raccolte sono meno di {K_ANON}: a tutela della riservatezza dei dipendenti i risultati del check-up vengono mostrati solo con almeno {K_ANON} risposte.
          </div>
        )}
        {!nonPubblicabile && <div style={{ display: 'grid', gridTemplateColumns: `repeat(${semaphoreData.length}, 1fr)`, gap: 10, marginBottom: 14 }}>
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
        </div>}

        {!nonPubblicabile && <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 6 }}>Sintesi</div>
          <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.7, margin: 0 }}>{summaryText}</p>
        </div>}

        {/* Riquadro piattaforma — si chiama solo "Piattaforma digitale ES Work" (mai "AI" come nome); testo: voce 11 di Enrico */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '8px 12px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', marginBottom: 1 }}>Piattaforma digitale ES Work</div>
            <div style={{ fontSize: 10, color: '#3b82f6', lineHeight: 1.5 }}>
              Piattaforma digitale dedicata: check-up, cartella clinica del professionista, monitoraggio degli indicatori, report periodici alla direzione. L&apos;azienda accede esclusivamente a dati aggregati.
            </div>
          </div>
        </div>

        <hr className="section-sep" />

        {/* — Disturbi MSK — */}
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>Disturbi muscolo-scheletrici</div>

        {nonPubblicabile ? (
          <div style={{ fontSize: 12, color: '#6b7280' }}>Dati non pubblicabili: meno di {K_ANON} risposte (vedi sopra).</div>
        ) : <div>
          {/* zone corporee — barre (sopra) */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>Zone corporee — ultimi 12 mesi</div>
            {zoneMostrate.map((z, i) => z.soppressa ? (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <div style={{ width: 120, fontSize: 10, color: '#374151', textAlign: 'right', flexShrink: 0 }}>{z.zone}</div>
                <div style={{ flex: 1, fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>{SUPPRESSED} (gruppo &lt; {K_ANON})</div>
              </div>
            ) : (() => {
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
            })())}
            <div style={{ fontSize: 10, color: '#4b5563', marginTop: 8 }}>
              Prevalenza: {prevalenzaMostrata == null ? `${SUPPRESSED} (gruppo < ${K_ANON})` : `${prevalenzaMostrata}% ha almeno un disturbo negli ultimi 12 mesi`}
            </div>
          </div>

          {/* 3 livelli (sotto le zone corporee) */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>Stratificazione — 3 livelli</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { ...cella('l1'), label: 'Trattamento — Anno 1', sub: 'Impatto funzionale', bg: '#FFEBEE', border: '#E74C3C', color: '#E74C3C' },
                // Listino v2: la prevenzione del Livello 2 parte dal primo anno (voce 5 di Enrico).
                { ...cella('l2'), label: nuovoProgramma ? `${nomeLivello('level2')} — dal primo anno` : `${nomeLivello('level2')} — Anno 2`, sub: 'Segnali senza impatto funzionale', bg: '#FFF8E1', border: '#F39C12', color: '#F39C12' },
                { ...cella('l3'), label: 'Solo formazione', sub: 'Postura ed ergonomia', bg: '#E8F5E9', border: '#16a34a', color: '#16a34a' },
              ].map((l, i) => (
                <div key={i} style={{ background: l.bg, border: `1px solid ${l.border}`, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: l.color, lineHeight: 1 }}>{l.suppressed ? SUPPRESSED : l.count}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: l.color }}>{l.label}</div>
                  <div style={{ fontSize: 10, color: '#4b5563', lineHeight: 1.4 }}>{l.suppressed ? `gruppo < ${K_ANON}` : `${l.pct}% dipendenti`} — {l.sub}</div>
                </div>
              ))}
            </div>
            {/* Legenda: nel documento si legge «Livello 1» senza che sia detto cosa sia.
                Fonte unica in lib/livelli.js, la stessa della Stima. */}
            {nuovoProgramma && (
              <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.4, color: '#6b7280', textTransform: 'uppercase', marginBottom: 7 }}>Come si leggono i livelli</div>
                {legendaLivelli().map((v, i) => (
                  <div key={i} style={{ fontSize: 10, lineHeight: 1.5, marginBottom: 5 }}>
                    <span style={{ fontWeight: 700, color: '#1e293b' }}>{v.titolo}.</span>
                    <span style={{ color: '#4b5563' }}> {v.testo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>}
      </Page>

      {/* ══════════════════════════════════════════════════════════════
          Piano di intervento (subito sotto i disturbi, niente interruzione)
          ══════════════════════════════════════════════════════════════ */}
      <Page>
        {/* — Piano di intervento — */}
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Piano di intervento proposto</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />
          {/* La frase sull'AI compare SOLO se il piano è davvero dell'AI: dichiararla
              su un piano generato dalla piattaforma sarebbe falso (Enrico, 12/9).
              Niente "validato da un professionista osteopata": è vero nei fatti ma non
              registrato da nulla, e in un documento che legge il cliente si dichiara
              solo ciò che è dimostrabile (Enrico, 12/9). Se un giorno servirà, servirà
              una spunta registrata: "validato da [nome], [data]". */}
          <span style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>
            {pianoAi
              ? 'Piano elaborato sui dati della vostra azienda secondo il protocollo ES Work, con il supporto di strumenti di intelligenza artificiale'
              : 'Piano elaborato sui dati della vostra azienda secondo il protocollo ES Work'}
            {pianoAi && <span className="no-print" style={{ marginLeft: 6, color: '#3b82f6', fontWeight: 600 }}>✦ AI</span>}
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 12 }}>
          Zone con prevalenza ≥ 30% — interventi e risultati attesi
        </div>

        {/* Solo per Enrico, mai in stampa: l'invio dei dati all'AI è un gesto esplicito. */}
        {piano.length > 0 && !pianoAi && (
          <div className="no-print" style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 10, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={generaPianoAi} disabled={aiStato === 'attesa'}
              style={{ background: aiStato === 'attesa' ? '#cbd5e1' : '#1e293b', color: '#fff', border: 0, borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: aiStato === 'attesa' ? 'default' : 'pointer' }}>
              {aiStato === 'attesa' ? '⏳ Elaborazione…' : '✦ Genera il piano con l\'AI'}
            </button>
            <span style={{ fontSize: 11, color: '#6b7280' }}>
              {aiStato === 'non_riuscito'
                ? 'L\'AI non ha risposto: resta il piano della piattaforma qui sotto.'
                : 'Premendo il pulsante, le percentuali per zona vengono inviate ad Anthropic (Stati Uniti). Senza premere, non esce nulla.'}
            </span>
          </div>
        )}

        {(
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
                {piano.map((row, i) => (
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
          <strong>Nota metodologica:</strong> I dati derivano dal check-up (questionario NMQ) compilato dai dipendenti.
          Il programma ES Work prevede un approccio integrato: sportello osteopatico individuale + formazione collettiva + monitoraggio continuo.
        </div>
      </Page>

      {/* ══════════════════════════════════════════════════════════════
          Cosa comprende il programma — 12 voci (solo programma completo v2)
          ══════════════════════════════════════════════════════════════ */}
      {nuovoProgramma && (
        <Page className="page-keep">
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 10 }}>Cosa comprende il programma</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5 }}>
            <tbody>
              {VOCI_PROGRAMMA.map(v => (
                <tr key={v.n} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '5px 8px', fontWeight: 700, color: '#1e293b', width: '32%', verticalAlign: 'top' }}>
                    <span style={{ color: '#16a34a', marginRight: 6 }}>{v.n}</span>{v.nome}{dettaglioVoce(v.n)}
                  </td>
                  <td style={{ padding: '5px 8px', color: '#4b5563', lineHeight: 1.45 }}>
                    {v.cliente}{v.nota && <em> {v.nota}</em>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: 10.5, fontWeight: 600, color: '#1e293b' }}>{RIGA_CHIUSURA}</div>
        </Page>
      )}

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
          <div style={{ fontSize: 10, color: '#64748b', margin: '-4px 0 10px' }}>{DICITURA_IVA}</div>

          {nuovoProgramma ? (
            // Quantità del primo anno, niente euro accanto alle voci (decisione Enrico).
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 12px', marginBottom: 10, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#16a34a', textTransform: 'uppercase', marginBottom: 6 }}>Il vostro programma nel primo anno</div>
              <div style={{ fontSize: 10, color: '#1e293b', lineHeight: 1.7 }}>
                {quantitaPrimoAnno(calc, { mostraCicli: !riservata || riservata.l1Visibile }).join(' · ')}
              </div>
              <div style={{ marginTop: 6, fontSize: 9.5, color: '#15803d', lineHeight: 1.5 }}>
                Tutte le componenti sono comprese nell&apos;investimento annuale indicato sopra; sono descritte nella pagina «Cosa comprende il programma».
              </div>
            </div>
          ) : (
            <>
          {/* ── BLOCCO A — Servizi clinici ── */}
          <div style={{ fontSize: 11, fontWeight: 800, color: '#1e293b', marginBottom: 3 }}>Il programma include</div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 3 }}>Servizi clinici</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5, marginBottom: 10 }}>
            <tbody>
              {[
                ['Check-up iniziale + Report di Attivazione', 'Fotografia clinica della salute muscolo-scheletrica dell\'intera popolazione aziendale. Ogni dipendente compila un questionario validato in meno di 5 minuti. Produce la stratificazione dei bisogni e il piano di intervento personalizzato per la vostra azienda.'],
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
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#1e293b' }}>{s.label.replace(/ con AI\b/, '')}</div>
                  {s.note && <div style={{ fontSize: 9, color: '#4b5563', lineHeight: 1.4, marginTop: 1 }}>{s.note}</div>}
                </div>

              </div>
            ))}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #dcfce7', fontSize: 10, fontWeight: 600, color: '#16a34a' }}>
              Tutti i servizi di piattaforma e gestione sono inclusi nel programma annuale.
            </div>
          </div>

            </>
          )}

          {/* Anno 2 — descrizione + cifra (perché quel valore) */}
          <div style={{ background: '#eff6ff', borderRadius: 12, padding: '10px 14px', border: '1px solid #bfdbfe', marginBottom: 10, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <div style={{ fontSize: 9, color: '#2563eb', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Anno 2 e successivi (indicativo)</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8' }}>{fmt(calc.price_y2)}/anno</div>
            </div>
            <div style={{ fontSize: 9.5, color: '#1e3a8a', lineHeight: 1.5, marginTop: 4 }}>
              Dal secondo anno il programma entra nella fase di <strong>mantenimento e prevenzione</strong>, estesa ai dipendenti di Livello 1 e Livello 2 ({calc.pop_y2} persone): sportello osteopatico per consolidare i risultati, prevenzione attiva, un modulo formativo avanzato, Piattaforma digitale ES Work, monitoraggio continuo e Report Annuale.
              {/* Vero solo se l'Anno 2 costa davvero meno dell'Anno 1 proposto: con un
                  prezzo applicato più basso (sconto) può non esserlo, e la frase sparisce. */}
              {calc.price_y2 < calc.price_y1 && <> L&apos;investimento si riduce rispetto all&apos;Anno 1 perché la fase intensiva iniziale di trattamento è già stata completata: si protegge il risultato raggiunto e si previene la ricaduta.</>}
            </div>
          </div>

          {/* Tempo dipendenti — v2: tre voci dal protocollo (come i testi); v1: congelato */}
          {calc.hours_prevention != null ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: roi ? 10 : 0 }}>
            {[
              { titolo: 'In trattamento', ore: calc.hours_treated, circa: true, nota: 'Pre-validazione, ciclo e formazione', bg: '#fef2f2', bd: '#fecaca', col: '#dc2626' },
              { titolo: 'In prevenzione', ore: calc.hours_prevention, circa: true, nota: 'Sessioni di prevenzione e formazione', bg: '#fffbeb', bd: '#fde68a', col: '#b45309' },
              { titolo: 'Tutti gli altri', ore: calc.hours_untreated, circa: false, nota: 'Solo formazione collettiva', bg: '#f0fdf4', bd: '#bbf7d0', col: '#16a34a' },
            ].map(v => (
              <div key={v.titolo} style={{ background: v.bg, borderRadius: 12, padding: '8px 10px', border: `1px solid ${v.bd}`, textAlign: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: v.col, marginBottom: 2 }}>{v.titolo}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: v.col }}>{v.circa ? 'circa ' : ''}{v.ore} ore</div>
                <div style={{ fontSize: 8.5, color: '#4b5563' }}>nel primo anno di programma · {v.nota}</div>
              </div>
            ))}
          </div>
          ) : (
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

          )}

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
            { num: '1', title: 'Misurare', desc: 'Check-up già completato: i risultati di questo documento derivano dai questionari compilati dai vostri dipendenti.' },
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
              ['Mese 1-2', 'Check-up + attivazione sportello', '#16a34a'],
              ['Mese 3-4', 'Sessioni intensive + formazione', '#2563eb'],
              ['Mese 5-6', 'Mantenimento + review 6 mesi', '#ca8a04'],
              ['Mese 7-10', 'Mantenimento continuo', '#7c3aed'],
              ['Mese 11-12', 'Check-up finale + Report annuale', '#16a34a'],
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
            {scadenza && <> La presente offerta è valida <strong>{finoAl(scadenza)}</strong>.</>}
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

export const getServerSideProps = requireAuthSsr(async (ctx) => {
  const q = ctx.query;
  const { assessmentId, n, l1, l2 } = q;
  let offertaGiorni = 10;
  let scartoL2Soglia = 15;
  try { ({ offertaGiorni, scartoL2Soglia } = await (await import('../../lib/org')).getOrgParams()); } catch (_) {}

  // Solo dopo un check-up (21/9): tolti la «modalità preventivo» senza check-up e le
  // tariffe lette dall'indirizzo, un vecchio percorso del calcolatore che nessun link
  // usava più e che accettava numeri dall'indirizzo e tariffe di riserva silenziose.
  if (!assessmentId) {
    return { props: { client: null, assessment: null, nmq: null, calc: null, roi: null, date: today() } };
  }

  try {
    // Numeri dalla fonte unica (lib/offerta-server.js), condivisa con Presentazione e Sintesi.
    const d = await datiOffertaDaCheckup({ assessmentId, n, l1, l2 });
    if (!d) return { notFound: true };
    // Tariffe mancanti (21/9): nessun documento, il messaggio dice dove mancano.
    if (d.errore) return { props: { client: d.client ? { id: d.client.id, name: d.client.name } : null, assessment: null, nmq: null, calc: null, roi: null, date: today(), errore: d.errore } };
    const { client, assessment, nmq, calc, forchetta, tetto } = d;
    // Solo per il riquadro a video (mai nel documento): prezzo di partenza, costo,
    // margine, stato del prezzo applicato, rinnovo, avviso di revisione della forbice.
    const prezzo = {
      prezzoBase: d.prezzoBase ?? null, costoAnno1: d.costoAnno1 ?? null, sogliaMargine: d.sogliaMargine ?? null,
      sconto: d.sconto || { stato: 'nessuno' }, margineFinale: d.margineFinale || null, rinnovoPieno: d.rinnovoPieno ?? null,
      revisioneForbice: d.revisioneForbice || null,
      posizione: d.posizione || null, minimoForbice: forchetta ? forchetta.min ?? null : null,
      conTetto: !!(tetto && tetto.capApplicato),
      // Dopo il Report di Attivazione il prezzo è fissato: il riquadro resta, il modulo no.
      prezzoFissato: await (await import('../../lib/pricing/snapshot')).isChainClosed(client.id),
    };
    const scartoL2 = scartoLivello2({ nmq, calc, dipendenti: client && client.employees, l2Mult: d.l2Mult, soglia: scartoL2Soglia });
    const roi = null; // ROI only from calculator (requires absence days input)
    // Piano della piattaforma, calcolato qui: la tabella c'è già all'apertura e nessun
    // dato esce. Stesse soglie di riservatezza del resto della pagina (lib/kanon.js).
    const vista = vistaRiservata(nmq);
    const pianoBase = vista.pubblicabile ? pianoDeterministico(vista.zone.filter(z => !z.soppressa)) : [];

    return {
      props: {
        client,
        assessment,
        nmq,
        calc,
        roi,
        forchetta,
        tetto: tetto || null,
        // Gli override usati QUI vanno passati al server quando si emette l'offerta:
        // il gate deve valutare esattamente il prezzo che sta per essere inviato.
        query: { assessmentId, n: n ?? null, l1: l1 ?? null, l2: l2 ?? null },
        date: today(),
        offertaGiorni,
        scartoL2,
        pianoBase,
        prezzo: JSON.parse(JSON.stringify(prezzo)),
      },
    };
  } catch (e) {
    console.error(e);
    return { notFound: true };
  }
});
