import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { requireAuthSsr } from '../../lib/auth';
import { datiOffertaDaCheckup } from '../../lib/offerta-server';
import {
  trafficLight, TL_COLOR, TL_BG, TL_BORDER, TYPE_LABELS, generateSummaryText,
} from '../../lib/scoring';
import { fmt } from '../../lib/calculator';
import { CONFIG } from '../../lib/config';
import { nomeLivello, legendaLivelli, CARTE_LIVELLO, azioneLivello } from '../../lib/livelli';
import { oggiRoma } from '../../lib/checkup';
import { scadenzaOffertaProposta } from '../../lib/offerta';
import { avanzamento, normalizza } from '../../lib/pipeline';
import { VOCI_PROGRAMMA, RIGA_CHIUSURA, quantitaPrimoAnno } from '../../lib/programma';
import { vistaRiservata, K_ANON, SUPPRESSED, ND_POCHI, livelliLeggibili, nomeCella, NOTA_LIVELLI_UNITI, NOTA_NESSUNA_DISTRIBUZIONE } from '../../lib/kanon';
import { testoAccettazione, prossimiPassi } from '../../lib/presentazione-testi.mjs';
import { isFirmato } from '../../lib/pipeline';
import EmailModal from '../../components/EmailModal';
import { Lettore, SLIDE_GRAZIE } from '../../components/presentazione/slide';
import { slideProposta } from '../../components/presentazione/SlideProposta';
import { mailProposta } from '../../lib/mail-referente.mjs';
import ArgomentarioVoci from '../../components/ArgomentarioVoci';
import { dataIt } from '../../lib/date-it.mjs';
import { DICITURA_IVA, DICITURA_IVA_BREVE } from '../../lib/iva.mjs';
import { valutaSconto, rigaRinnovo, MOTIVO_MIN, pctIt, conArticolo } from '../../lib/sconto.mjs';
import { ETICHETTA_POSIZIONE } from '../../lib/forbice.mjs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return dataIt(new Date(), { day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── Print page wrapper ───────────────────────────────────────────────────────

// Larghezza di una pagina del documento (A4 con i margini di stampa): a schermo il
// documento si ingrandisce in proporzione da qui.
const LARGHEZZA_PAGINA = 720;

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
        <div className="mt-1.5">⚠ <strong>Il massimo della forbice porta il margine {conArticolo(revisioneForbice.marginePct, 'a')}</strong> ({fmt(revisioneForbice.margineEur)}), sotto la soglia {conArticolo(revisioneForbice.sogliaPct)}. Il tetto resta: è una promessa scritta. All&apos;invio della proposta si registra come <strong>avviso di revisione dei parametri della forbice</strong> (lo trovi nel Listino).</div>
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

// Testi in comune con la presentazione (lib/presentazione-server.js → testiCondivisi):
// «deve essere tutto unico tra presentazione e preventivo» (Enrico, 27/9). Revisione del
// 28/9: il preventivo è il documento che si firma, la presentazione quello che racconta —
// niente «Perché riguarda l'azienda», «Come funziona» né «Prossimi passi», che sono già
// nella presentazione; le leve economiche subito dopo l'investimento, a sostegno del prezzo.
//   condivisi: { zone, piano, anno2, leve: { economiche, slide }, nuovoProgramma, pacchetto }
export default function OfferPage({ client, assessment, nmq, calc, forchetta, tetto = null, query = null, date, offertaGiorni = 10, prezzo = null, errore = null, condivisi = null, reportAttivazione = null }) {
  const [emailModal, setEmailModal] = useState(null);
  // Validità dell'offerta (Listino, 10 giorni): la stessa data dei prossimi passi della
  // presentazione. I 15 giorni sono un'altra cosa: dall'accettazione al contratto.
  const [scadenza, setScadenza] = useState(() => scadenzaOffertaProposta(client, offertaGiorni));
  const [esitoInvio, setEsitoInvio] = useState(null); // { ok, testo }
  // «Mostra al cliente» (Enrico, 28/9): a schermo intero le slide della proposta; forbice,
  // costo, margine e argomentario spariscono. Si esce con Esc (o uscendo dallo schermo intero).
  const [cliente, setCliente] = useState(false);
  const [conArgomentario, setConArgomentario] = useState(false);
  const [slide, setSlide] = useState(0);
  // Sul PC di Enrico il documento occupa tutta la larghezza (28/9): si ingrandisce in
  // proporzione, come un PDF «adatta alla larghezza»; in stampa resta A4.
  const docRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = docRef.current;
    if (!el) return undefined;
    // Subito all'apertura, poi a ogni cambio di larghezza (finestra, «Mostra al cliente»).
    const misura = () => setZoom(Math.max(0.5, Math.min(2.5, el.clientWidth / LARGHEZZA_PAGINA)));
    misura();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', misura);
      return () => window.removeEventListener('resize', misura);
    }
    const ro = new ResizeObserver(misura);
    ro.observe(el);
    return () => ro.disconnect();
  }, [errore, cliente]);
  const esciCliente = useCallback(() => {
    setCliente(false);
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {}
  }, []);
  // «Mostra al cliente» fa partire le slide della proposta (Enrico, 28/9): lo stesso
  // contenuto del documento, in parure con la presentazione del Report.
  function mostraAlCliente() {
    setSlide(0);
    setCliente(true);
    try { document.documentElement.requestFullscreen(); } catch (_) {}
  }
  useEffect(() => {
    if (!cliente) return undefined;
    const tasto = (e) => { if (e.key === 'Escape') esciCliente(); };
    // Chrome usa Esc per uscire dallo schermo intero senza passarlo alla pagina.
    const schermo = () => { if (!document.fullscreenElement) setCliente(false); };
    window.addEventListener('keydown', tasto);
    document.addEventListener('fullscreenchange', schermo);
    return () => { window.removeEventListener('keydown', tasto); document.removeEventListener('fullscreenchange', schermo); };
  }, [cliente, esciCliente]);
  // Sforamento del massimo promesso: il server risponde 409 e qui si chiede la
  // conferma consapevole + la motivazione (interna, mai nel documento).
  const [sforamento, setSforamento] = useState(null); // { calcolato, massimo, scostamento }
  const [motivoSforamento, setMotivoSforamento] = useState('');
  if (errore) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div role="alert" className="max-w-lg bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-800">
          <strong>Proposta di intervento non generata.</strong> {errore}
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
  // Livelli per il documento (Enrico, 27/9): quelli sotto soglia UNITI in un solo dato,
  // mai «n.d.» livello per livello.
  const L = riservata && riservata.pubblicabile && riservata.livelli ? livelliLeggibili(riservata.livelli, riservata.n) : null;
  const celleLivelli = !riservata
    ? ['l1', 'l2', 'l3'].map(k => ({ ...cella(k), key: k, keys: [k], unite: false }))
    : (L && !L.nessunaDistribuzione ? L.celle : []);
  // Tutte le zone (o i tre distretti), come nel report e nella presentazione (27/9).
  const Z = (condivisi && condivisi.zone) || { aggrega: false, nota: null, righe: [] };
  const prevalenzaMostrata = riservata ? riservata.prevalenza : nmq.prevalence.pct;
  const summaryText = (() => {
    if (!riservata) return generateSummaryText(nmq);
    if (!riservata.pubblicabile) return '';
    const soppressi = riservata.livelli.some(c => c.suppressed);
    const top = riservata.zone.find(z => !z.soppressa && z.pct12 > 0);
    if (!soppressi) return generateSummaryText({ ...nmq, zones: top ? [top] : [] });
    return `Su ${riservata.n} risposte, ${L && L.nessunaDistribuzione ? NOTA_NESSUNA_DISTRIBUZIONE.charAt(0).toLowerCase() + NOTA_NESSUNA_DISTRIBUZIONE.slice(1) : `${NOTA_LIVELLI_UNITI.charAt(0).toLowerCase()}${NOTA_LIVELLI_UNITI.slice(1)}`}${top ? ` La zona più colpita è ${top.zone} (${top.pct12}%).` : ''}`;
  })();
  // Niente «giornate di sportello» nei documenti del cliente: è una misura interna
  // (Enrico, 27/9). Resta il numero delle sessioni di formazione.
  const dettaglioVoce = n => (calc && n === 6 && calc.training_sessions_y1 ? ` (${calc.training_sessions_y1} sessioni nel primo anno)` : '');
  const accettazione = testoAccettazione({ importo: calc ? fmt(calc.price_y1) : null, iva: DICITURA_IVA_BREVE, scadenza });
  const leveEconomiche = (condivisi && condivisi.leve && condivisi.leve.economiche) || [];
  // La proposta nasce dal Report di Attivazione e ne porta il prezzo (Enrico, 28/9). Prima
  // del Report è una bozza: qui si preparano prezzo e prezzo applicato, che il Report poi
  // fissa. Se il prezzo di oggi non è più quello scritto nel Report, non esce.
  const prezzoDiverso = !!(reportAttivazione && calc && reportAttivazione.prezzo != null && Math.round(reportAttivazione.prezzo) !== Math.round(calc.price_y1));
  const pronta = !!(reportAttivazione && !prezzoDiverso);
  const motivoSpento = !reportAttivazione ? 'Bozza: si accende dopo il Report di Attivazione' : prezzoDiverso ? 'Il prezzo non è quello del Report di Attivazione: rigeneralo' : undefined;

  // Emissione dell'offerta. Il prezzo è già capato al massimo promesso: emettere
  // non chiede nulla. Il server registra la traccia dello scostamento, e per
  // superare il massimo serve prima l'autorizzazione (pulsante nel riquadro).
  async function registraInvio() {
    const r = await fetch(`/api/clients/${client.id}/offerta`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        azione: 'inviata', scade_il: scadenza || null,
        assessment_id: query?.assessmentId || null,
        ...(query?.n ? { n: query.n } : {}),
      }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) setEsitoInvio({ ok: false, testo: j.error || 'Proposta non registrata in Pipeline: riprova.' });
    else {
      if (j.spostata) setEsitoInvio({ ok: true, testo: 'Azienda spostata in «Proposta aperta».' });
      else if (j.stage === 'offer_open') setEsitoInvio({ ok: true, testo: 'Scadenza della proposta aggiornata in Pipeline.' });
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

  // Mail al referente (lib/mail-referente.mjs, Enrico 28/9): importo, validità, come si
  // accetta; niente elenco del programma, che è nel documento allegato.
  function openOfferEmail() {
    const m = mailProposta({ azienda: client.name, referente: client.contact_name, importo: calc ? fmt(calc.price_y1) : '–', iva: DICITURA_IVA_BREVE, scadenza });
    setEmailModal({ to: client.contact_email || '', subject: m.oggetto, body: m.corpo });
  }

  // Le slide della proposta: gli stessi dati del documento qui sotto.
  const firmato = isFirmato(client.pipeline_stage);
  const datiSlide = calc ? {
    azienda: client.name, data: date, nuovoProgramma,
    piano: (condivisi && condivisi.piano) || null,
    quantita: condivisi && condivisi.piano ? null : quantitaPrimoAnno(calc),
    prezzo: { y1: calc.price_y1, mese: calc.price_monthly_y1, y2: calc.price_y2 },
    anno2: condivisi && condivisi.anno2,
    forchetta: forchetta && forchetta.min != null && forchetta.max != null ? { min: forchetta.min, max: forchetta.max } : null,
    inRange: forchetta && forchetta.min != null && forchetta.max != null ? (calc.price_y1 >= forchetta.min && calc.price_y1 <= forchetta.max) : null,
    tempo: calc.hours_prevention != null ? { trattamento: calc.hours_treated, prevenzione: calc.hours_prevention, altri: calc.hours_untreated } : null,
    // Nelle slide anche l'OT23, accanto alla deducibilità (Enrico, 28/9).
    leve: (condivisi && condivisi.leve && condivisi.leve.slide) || leveEconomiche,
    passi: condivisi && !condivisi.pacchetto && !firmato ? prossimiPassi({ scadenzaOfferta: scadenza }).slice(0, 2) : null,
  } : null;

  // Riga sulla Pipeline nella finestra della mail: la stessa regola di
  // registraOffertaInviata (lib/pipeline-server.js), solo in avanti.
  const notaPipeline = normalizza(client.pipeline_stage) === 'offer_open'
    ? ` Aprendo la mail la scadenza in Pipeline diventa ${scadenza ? dataIt(scadenza) : 'nessuna'}.`
    : avanzamento(normalizza(client.pipeline_stage), 'offer_open')
      ? ` Aprendo la mail l'azienda passa in «Proposta aperta»${scadenza ? `, con scadenza ${dataIt(scadenza)}` : ''}.`
      : '';

  const STILE_SEM = {
    // Colore fisso del livello, anche nel cruscotto (lib/livelli.js, Enrico 28/9).
    l1: { type: 'plain', sub: nomeLivello('level1'), color: CARTE_LIVELLO.l1.semaforo },
    l2: { type: 'plain', sub: nomeLivello('level2'), color: CARTE_LIVELLO.l2.semaforo },
    l3: { type: 'plain', sub: nomeLivello('level3'), color: CARTE_LIVELLO.l3.semaforo },
  };
  const semaphoreData = celleLivelli.map(c => (c.unite
    ? { type: 'plain', label: nomeCella(c), sub: c.keys.map(k => STILE_SEM[k].sub).join(' · '), value: `${c.pct}%`, color: 'gray' }
    : c.suppressed
      ? { ...STILE_SEM[c.key], label: nomeCella(c), value: 'N.d.', color: 'gray', sub: `poiché < ${K_ANON} persone` }
      : { ...STILE_SEM[c.key], label: nomeCella(c), score: c.pct, value: `${c.pct}%` }));

  // «Mostra al cliente»: solo le slide della proposta, a schermo intero (Esc per uscire),
  // e in fondo «Grazie per l'attenzione» (Enrico, 28/9).
  const slideCliente = cliente && datiSlide ? slideProposta(datiSlide) : [];
  const schermateCliente = slideCliente.length ? [...slideCliente, SLIDE_GRAZIE] : [];
  if (schermateCliente.length) {
    return (
      <>
        <Head><title>{`Proposta di intervento — ${client.name}`}</title></Head>
        <Lettore schermate={schermateCliente} i={slide} setI={setSlide} onEsci={esciCliente} />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{`Proposta di intervento — ${client.name}`}</title>
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
          max-width: ${LARGHEZZA_PAGINA}px;
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
          .offer-layout { display: block !important; padding: 0 !important; }
          .offer-doc { zoom: 1 !important; }
        }
        @media screen { .offer-doc { zoom: var(--zoom-doc, 1); } .solo-stampa { display: none; } }
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

      {/* ── Pulsanti UI (no print) — spariscono con «Mostra al cliente» ─────── */}
      {!cliente && (
      <div className="no-print px-6 pt-4 pb-2">
        <div className="flex gap-3 flex-wrap mb-2">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1 text-sm text-gray-600 border border-gray-300 px-3 py-2 rounded-xl"
          >
            ← Indietro
          </button>
          <button
            onClick={() => window.print()} disabled={!pronta} title={motivoSpento}
            className="flex items-center gap-1 text-sm text-green-700 border border-green-300 bg-green-50 px-4 py-2 rounded-xl font-semibold disabled:opacity-40"
          >
            🖨 PDF / Stampa
          </button>
          <button
            onClick={openOfferEmail} disabled={!pronta} title={motivoSpento}
            className="flex items-center gap-1 text-sm text-blue-700 border border-blue-300 bg-blue-50 px-4 py-2 rounded-xl font-semibold disabled:opacity-40"
          >
            ✉ Invia al referente
          </button>
          <button
            onClick={mostraAlCliente} disabled={!pronta}
            className="flex items-center gap-1 text-sm text-white bg-gray-900 px-4 py-2 rounded-xl font-semibold disabled:opacity-40"
            title={motivoSpento || 'Le slide della proposta a schermo intero: niente forbice, margine né argomentario. Esc per tornare.'}
          >
            🖥 Mostra al cliente
          </button>
          {/* L'argomentario in un riquadro vicino a «Mostra al cliente», non a lato del
              documento (Enrico, 28/9). Solo per te, non si stampa. */}
          <button
            onClick={() => setConArgomentario(v => !v)} aria-expanded={conArgomentario}
            className={`flex items-center gap-1 text-sm px-4 py-2 rounded-xl font-semibold border ${conArgomentario ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-amber-50 border-amber-200 text-amber-800'}`}
          >
            📖 Argomentario
          </button>
        </div>
        {conArgomentario && <div className="mb-2"><ArgomentarioVoci aperto /></div>}

        {!reportAttivazione && (
          <div className="mb-2 rounded-xl px-4 py-2.5 text-xs border bg-amber-50 border-amber-300 text-amber-900">
            📝 <strong>Bozza.</strong> La proposta di intervento nasce dal Report di Attivazione: qui prepari il prezzo e, se serve, il prezzo applicato, che il Report poi fissa. Stampa, invio e «Mostra al cliente» si accendono dopo il Report, che si genera dalla scheda dell&apos;azienda.
          </div>
        )}
        {prezzoDiverso && (
          <div className="mb-2 rounded-xl px-4 py-2.5 text-xs border bg-red-50 border-red-200 text-red-800">
            ⚠ <strong>Il prezzo di oggi, {fmt(calc.price_y1)}, non è quello scritto nel Report di Attivazione del {dataIt(reportAttivazione.il)}, {fmt(reportAttivazione.prezzo)}.</strong> La proposta deve avere i numeri del Report: rigenera il Report dalla scheda dell&apos;azienda.
          </div>
        )}

        {/* Validità dell'offerta — scelta qui, stampata nel documento se c'è una data */}
        <div className="mt-2 rounded-xl px-4 py-2.5 text-xs border bg-white border-gray-200 text-gray-700 flex items-center gap-2 flex-wrap">
          <strong>⏳ Validità della proposta</strong>
          <input type="date" value={scadenza} min={oggiRoma()} onChange={e => setScadenza(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1" />
          {scadenza
            ? <button onClick={() => setScadenza('')} className="text-gray-500 underline">togli la scadenza</button>
            : <span className="font-semibold text-gray-600">senza scadenza</span>}
          <span className="text-gray-500">{offertaGiorni} giorni dal Listino</span>
          {esitoInvio && <span className={`font-semibold ${esitoInvio.ok ? 'text-green-700' : 'text-red-600'}`}>{esitoInvio.testo}</span>}
        </div>

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
                {st === 'capato' && <><strong>tetto applicato</strong>: il dimensionamento reale vale {fmt(tetto.calcolato)}, si propone il massimo promesso <strong>{fmt(tetto.max)}</strong> ({fmt(tetto.scostamento)} assorbiti). La proposta si invia così com&apos;è; lo scostamento resta registrato per la trattativa dell&apos;Anno 2.{' '}
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
      )}

      {emailModal && <EmailModal modal={emailModal} allegato="la proposta" nota={notaPipeline} onClose={() => setEmailModal(null)} onInvia={() => registraInvio()} />}

      {/* Conferma consapevole dello sforamento. Non è una spunta sola: senza una
          motivazione scritta l'offerta non parte — l'eccezione deve lasciare
          traccia, e non deve poter accadere per distrazione (Enrico, 14/9). */}
      {sforamento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" style={{ WebkitPrintColorAdjust: 'exact' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-3 shadow-2xl">
            <h3 className="font-semibold text-gray-900">Questa proposta supera il massimo promesso</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Nella Stima avete indicato un massimo di <strong>{fmt(sforamento.massimo)}</strong>. Il dimensionamento reale vale <strong>{fmt(sforamento.calcolato)}</strong>: <strong>{fmt(sforamento.scostamento)}</strong> oltre.
              Puoi proporre lo stesso il prezzo pieno, ma la motivazione resta registrata sulla scheda — è interna, non compare in nessun documento del cliente. Finché non autorizzi, la proposta resta al massimo promesso.
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

      {/* Documento a tutta larghezza (Enrico, 28/9); in stampa resta A4. */}
      <div className="offer-layout px-6 pb-10">
        <div ref={docRef}>
          <div className="offer-doc" style={{ '--zoom-doc': zoom }}>

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
            {/* «Proposta di intervento» (Enrico, 27/9): il Report di Attivazione è un altro
                documento, quello che diventa l'Allegato A del contratto. */}
            <div style={{ fontSize: 18, fontWeight: 400, color: '#6b7280' }}>Proposta di intervento</div>
          </div>
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Azienda cliente</div>
            <div style={{ fontSize: 22, color: '#1e293b', fontWeight: 700 }}>{client.name}</div>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>{date}</div>
          {/* Una bozza stampata non deve sembrare una proposta valida. */}
          {!pronta && <div className="solo-stampa" style={{ marginTop: 18, fontSize: 13, fontWeight: 800, color: '#b91c1c', letterSpacing: 1 }}>BOZZA — NON VALIDA COME PROPOSTA DI INTERVENTO</div>}

          <div style={{ marginTop: 48, width: '100%', maxWidth: 480, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: '16px 24px', textAlign: 'left' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>Contenuto del documento</div>
            {[
              'Cruscotto sintetico e dati emersi dal check-up',
              'Disturbi muscolo-scheletrici — zone e stratificazione',
              ...(condivisi && condivisi.piano ? ['Il vostro programma nel primo anno e cosa comprende'] : []),
              leveEconomiche.length ? 'Investimento e leve economiche' : 'Investimento',
              'Accettazione della proposta',
            ].map((v, i, arr) => (
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
        {!nonPubblicabile && semaphoreData.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: `repeat(${semaphoreData.length}, 1fr)`, gap: 10, marginBottom: 14 }}>
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

        {/* Il riquadro «Piattaforma digitale ES Work» è tolto (Enrico, 28/9): è la voce 11 di
            «Cosa comprende il programma». */}

        <hr className="section-sep" />

        {/* — Disturbi MSK — */}
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>Disturbi muscolo-scheletrici</div>

        {nonPubblicabile ? (
          <div style={{ fontSize: 12, color: '#6b7280' }}>Dati non pubblicabili: meno di {K_ANON} risposte (vedi sopra).</div>
        ) : <div>
          {/* zone corporee — barre (sopra) */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>{Z.aggrega ? 'Distretti corporei' : 'Zone corporee'} — ultimi 12 mesi</div>
            {Z.nota && <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 8 }}>{Z.nota}</div>}
            {Z.righe.map((z, i) => z.soppressa ? (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <div style={{ width: 120, fontSize: 10, color: '#374151', textAlign: 'right', flexShrink: 0 }}>{z.zone}</div>
                <div style={{ flex: 1, fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>{ND_POCHI}</div>
              </div>
            ) : (() => {
              const c = TL_COLOR[trafficLight('zona', z.pct12)];
              const w = Math.max((z.pct12 / 100) * 100, z.pct12 > 0 ? 5 : 0);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <div style={{ width: 120, fontSize: 10, color: '#374151', textAlign: 'right', flexShrink: 0 }}>{z.zone}</div>
                  <div style={{ flex: 1, height: 16, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    <div style={{ width: `${w}%`, height: '100%', background: c, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 5, minWidth: z.pct12 > 0 ? 28 : 0, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                      {z.pct12 > 0 && <span style={{ color: 'white', fontSize: 9, fontWeight: 600 }}>{z.pct12}%</span>}
                    </div>
                  </div>
                  {/* Anche lo zero è un dato (Enrico, 27/9: «laddove ci sono % metterle»). */}
                  {z.pct12 === 0 && <span style={{ fontSize: 9, fontWeight: 600, color: '#4b5563' }}>0%</span>}
                </div>
              );
            })())}
            <div style={{ fontSize: 10, color: '#4b5563', marginTop: 8 }}>
              Prevalenza: {prevalenzaMostrata == null ? ND_POCHI : `${prevalenzaMostrata}% ha almeno un disturbo negli ultimi 12 mesi`}
            </div>
          </div>

          {/* 3 livelli (sotto le zone corporee) */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>Stratificazione — 3 livelli</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(celleLivelli.length, 1)}, 1fr)`, gap: 10 }}>
              {celleLivelli.map((c, i) => {
                // Stesse carte della presentazione (lib/livelli.js, 27/9):
                // percentuale, persone, nome, descrizione e cosa ricevono.
                const keys = c.keys || [c.key];
                const colore = c.unite ? '#475569' : CARTE_LIVELLO[keys[0]].color;
                const sfondo = c.unite ? '#F8FAFC' : CARTE_LIVELLO[keys[0]].bg;
                return (
                <div key={i} style={{ background: sfondo, border: `1px solid ${colore}`, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 3, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: colore, lineHeight: 1 }}>{c.suppressed ? 'N.d.' : `${c.pct}%`}</div>
                  <div style={{ fontSize: 10, color: '#4b5563' }}>{c.suppressed ? `poiché < ${K_ANON} persone` : `${c.count} ${c.count === 1 ? 'dipendente' : 'dipendenti'}`}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: colore, marginTop: 2 }}>{nomeCella(c)}</div>
                  <div style={{ fontSize: 10, color: '#4b5563', lineHeight: 1.4 }}>{keys.map(k => CARTE_LIVELLO[k].desc).join(' · ')}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#1e293b', lineHeight: 1.4 }}>→ {keys.map(k => azioneLivello(k, { nuovoProgramma })).join(' · ')}</div>
                  {c.unite && <div style={{ fontSize: 9.5, color: '#64748b' }}>Insieme, a tutela della riservatezza.</div>}
                </div>
                );
              })}
            </div>
            {L && (L.unite || L.nessunaDistribuzione) && (
              <div style={{ fontSize: 10, color: '#4b5563', marginTop: 6 }}>{L.nessunaDistribuzione ? NOTA_NESSUNA_DISTRIBUZIONE : NOTA_LIVELLI_UNITI}</div>
            )}
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
          Il vostro programma nel primo anno — lo stesso testo della presentazione
          (Enrico, 27/9). Prima qui c'era una tabella per zona con «Riduzione sintomi
          20-30% in 12 mesi» per ogni riga e servizi che il programma non ha («analisi
          del passo», «calzature professionali»): una promessa di risultato clinico e
          voci inesistenti in un documento che si firma. Tolta, con il suo pulsante AI.
          ══════════════════════════════════════════════════════════════ */}
      {condivisi && condivisi.piano && (
        <Page className="page-keep">
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>Il vostro programma nel primo anno</div>
          <div style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic', marginBottom: 12 }}>
            Piano elaborato sui dati della vostra azienda secondo il protocollo ES Work
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {condivisi.piano.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                <span style={{ color: '#16a34a', fontWeight: 800 }}>●</span>
                <span>{r.titolo && <strong style={{ color: '#1e293b' }}>{r.titolo}: </strong>}{r.testo}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, background: '#f9fafb', borderRadius: 12, padding: 12, fontSize: 11, color: '#374151', lineHeight: 1.7 }}>
            <strong>Nota metodologica:</strong> I dati derivano dal check-up (questionario NMQ) compilato dai dipendenti.
            Il programma ES Work prevede un approccio integrato: sportello osteopatico individuale + formazione collettiva + monitoraggio continuo.
          </div>
        </Page>
      )}

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
              {/* Totale e mese, mai «per dipendente» (Enrico, 27/9). */}
              {fmt(calc.price_monthly_y1)} al mese
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#64748b', margin: '-4px 0 10px' }}>{DICITURA_IVA}</div>

          {nuovoProgramma ? (
            // Il programma è descritto nella sua pagina, con lo stesso testo della
            // presentazione (27/9): qui niente quantità né «giornate di sportello».
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 12px', marginBottom: 10, fontSize: 10, color: '#15803d', lineHeight: 1.5, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              Tutte le componenti sono comprese nell&apos;investimento annuale indicato sopra; sono descritte nelle pagine «Il vostro programma nel primo anno» e «Cosa comprende il programma».
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
                // Niente giornate: misura interna (Enrico, 27/9).
                ['Sportello osteopatico in sede', 'Trattamento osteopatico individuale erogato direttamente nella vostra sede, riservato ai dipendenti con reale indicazione clinica. Ogni percorso è preceduto da una pre-validazione con l\'osteopata e monitorato trattamento per trattamento con misure di esito oggettive.'],
                ['Pre-validazioni cliniche', 'Valutazione clinica iniziale con l\'osteopata prima di ogni percorso di trattamento: conferma l\'indicazione, definisce gli obiettivi e garantisce che le risorse vadano a chi ne ha realmente bisogno.'],
                ...(withPrevention ? [['Prevenzione attiva L2', 'Trattamenti di prevenzione dedicati ai dipendenti con segnali precoci, per intervenire prima che il disturbo evolva in patologia conclamata.']] : []),
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
            {/* La stessa spiegazione della presentazione (lib/anno2.mjs, Enrico 27/9): cosa
                comprende e, solo se vero, perché costa meno o più dell'Anno 1. */}
            {condivisi && condivisi.anno2 && (
              <div style={{ fontSize: 9.5, color: '#1e3a8a', lineHeight: 1.5, marginTop: 4 }}>{condivisi.anno2}</div>
            )}
          </div>

          {/* Tempo dipendenti — v2: tre voci dal protocollo (come i testi); v1: congelato */}
          {calc.hours_prevention != null ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { titolo: 'In trattamento', ore: calc.hours_treated, circa: true, nota: 'Pre-validazione, ciclo e formazione', bg: '#fef2f2', bd: '#fecaca', col: '#dc2626' },
              { titolo: 'In prevenzione', ore: calc.hours_prevention, circa: true, nota: 'Trattamenti di prevenzione e formazione', bg: '#fffbeb', bd: '#fde68a', col: '#b45309' },
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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

        </Page>
      )}

      {/* ══════════════════════════════════════════════════════════════
          Le leve economiche, subito dopo l'investimento: «a sostegno del prezzo» (Enrico,
          28/9). Stessi testi della presentazione (lib/leve.js) senza le due che il
          preventivo dice già: il tempo (pagina dell'investimento) e l'OT23 (voce 12).
          «Perché riguarda l'azienda» resta solo nella presentazione.
          ══════════════════════════════════════════════════════════════ */}
      {calc && leveEconomiche.length > 0 && (
        <Page className="page-keep">
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 10 }}>Le leve economiche</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {leveEconomiche.map(l => (
              <div key={l.titolo} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>{l.titolo}</div>
                <div style={{ fontSize: 10, color: '#4b5563', lineHeight: 1.5, marginTop: 3 }}>{l.testo}</div>
                {l.dato && <div style={{ fontSize: 10, fontWeight: 600, color: '#15803d', marginTop: 3 }}>{l.dato}</div>}
                {l.nota && <div style={{ fontSize: 9.5, color: '#6b7280', marginTop: 3 }}>{l.nota}</div>}
              </div>
            ))}
          </div>
        </Page>
      )}

      {/* ══════════════════════════════════════════════════════════════
          Accettazione + contatti. «Come funziona» e «I prossimi passi» sono tolti (Enrico,
          28/9): li racconta la presentazione. I 15 giorni per il contratto restano scritti
          qui, nell'accettazione.
          ══════════════════════════════════════════════════════════════ */}
      <Page className="page-keep">
        <div>
        {/* — Accettazione e firma — */}
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#4b5563', textTransform: 'uppercase', marginBottom: 8 }}>Accettazione della proposta</div>
          {/* Strada B (Enrico, 27/9): l'accettazione fissa le condizioni, il programma parte
              con il contratto entro 15 giorni. Nome e ruolo di chi firma; l'importo nella
              frase, così la pagina firmata porta il prezzo anche da sola. */}
          <div style={{ fontSize: 11, color: '#374151', lineHeight: 2, marginBottom: 20 }}>
            Il/La sottoscritto/a <span style={{ display: 'inline-block', minWidth: 190, borderBottom: '1px solid #9ca3af' }}>&nbsp;</span>, in qualità di <span style={{ display: 'inline-block', minWidth: 150, borderBottom: '1px solid #9ca3af' }}>&nbsp;</span> di <strong>{client.name}</strong>, {accettazione.dichiarazione}
            {' '}{accettazione.condizioni}
            {accettazione.validita && <> <strong>{accettazione.validita}</strong></>}
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
            {/* Il «77%» non aveva una fonte: la frase verificata delle leve (Enrico, 27/9). */}
            &ldquo;I disturbi muscolo-scheletrici sono la prima voce di malattia professionale denunciata. Noi lavoriamo su questo.&rdquo;
          </p>
        </div>

        <div style={{ marginTop: 12, fontSize: 9, color: '#4b5563', textAlign: 'center' }}>
          © 2026 {CONFIG.company_name} — Documento riservato e confidenziale. Riproduzione vietata senza autorizzazione scritta di Essentia Salutis.
        </div>
        </div>{/* end flex column */}
      </Page>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => {
  const q = ctx.query;
  const { assessmentId, n } = q;
  let offertaGiorni = 10;
  try { ({ offertaGiorni } = await (await import('../../lib/org')).getOrgParams()); } catch (_) {}

  // Solo dopo un check-up (21/9): tolti la «modalità preventivo» senza check-up e le
  // tariffe lette dall'indirizzo, un vecchio percorso del calcolatore che nessun link
  // usava più e che accettava numeri dall'indirizzo e tariffe di riserva silenziose.
  if (!assessmentId) {
    return { props: { client: null, assessment: null, nmq: null, calc: null, date: today() } };
  }

  try {
    // Numeri dalla fonte unica (lib/offerta-server.js), condivisa con la Presentazione.
    const d = await datiOffertaDaCheckup({ assessmentId, n });
    if (!d) return { notFound: true };
    // Tariffe mancanti (21/9): nessun documento, il messaggio dice dove mancano.
    if (d.errore) return { props: { client: d.client ? { id: d.client.id, name: d.client.name } : null, assessment: null, nmq: null, calc: null, date: today(), errore: d.errore } };
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
    // Testi in comune con la presentazione: zone, programma, Anno 2, leve economiche
    // (Enrico, 27/9: «deve essere tutto unico tra presentazione e preventivo»).
    const [{ getFirstMeeting }, { getOrgParams }, { testiCondivisi }, { leveEconomichePreventivo, leveEconomicheSlide }] = await Promise.all([
      import('../../lib/store'), import('../../lib/org'), import('../../lib/presentazione-server'), import('../../lib/leve'),
    ]);
    const fm = await getFirstMeeting(client.id).catch(() => null);
    const params = await getOrgParams().catch(() => ({ offertaGiorni }));
    const t = testiCondivisi({ client, d, fm, params });
    // Alla pagina solo ciò che mostra: niente leve d'impatto (28/9, restano nella presentazione).
    // Il Report di Attivazione di questo check-up: la proposta ne porta il prezzo (28/9).
    // Alla pagina solo data e prezzo, niente testo né dati interni del Report.
    const { ultimoReportAttivazione } = await import('../../lib/checkup-server');
    const rep = await ultimoReportAttivazione(client.id, assessment.created_at).catch(() => null);
    const reportAttivazione = rep ? { il: rep.created_at, prezzo: rep.quote_compliance && rep.quote_compliance.real_price != null ? rep.quote_compliance.real_price : null } : null;
    const condivisi = { zone: t.zone, piano: t.piano, anno2: t.anno2, leve: { economiche: leveEconomichePreventivo(t.leve.economiche, { conVoceOT23: t.nuovoProgramma }), slide: leveEconomicheSlide(t.leve.economiche) }, nuovoProgramma: t.nuovoProgramma, pacchetto: t.pacchetto };

    return {
      props: {
        client,
        assessment,
        nmq,
        calc,
        forchetta,
        tetto: tetto || null,
        // La popolazione usata QUI va passata al server quando si emette l'offerta:
        // il gate deve valutare esattamente il prezzo che sta per essere inviato.
        query: { assessmentId, n: n ?? null },
        date: today(),
        offertaGiorni,
        condivisi: JSON.parse(JSON.stringify(condivisi)),
        prezzo: JSON.parse(JSON.stringify(prezzo)),
        reportAttivazione,
      },
    };
  } catch (e) {
    console.error(e);
    return { notFound: true };
  }
});
