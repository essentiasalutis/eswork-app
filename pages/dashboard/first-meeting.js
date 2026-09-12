import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { requireAuthSsr } from '../../lib/auth';
import { calculatePricing, computeForchetta, calculateROI, getTier, tierIncludesL2Prevention, fmt } from '../../lib/calculator';
import { calculatePacchetto } from '../../lib/pricing/v2';
import { CONFIG } from '../../lib/config';
import NavMenu from '../../components/NavMenu';

const STEPS = ['Conosciamo l\'azienda', 'I numeri', 'Logistica', 'Preventivo'];
const SECTORS = [['services', 'Servizi / Uffici'], ['manufacturing', 'Manifattura'], ['mix', 'Mix']];
const SECTOR_TO_INT = { services: 2, manufacturing: 1, mix: 1 };
const DISTURBI = ['Mal di schiena', 'Cervicale', 'Spalle', 'Tunnel carpale', 'Dolori da postura prolungata', 'Dolori da movimentazione'];
const FATTURATO = [['low', '< 2 M€'], ['mid', '2–10 M€'], ['high', '> 10 M€']];
const HR = [['low', 'Bassa'], ['medium', 'Media'], ['high', 'Alta']];
const FASCE = ['Mattina', 'Pausa pranzo', 'Pomeriggio', 'Prima/dopo turno'];
const TIER_LABELS = { core: 'Core', plus: 'Plus', enterprise: 'Enterprise' };
const TIER_COLORS = { core: '#6b7280', plus: '#2563eb', enterprise: '#7c3aed' };
const fatturatoNum = b => (b === 'high' ? 11e6 : b === 'mid' ? 5e6 : 1e6);
const inputCls = 'w-full px-4 py-3 rounded-xl border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-green-500 bg-white';
const seg = (val, cur, set, label) => (
  <button key={val} type="button" onClick={() => set(val)}
    className={`flex-1 py-2.5 px-2 text-sm font-semibold rounded-xl transition-colors ${cur === val ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
);
// Divide i dipendenti in k sedi (parti uguali, il resto alle prime): usata dall'intake
// telefonico, dove si chiede solo "quante sedi". Nel colloquio completo si correggono una per una.
function dividiSedi(tot, k, prev = []) {
  const n = Math.max(0, parseInt(tot) || 0), m = Math.max(1, parseInt(k) || 1);
  const base = Math.floor(n / m), resto = n % m;
  return Array.from({ length: m }, (_, i) => ({
    nome: (prev[i] && prev[i].nome) || (i === 0 ? 'Sede principale' : `Sede ${i + 1}`),
    employees: base + (i < resto ? 1 : 0),
  }));
}
const RUOLI_DECISORE = ['Titolare', 'Responsabile HR', 'Direzione', 'Altro'];
// Binario commerciale: scelta MANUALE (decisione di Enrico, nessuna regola automatica).
const BINARI = [['A', 'A — titolare, micro/piccola'], ['B', 'B — HR/board, media/grande'], ['', 'Da decidere']];

// Campo con etichetta, riga di aiuto breve e - quando la spiegazione e' lunga - una
// nota che compare passando sopra la "i" (o toccandola dal telefono, dove il passaggio
// del mouse non esiste). La riga breve resta il promemoria, la nota spiega.
function Field({ label, hint, nota, children }) {
  const [notaAperta, setNotaAperta] = useState(false);
  return (
    <div>
      <div className="flex items-start gap-1.5 mb-1">
        <label className="block text-sm font-semibold text-gray-700">{label}</label>
        {nota && (
          <span className="relative group shrink-0 leading-none">
            <button type="button" onClick={() => setNotaAperta(v => !v)} aria-label={`Cosa si intende con ${label}`}
              className="w-4 h-4 rounded-full border border-gray-300 text-[10px] font-bold text-gray-400 hover:text-gray-700 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500">i</button>
            <span className={`${notaAperta ? 'block' : 'hidden group-hover:block'} absolute left-0 top-6 z-30 w-72 max-w-[80vw] text-xs leading-relaxed text-gray-100 bg-gray-900 rounded-xl px-3 py-2.5 shadow-xl`}>
              {nota}
            </span>
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}
function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-sm">
      <span className={`w-10 h-6 rounded-full transition-colors relative ${checked ? 'bg-green-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      <span className="text-gray-700">{label}</span>
    </button>
  );
}

export default function FirstMeetingScheda({ client: initialClient, meeting, v2Params, modoIniziale = 'completo' }) {
  const router = useRouter();
  const d = meeting?.data || {};
  const s1 = d.step1 || {}, s2 = d.step2 || {}, s3 = d.step3 || {}, sp = d.params || {};
  // Versione listino: dal record cliente (fail-safe v1); azienda nuova → v2.
  const pricingVersion = initialClient ? (initialClient.pricing_version || 'v1') : 'v2';
  const isV2 = pricingVersion === 'v2';

  const [clientId, setClientId] = useState(initialClient?.id || null);
  const [step, setStep] = useState(1);
  // Intake telefonico ('rapido') = una schermata con i sei dati per la Stima; stessi dati e
  // stesso salvataggio del colloquio completo, che al primo incontro li ritrova compilati.
  const [modo, setModo] = useState(modoIniziale);
  const [savedAt, setSavedAt] = useState(null);
  const [busy, setBusy] = useState(false);

  // STEP 1
  const [nome, setNome] = useState(initialClient?.name || s1.nome || '');
  const [refNome, setRefNome] = useState(s1.ref_nome || initialClient?.contact_name || '');
  const [refRuolo, setRefRuolo] = useState(s1.ref_ruolo || '');
  const [binario, setBinario] = useState(initialClient?.binario ?? s1.binario ?? '');
  const [refEmail, setRefEmail] = useState(s1.ref_email || initialClient?.contact_email || '');
  const [refTel, setRefTel] = useState(s1.ref_tel || initialClient?.contact_phone || '');
  const [workDesc, setWorkDesc] = useState(s1.work_desc || '');
  const [sector, setSector] = useState(s1.sector || 'services');
  const [disturbi, setDisturbi] = useState(s1.disturbi || []);
  const [disturbiAltro, setDisturbiAltro] = useState(s1.disturbi_altro || '');
  const [prevFatta, setPrevFatta] = useState(s1.prev_fatta || false);
  const [prevNote, setPrevNote] = useState(s1.prev_note || '');
  const [assenteismo, setAssenteismo] = useState(s1.assenteismo || false);
  const [absenceDays, setAbsenceDays] = useState(s1.absence_days ?? meeting?.absence_days ?? '');
  // Leve della presentazione (punto 7): facoltativi, "se lo sanno" — mai bloccanti.
  const [absenceDaysMsk, setAbsenceDaysMsk] = useState(s1.absence_days_msk ?? '');
  const [premioInail, setPremioInail] = useState(s1.premio_inail ?? '');
  const [note1, setNote1] = useState(s1.note || meeting?.notes || '');

  // STEP 2
  const [sedi, setSedi] = useState(s2.sedi || [{ nome: 'Sede principale', employees: initialClient?.employees || 50 }]);
  const [capienza, setCapienza] = useState(s2.capienza || CONFIG.classroom_capacity_default);
  const [trainingMode, setTrainingMode] = useState(s2.training_mode || 'per_sede');
  const [fatturato, setFatturato] = useState(s2.fatturato || 'mid');
  const [hrMaturity, setHrMaturity] = useState(s2.hr_maturity || 'medium');
  const [tierOverride, setTierOverride] = useState(s2.tier_override || null);

  // STEP 3
  const [spazio, setSpazio] = useState(s3.spazio || '');
  const [spazioNote, setSpazioNote] = useState(s3.spazio_note || '');
  const [fasce, setFasce] = useState(s3.fasce || []);
  const [mc, setMc] = useState(s3.mc || '');
  const [mcNome, setMcNome] = useState(s3.mc_nome || '');
  const [mcContatti, setMcContatti] = useState(s3.mc_contatti || '');
  const [esg, setEsg] = useState(s3.esg || false);
  const [refOpNome, setRefOpNome] = useState(s3.refop_nome || '');
  const [refOpRuolo, setRefOpRuolo] = useState(s3.refop_ruolo || '');
  const [refOpContatti, setRefOpContatti] = useState(s3.refop_contatti || '');

  // PARAMS della Stima
  const [rates, setRates] = useState(sp.rates || { ...CONFIG.rates_new });
  const [l2Mult, setL2Mult] = useState(sp.l2_mult ?? CONFIG.l2_multiplier_default);
  const [vatExempt, setVatExempt] = useState(sp.vat_exempt ?? CONFIG.vat_exempt);
  const [showParams, setShowParams] = useState(false);
  const [scenario, setScenario] = useState('avg');

  // v2: ergonomia a 3 voci (ufficio · addetti di reparto · postazioni tipo) + prodotto.
  // Il campo ufficio NON ha più regole invisibili: in automatico vale
  // "totale − addetti" e lo si vede; se lo si scrive a mano resta quel numero.
  // Colloqui salvati prima (ufficio null) → automatico, cioè come li leggeva la Stima.
  const [ergUffAuto, setErgUffAuto] = useState(s2.ergonomia_ufficio_auto ?? (s2.ergonomia_ufficio == null));
  const [ergUffManuale, setErgUffManuale] = useState(s2.ergonomia_ufficio != null ? String(s2.ergonomia_ufficio) : '');
  const [ergAddetti, setErgAddetti] = useState(s2.ergonomia_addetti != null ? String(s2.ergonomia_addetti) : '0');
  const [ergPostazioni, setErgPostazioni] = useState(s2.ergonomia_postazioni != null ? String(s2.ergonomia_postazioni) : '0');
  const [tipoProdotto, setTipoProdotto] = useState(initialClient?.tipo_prodotto || 'programma_completo');
  const [prodottoErr, setProdottoErr] = useState('');

  // ─── Derivati calcolatore ───────────────────────────────────────────────────
  const n = useMemo(() => sedi.reduce((a, e) => a + (parseInt(e.employees) || 0), 0), [sedi]);
  // Ergonomia: numeri ESPLICITI, sempre (vuoto = 0). Una sola lettura per anteprima,
  // salvataggio e Stima: niente più tre interpretazioni dello stesso campo.
  const nErgAddetti = Math.max(0, parseInt(ergAddetti) || 0);
  const nErgPostazioni = Math.max(0, parseInt(ergPostazioni) || 0);
  const nErgUfficio = ergUffAuto ? Math.max(0, n - nErgAddetti) : Math.max(0, parseInt(ergUffManuale) || 0);
  const ergAssegnati = nErgUfficio + nErgAddetti;
  const suggestedTier = useMemo(() => getTier(n, { fatturato: fatturatoNum(fatturato), hrMaturity }), [n, fatturato, hrMaturity]);
  const tier = tierOverride || suggestedTier;
  const groups = useMemo(() => {
    const cap = Math.max(1, parseInt(capienza) || 25);
    if (trainingMode === 'accorpa') return Math.max(1, Math.ceil(n / cap));
    return sedi.reduce((a, e) => a + Math.ceil((parseInt(e.employees) || 0) / cap), 0) || 1;
  }, [sedi, capienza, trainingMode, n]);
  const prev = CONFIG.l1_prevalence[sector] || [0.08, 0.13, 0.19];
  // Forbice unica (stessa funzione usata da pagina Stima / PDF / flag STEP 2),
  // instradata per versione listino (v2: parametri admin + ergonomia).
  const forchetta = useMemo(() => {
    const ergonomia = isV2 ? { nUfficio: nErgUfficio, nAddetti: nErgAddetti, nPostazioni: nErgPostazioni } : undefined;
    return computeForchetta({ n, sector, tier, groups, rates, vatExempt, l2Mult, pricingVersion, v2Params, ergonomia });
  }, [n, sector, tier, groups, rates, vatExempt, l2Mult, pricingVersion, v2Params, nErgUfficio, nErgAddetti, nErgPostazioni, isV2]);
  // Pacchetto prevenzione (v2, sotto soglia): prezzo dal motore, regole dure lato server.
  // Nessun tetto di dipendenti (decisione Enrico, 12/9): il pacchetto è un prodotto
  // diverso, non una versione ridotta per le piccole. Si può proporre a chiunque sia su listino v2.
  const pacchettoDisponibile = isV2 && n > 0;
  const pacchetto = useMemo(() => {
    if (!isV2 || tipoProdotto !== 'pacchetto_prevenzione') return null;
    const ergonomia = { nUfficio: nErgUfficio, nAddetti: nErgAddetti, nPostazioni: nErgPostazioni };
    return calculatePacchetto({ n, groups, rates, vatExempt, v2Params, ergonomia });
  }, [isV2, tipoProdotto, n, groups, rates, vatExempt, v2Params, nErgUfficio, nErgAddetti, nErgPostazioni]);
  const scen = forchetta;                 // {min, avg, max}, ognuno {pct, l1, l2, ...calcolo}
  const calcMin = forchetta.min, calcAvg = forchetta.avg, calcMax = forchetta.max;
  const calc = scenario === 'min' ? calcMin : scenario === 'max' ? calcMax : calcAvg;
  const sel = calc;                       // sel.l1 / sel.l2 invariati
  const roi = useMemo(() => calc ? calculateROI(calc.price_y1, parseInt(absenceDays) || 0) : null, [calc, absenceDays]);

  function buildData() {
    return {
      step1: { nome, ref_nome: refNome, ref_ruolo: refRuolo, binario: binario || null, ref_email: refEmail, ref_tel: refTel, work_desc: workDesc, sector, disturbi, disturbi_altro: disturbiAltro, prev_fatta: prevFatta, prev_note: prevNote, assenteismo, absence_days: absenceDays, absence_days_msk: absenceDaysMsk, premio_inail: premioInail, note: note1 },
      step2: { sedi, capienza, training_mode: trainingMode, fatturato, hr_maturity: hrMaturity, tier_override: tierOverride, tier, ergonomia_ufficio: nErgUfficio, ergonomia_ufficio_auto: ergUffAuto, ergonomia_addetti: nErgAddetti, ergonomia_postazioni: nErgPostazioni },
      step3: { spazio, spazio_note: spazioNote, fasce, mc, mc_nome: mcNome, mc_contatti: mcContatti, esg, refop_nome: refOpNome, refop_ruolo: refOpRuolo, refop_contatti: refOpContatti },
      params: { rates, l2_mult: l2Mult, vat_exempt: vatExempt },
    };
  }

  async function ensureClient() {
    if (clientId) return clientId;
    if (!nome.trim()) return null;
    const res = await fetch('/api/clients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nome.trim(), sector: SECTOR_TO_INT[sector] || 1, employees: n || 50, contact_name: refNome || null, contact_email: refEmail || null, contact_phone: refTel || null, source: 'colloquio' }),
    });
    if (!res.ok) return null;
    const c = await res.json();
    setClientId(c.id);
    router.replace(`/dashboard/first-meeting?clientId=${c.id}${modo === 'rapido' ? '&modo=rapido' : ''}`, undefined, { shallow: true });
    return c.id;
  }

  async function save({ silent } = {}) {
    const id = await ensureClient();
    if (!id) return false;
    if (!silent) setBusy(true);
    try {
      await fetch(`/api/first-meeting/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: buildData(), employees: n || null, sector: SECTOR_TO_INT[sector], absence_days: absenceDays || null, num_locations: sedi.length }),
      });
      setSavedAt(Date.now());
    } catch {}
    if (!silent) setBusy(false);
    return true;
  }

  // Intake telefonico: crea l'azienda da sola appena ci sono nome e dipendenti, poi
  // l'autosave qui sotto la aggiorna. Al telefono non si deve ricordare di premere "Salva".
  useEffect(() => {
    if (modo !== 'rapido' || clientId || nome.trim().length < 2 || n <= 0) return;
    const t = setTimeout(() => save({ silent: true }), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, clientId, nome, n]);

  // Autosave debounce (solo se cliente già creato)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (!clientId) return;
    const t = setTimeout(() => save({ silent: true }), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome, refNome, refRuolo, refEmail, refTel, workDesc, sector, disturbi, disturbiAltro, prevFatta, prevNote, assenteismo, absenceDays, absenceDaysMsk, premioInail, note1, sedi, capienza, trainingMode, fatturato, hrMaturity, tierOverride, spazio, spazioNote, fasce, mc, mcNome, mcContatti, esg, refOpNome, refOpRuolo, refOpContatti, rates, l2Mult, vatExempt, ergUffAuto, ergUffManuale, ergAddetti, ergPostazioni, binario]);

  function toggleArr(arr, set, v) { set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]); }
  function setSede(i, k, v) { setSedi(prev => prev.map((s, j) => j === i ? { ...s, [k]: k === 'employees' ? (v === '' ? '' : Math.max(0, parseInt(v) || 0)) : v } : s)); }

  async function goToStima() {
    const id = await ensureClient();
    await save({ silent: true });
    // Passa gli input: la Stima ricalcola la FORBICE (3 scenari) con computeForchetta
    // a partire da settore + condizioni → stessi numeri della scheda colloquio.
    const params = new URLSearchParams({
      clientId: id || '', name: nome || '', contact: refNome || '',
      sector, n: String(n), tier, groups: String(groups), vat: vatExempt ? '1' : '0', l2mult: String(l2Mult),
      rs: String(rates.sportello_sell), rsc: String(rates.sportello_cost),
      rps: String(rates.prevalidation_sell), rpc: String(rates.prevalidation_cost),
      rts: String(rates.training_sell), rtc: String(rates.training_cost),
    });
    // v2: input ergonomia + prodotto (la versione resta risolta SERVER-side dal clientId)
    if (isV2) {
      params.set('ergu', String(nErgUfficio));
      params.set('erga', String(nErgAddetti));
      params.set('ergp', String(nErgPostazioni));
      if (tipoProdotto === 'pacchetto_prevenzione') params.set('prodotto', 'pacchetto_prevenzione');
    }
    router.push(`/dashboard/stima?${params}`);
  }

  // Scelta prodotto (binaria, al colloquio): persistita su clients con REGOLE
  // DURE lato server (soglia + versione). La UI nasconde l'opzione sopra soglia,
  // ma è l'API a fare fede.
  async function scegliProdotto(nuovo) {
    setProdottoErr('');
    const id = await ensureClient();
    if (!id) { setProdottoErr('Salva prima i dati azienda (nome)'); return; }
    const prevVal = tipoProdotto;
    setTipoProdotto(nuovo);
    const r = await fetch(`/api/clients/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo_prodotto: nuovo, employees: n || undefined }) });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setTipoProdotto(prevVal);
      setProdottoErr(j.error || 'Scelta non consentita');
    }
  }
  async function goStep(next) { if (next > step) await save({ silent: true }); setStep(next); window.scrollTo({ top: 0 }); }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href={clientId ? `/dashboard/${clientId}` : '/dashboard'} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate">{modo === 'rapido' ? 'Intake telefonico' : 'Scheda colloquio'}</div>
            <div className="text-xs text-gray-500">{nome || 'Nuova azienda'}{savedAt && <span className="text-green-600 ml-2">✓ salvato</span>}</div>
          </div>
          <NavMenu />
        </div>
        <div className="max-w-4xl mx-auto px-5 pb-2 flex gap-1 text-xs">
          {[['rapido', '📞 Telefonata'], ['completo', '📋 Colloquio completo']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => { setModo(v); if (v === 'completo') setStep(1); }}
              className={`px-3 py-1.5 rounded-lg font-semibold ${modo === v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
          ))}
        </div>
        <div className={`max-w-4xl mx-auto px-5 pb-3 flex gap-2 ${modo === 'rapido' ? 'hidden' : ''}`}>
          {STEPS.map((label, i) => (
            <button key={i} onClick={() => goStep(i + 1)} className={`flex-1 text-left ${step === i + 1 ? '' : 'opacity-60'}`}>
              <div className={`h-1.5 rounded-full mb-1 ${i + 1 <= step ? 'bg-green-500' : 'bg-gray-200'}`} />
              <div className={`text-[11px] font-semibold ${step === i + 1 ? 'text-green-700' : 'text-gray-400'}`}>{i + 1}. {label}</div>
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-5 space-y-5">
        {modo === 'rapido' && (
          <div className="space-y-5">
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              I dati per la Stima, mentre sei al telefono. Si salvano da soli. Il resto lo completi al primo incontro nel colloquio completo, dove ritrovi già compilato quello che scrivi qui.
            </p>
            <Field label="Nome azienda *"><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Es. Acme S.p.A." className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dipendenti *" nota="Il totale dichiarato dall’azienda, tutte le sedi comprese. È il numero da cui discende tutto: fascia di prezzo, gruppi di formazione, ergonomia d’ufficio, dimensionamento dello sportello.">
                <input type="number" min="1" value={n || ''} onChange={e => setSedi(dividiSedi(e.target.value, sedi.length, sedi))} className={inputCls} />
              </Field>
              <Field label="Settore *" nota="Come è fatta la popolazione: produzione, uffici o mista. Inquadra la lettura dei disturbi nei documenti e il linguaggio del colloquio; non cambia il prezzo.">
                <select value={sector} onChange={e => setSector(e.target.value)} className={inputCls}>
                  {SECTORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Di cui in reparto" hint={`in ufficio: ${nErgUfficio}`} nota="Quante persone lavorano in produzione, magazzino o officina invece che alla scrivania. Le altre contano come ufficio e ricevono l’ergonomia individuale alla loro postazione; chi sta in reparto viene invece formato sulla postazione tipo del suo lavoro.">
                <input type="number" min="0" value={ergAddetti} onChange={e => setErgAddetti(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Sedi" hint="dipendenti divisi in parti uguali" nota="Quante sedi operative diverse. Qui i dipendenti vengono divisi in parti uguali fra le sedi per avere subito un ordine di grandezza: i numeri veri per sede si sistemano nel colloquio completo. Più sedi significa più giornate in trasferta.">
                <input type="number" min="1" value={sedi.length} onChange={e => setSedi(dividiSedi(n, e.target.value, sedi))} className={inputCls} />
              </Field>
              <Field label="Postazioni tipo" hint="quanti tipi di postazione, non quante scrivanie" nota="Quanti MODELLI di postazione esistono in reparto: la linea di assemblaggio, il banco di saldatura, il carrello del picking. Ogni modello si studia una volta sola, a forfait, e poi gli addetti vengono formati su quello. Venticinque persone su tre tipi di postazione fanno 3, non 25.">
                <input type="number" min="0" value={ergPostazioni} onChange={e => setErgPostazioni(e.target.value)} className={inputCls} />
              </Field>
            </div>
            {nErgAddetti > 0 && (parseInt(ergPostazioni) || 0) === 0 && (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                Ci sono {nErgAddetti} persone in reparto ma nessuna postazione tipo: lo studio della postazione resta fuori dalla Stima, e gli addetti verrebbero formati su una postazione mai osservata. Se non sai quante sono, mettine una: il conteggio si chiude al sopralluogo.
              </div>
            )}
            <Field label="Giorni di malattia l'anno" hint="se li conoscono" nota="Giornate di assenza per malattia in un anno, su tutta l’azienda. Se non lo sanno, lascia vuoto: la leva sul costo delle assenze non viene mostrata, invece di appoggiarsi a un numero inventato.">
              <input type="number" min="0" value={absenceDays} onChange={e => { setAbsenceDays(e.target.value); setAssenteismo(e.target.value !== '' && +e.target.value > 0); }} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="di cui per disturbi muscolo-scheletrici" hint="se lo sanno">
                <input type="number" min="0" value={absenceDaysMsk} onChange={e => setAbsenceDaysMsk(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Premio INAIL annuo (€)" hint="se lo sanno" nota="Quanto versano all’INAIL in un anno. Serve a tradurre lo sconto OT23 in euro: senza, resta solo la percentuale e la leva pesa molto meno.">
                <input type="number" min="0" value={premioInail} onChange={e => setPremioInail(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Decisore — nome"><input value={refNome} onChange={e => setRefNome(e.target.value)} className={inputCls} /></Field>
              <Field label="Ruolo">
                <select value={refRuolo} onChange={e => setRefRuolo(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {[...RUOLI_DECISORE, ...(refRuolo && !RUOLI_DECISORE.includes(refRuolo) ? [refRuolo] : [])].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Binario" hint="lo decidi tu, capendo chi hai di fronte" nota="A: decide una persona sola, di solito il titolare - si firma prima del check-up e l’offerta ha una scadenza. B: la decisione passa da HR o direzione - prima il check-up, poi la proposta, con Lettera di incarico e offerta senza scadenza.">
                <div className="flex gap-1">
                  {BINARI.map(([v, l]) => (
                    <button key={v || 'nd'} type="button" onClick={() => setBinario(v)}
                      className={`flex-1 py-2.5 px-2 text-xs font-semibold rounded-xl ${binario === v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
                  ))}
                </div>
              </Field>
            <Field label="Email del referente" hint="serve per inviare la Stima"><input type="email" value={refEmail} onChange={e => setRefEmail(e.target.value)} className={inputCls} /></Field>

            {n > 0 && (
              <div className="bg-green-600 rounded-2xl p-5 text-white">
                <div className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">Stima di investimento — Anno 1</div>
                <div className="text-3xl font-bold">{fmt(forchetta.min.price_y1)} – {fmt(forchetta.max.price_y1)}</div>
                <div className="text-sm opacity-90 mt-1">scenario medio {fmt(forchetta.avg.price_y1)} · si aggiorna mentre scrivi</div>
              </div>
            )}
            {isV2 && forchetta?.avg?.y1?.ergonomia_sotto_minimo && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">⚠ Ergonomia sotto il minimo fatturabile ({v2Params?.ergonomia_minimo_ore ?? 4}h): accorpare ad altra attività in sede.</div>
            )}
            <button onClick={goToStima} disabled={!nome.trim() || n <= 0}
              className="w-full py-3.5 rounded-2xl bg-green-600 text-white font-bold disabled:opacity-50">Genera Stima di investimento →</button>
            <button type="button" onClick={() => { setModo('completo'); setStep(1); window.scrollTo({ top: 0 }); }}
              className="w-full py-3 rounded-2xl border border-gray-300 text-gray-700 font-semibold">Continua col colloquio completo →</button>
          </div>
        )}

        {modo === 'completo' && step === 1 && (
          <div className="space-y-5">
            <Field label="Nome azienda *"><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Es. Acme S.p.A." className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Referente — nome *"><input value={refNome} onChange={e => setRefNome(e.target.value)} placeholder="Mario Rossi" className={inputCls} /></Field>
              <Field label="Referente — ruolo *"><input value={refRuolo} onChange={e => setRefRuolo(e.target.value)} placeholder="HR / Direzione / Titolare" className={inputCls} /></Field>
            </div>
            <Field label="Binario" hint="lo decidi tu, capendo chi hai di fronte">
                <div className="flex gap-1">
                  {BINARI.map(([v, l]) => (
                    <button key={v || 'nd'} type="button" onClick={() => setBinario(v)}
                      className={`flex-1 py-2.5 px-2 text-xs font-semibold rounded-xl ${binario === v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
                  ))}
                </div>
              </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email referente"><input value={refEmail} onChange={e => setRefEmail(e.target.value)} placeholder="email@azienda.it" className={inputCls} /></Field>
              <Field label="Telefono referente"><input value={refTel} onChange={e => setRefTel(e.target.value)} placeholder="333…" className={inputCls} /></Field>
            </div>
            <Field label="Che tipo di lavoro fanno i dipendenti?" hint="Descrizione libera dalla conversazione">
              <textarea value={workDesc} onChange={e => setWorkDesc(e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder="Es. linea di montaggio, magazzino, uffici…" />
              <div className="mt-2"><div className="text-xs text-gray-400 mb-1">Classificazione settore (uso interno, per la prevalenza):</div><div className="flex gap-2">{SECTORS.map(([v, l]) => seg(v, sector, setSector, l))}</div></div>
            </Field>
            <Field label="Che disturbi fisici vedete tra i dipendenti?">
              <div className="flex flex-wrap gap-2">{DISTURBI.map(dz => (
                <button key={dz} type="button" onClick={() => toggleArr(disturbi, setDisturbi, dz)} className={`px-3 py-1.5 rounded-full border text-sm ${disturbi.includes(dz) ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 text-gray-600'}`}>{dz}</button>
              ))}</div>
              <input value={disturbiAltro} onChange={e => setDisturbiAltro(e.target.value)} placeholder="Altro…" className={inputCls + ' mt-2'} />
            </Field>
            <Field label="Avete già fatto qualcosa in prevenzione/benessere?">
              <Toggle checked={prevFatta} onChange={setPrevFatta} label={prevFatta ? 'Sì' : 'No'} />
              {prevFatta && <textarea value={prevNote} onChange={e => setPrevNote(e.target.value)} rows={2} className={inputCls + ' resize-none mt-2'} placeholder="Cosa e com'è andato…" />}
            </Field>
            <Field label="L'assenteismo è un problema visibile?">
              <Toggle checked={assenteismo} onChange={setAssenteismo} label={assenteismo ? 'Sì' : 'No'} />
              {assenteismo && <div className="mt-2"><div className="text-xs text-gray-400 mb-1">Giorni assenza malattia ultimi 12 mesi (per ROI)</div><input type="number" value={absenceDays} onChange={e => setAbsenceDays(e.target.value)} placeholder="es. 120" className={inputCls} /></div>}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="di cui per disturbi muscolo-scheletrici" hint="se lo sanno">
                <input type="number" min="0" value={absenceDaysMsk} onChange={e => setAbsenceDaysMsk(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Premio INAIL annuo (€)" hint="se lo sanno">
                <input type="number" min="0" value={premioInail} onChange={e => setPremioInail(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Note del colloquio"><textarea value={note1} onChange={e => setNote1(e.target.value)} rows={4} className={inputCls + ' resize-none'} placeholder="Appunti liberi…" /></Field>
            <button onClick={() => goStep(2)} disabled={!nome.trim()} className="w-full py-3.5 rounded-2xl bg-green-600 text-white font-bold disabled:opacity-40">Avanti →</button>
          </div>
        )}

        {modo === 'completo' && step === 2 && (
          <div className="space-y-5">
            <Field label="Sedi operative" hint="Numero dipendenti per sede (il totale alimenta tier e calcolo)">
              <div className="space-y-2">{sedi.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={s.nome} onChange={e => setSede(i, 'nome', e.target.value)} placeholder={`Sede ${i + 1}`} className={inputCls + ' flex-1'} />
                  <input type="number" value={s.employees} onChange={e => setSede(i, 'employees', e.target.value)} placeholder="dip." className={inputCls + ' w-24'} />
                  {sedi.length > 1 && <button onClick={() => setSedi(sedi.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 px-1 text-lg">×</button>}
                </div>
              ))}</div>
              <button onClick={() => setSedi([...sedi, { nome: '', employees: 0 }])} className="mt-2 text-xs font-semibold text-green-700">+ Aggiungi sede</button>
              <div className="text-xs text-gray-400 mt-1">Totale dipendenti: <strong className="text-gray-600">{n}</strong> · gruppi formazione: <strong className="text-gray-600">{groups}</strong></div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Capienza aula/sala" nota="Quante persone entrano nello spazio che l’azienda mette a disposizione per la formazione. Decide in quanti gruppi si spezza il corso: una sala da 15 con 40 dipendenti significa tre sessioni, non una."><input type="number" value={capienza} onChange={e => setCapienza(e.target.value)} className={inputCls} /></Field>
              <Field label="Formazione"><div className="flex gap-1">{seg('per_sede', trainingMode, setTrainingMode, 'Per sede')}{seg('accorpa', trainingMode, setTrainingMode, 'Accorpa')}</div></Field>
            </div>
            {isV2 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <div className="text-sm font-semibold text-gray-700">🪑 Consulenza ergonomico-posturale</div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Dipendenti ufficio" hint={ergUffAuto ? `automatico: ${n} − addetti · ${v2Params?.ergonomia_minuti_persona ?? 5}′ a persona` : `scritto a mano · ${v2Params?.ergonomia_minuti_persona ?? 5}′ a persona`}>
                    <input type="number" min="0" value={nErgUfficio} onChange={e => { setErgUffAuto(false); setErgUffManuale(e.target.value); }} className={inputCls} />
                    {!ergUffAuto && (
                      <button type="button" onClick={() => setErgUffAuto(true)} className="text-[11px] text-blue-600 hover:underline mt-1">↺ torna automatico</button>
                    )}
                  </Field>
                  <Field label="Addetti di reparto" hint={`formati sulla propria postazione · ${v2Params?.ergonomia_minuti_addetto ?? 5}′ a persona`}>
                    <input type="number" min="0" value={ergAddetti} onChange={e => setErgAddetti(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Postazioni tipo (reparto)" hint={`studio a forfait €${v2Params?.ergonomia_forfait_postazione ?? 120} · conteggio definitivo al sopralluogo`}>
                    <input type="number" min="0" value={ergPostazioni} onChange={e => setErgPostazioni(e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <div className={`text-xs rounded-xl px-3 py-2 border ${ergAssegnati > n ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                  Assegnati <strong>{ergAssegnati}</strong> su {n} dipendenti (ufficio {nErgUfficio} + reparto {nErgAddetti})
                  {ergAssegnati > n ? ' — più persone che dipendenti: controlla i numeri.' : ergAssegnati < n ? ` · ${n - ergAssegnati} senza consulenza ergonomica` : ''}
                </div>
                {forchetta?.avg?.y1?.ergonomia_sotto_minimo && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    ⚠ Ergonomia sotto il minimo fatturabile ({v2Params?.ergonomia_minimo_ore ?? 4}h): accorpare ad altra attività in sede. (Solo avviso, non blocca.)
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fatturato" hint="Dirime i borderline del tier" nota="Ordine di grandezza del fatturato. Non entra nel prezzo: serve solo quando il numero di dipendenti lascia in dubbio la configurazione, per capire che azienda si ha davanti."><div className="flex gap-1">{FATTURATO.map(([v, l]) => seg(v, fatturato, setFatturato, l))}</div></Field>
              <Field label="Maturità HR"><div className="flex gap-1">{HR.map(([v, l]) => seg(v, hrMaturity, setHrMaturity, l))}</div></Field>
            </div>
            <Field label="Tier interno (uso interno, non mostrato al cliente)" nota="Nome interno della configurazione: non compare in nessun documento che legge il cliente. Serve a te per sapere quali servizi stai dimensionando.">
              <div className="flex items-center gap-2">{['core', 'plus', 'enterprise'].map(t => (
                <button key={t} onClick={() => setTierOverride(t === suggestedTier ? null : t)} className="flex-1 py-2 rounded-xl border-2 text-sm font-semibold" style={{ borderColor: TIER_COLORS[t], background: tier === t ? TIER_COLORS[t] : '#fff', color: tier === t ? '#fff' : TIER_COLORS[t] }}>{TIER_LABELS[t]}</button>
              ))}</div>
              <div className="text-xs text-gray-400 mt-1">Suggerito: <strong>{TIER_LABELS[suggestedTier]}</strong>{tierOverride && ' · override attivo'} · Core ≤150 · Plus 151-500 · Enterprise &gt;500</div>
            </Field>
            <div className="flex gap-3">
              <button onClick={() => goStep(1)} className="py-3.5 px-5 rounded-2xl border border-gray-300 text-gray-600 font-semibold">←</button>
              <button onClick={() => goStep(3)} className="flex-1 py-3.5 rounded-2xl bg-green-600 text-white font-bold">Avanti →</button>
            </div>
          </div>
        )}

        {modo === 'completo' && step === 3 && (
          <div className="space-y-5">
            <Field label="Avete uno spazio in sede per lo sportello? *" nota="Serve una stanza chiusa dove lavorare in privato, con spazio per un lettino. Senza, lo sportello in sede non è erogabile e il programma va ripensato: è la domanda che può far saltare tutto il resto.">
              <div className="flex flex-col gap-2">{[['dedicata', 'Sì, stanza dedicata'], ['condivisa', 'Sì, sala condivisa'], ['da_trovare', 'No, da trovare']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setSpazio(v)} className={`py-2.5 px-4 rounded-xl border-2 text-sm font-semibold text-left ${spazio === v ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>{l}</button>
              ))}</div>
              <input value={spazioNote} onChange={e => setSpazioNote(e.target.value)} placeholder="Dimensioni, privacy, attrezzatura…" className={inputCls + ' mt-2'} />
            </Field>
            <Field label="Fasce orarie preferite"><div className="flex flex-wrap gap-2">{FASCE.map(f => (
              <button key={f} type="button" onClick={() => toggleArr(fasce, setFasce, f)} className={`px-3 py-1.5 rounded-full border text-sm ${fasce.includes(f) ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 text-gray-600'}`}>{f}</button>
            ))}</div></Field>
            <Field label="Avete un Medico Competente attivo?" nota="Se c’è, è l’interlocutore tecnico da coinvolgere presto: il programma è volontario e complementare alla sorveglianza sanitaria, non la sostituisce. Un medico competente informato è un alleato; scoperto all’ultimo, è un ostacolo.">
              <div className="flex gap-2">{[['si', 'Sì'], ['no', 'No'], ['nonso', 'Non so']].map(([v, l]) => seg(v, mc, setMc, l))}</div>
              {mc === 'si' && <div className="grid grid-cols-2 gap-3 mt-2"><input value={mcNome} onChange={e => setMcNome(e.target.value)} placeholder="Nome MC" className={inputCls} /><input value={mcContatti} onChange={e => setMcContatti(e.target.value)} placeholder="Contatti" className={inputCls} /></div>}
            </Field>
            <Field label="Sensibilità ESG / bilancio di sostenibilità?"><Toggle checked={esg} onChange={setEsg} label={esg ? 'Sì' : 'No'} /></Field>
            <Field label="Referente operativo" hint="Chi gestirà comunicazione interna e logistica (può differire dal decisore)">
              <div className="grid grid-cols-2 gap-3"><input value={refOpNome} onChange={e => setRefOpNome(e.target.value)} placeholder="Nome" className={inputCls} /><input value={refOpRuolo} onChange={e => setRefOpRuolo(e.target.value)} placeholder="Ruolo" className={inputCls} /></div>
              <input value={refOpContatti} onChange={e => setRefOpContatti(e.target.value)} placeholder="Contatti" className={inputCls + ' mt-2'} />
            </Field>
            <div className="flex gap-3">
              <button onClick={() => goStep(2)} className="py-3.5 px-5 rounded-2xl border border-gray-300 text-gray-600 font-semibold">←</button>
              <button onClick={() => goStep(4)} className="flex-1 py-3.5 rounded-2xl bg-green-600 text-white font-bold">Vai alla Stima di investimento →</button>
            </div>
          </div>
        )}

        {modo === 'completo' && step === 4 && (
          <div className="space-y-4">
            {n <= 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">Inserisci i dipendenti nello Step 2 per calcolare la Stima.</div>
            ) : (
              <>
                {/* v2: scelta prodotto (binaria, al colloquio). L'opzione pacchetto
                    compare SOLO sotto soglia; il rifiuto vero è comunque lato server. */}
                {isV2 && pacchettoDisponibile && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Prodotto</div>
                    <div className="flex gap-2">
                      {seg('programma_completo', tipoProdotto, scegliProdotto, 'Programma completo')}
                      {seg('pacchetto_prevenzione', tipoProdotto, scegliProdotto, 'Pacchetto prevenzione')}
                    </div>
                    {prodottoErr && <div className="text-xs text-red-600 mt-2">{prodottoErr}</div>}
                  </div>
                )}
                {isV2 && tipoProdotto === 'pacchetto_prevenzione' && pacchetto ? (
                  <>
                    <div className="bg-blue-600 rounded-2xl p-5 text-white">
                      <div className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">Pacchetto prevenzione — 12 mesi, non rinnovabile</div>
                      <div className="text-4xl font-bold mb-1">{fmt(pacchetto.price)}</div>
                      <div className="text-sm opacity-90">Formazione {fmt(pacchetto.training.sell)} · Ergonomia {fmt(pacchetto.ergonomia.sell)} · Check-up {fmt(pacchetto.assessment.sell)}</div>
                      <div className="text-xs opacity-80 mt-1">Include check-up completo (consensi identici al programma), formazione 2 moduli, ergonomia. ESCLUDE cicli L1, prevenzione L2 e buffer clinico.</div>
                    </div>
                    {pacchetto.ergonomia_sotto_minimo && (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">⚠ Ergonomia sotto il minimo fatturabile: accorpare ad altra attività in sede (solo avviso).</div>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => goStep(3)} className="py-3.5 px-5 rounded-2xl border border-gray-300 text-gray-600 font-semibold">←</button>
                      <button onClick={() => save()} disabled={busy} className="py-3.5 px-5 rounded-2xl border border-gray-300 text-gray-700 font-semibold disabled:opacity-50">{busy ? '…' : 'Salva scheda'}</button>
                      <button onClick={goToStima} className="flex-1 py-3.5 rounded-2xl bg-blue-600 text-white font-bold">Genera Stima pacchetto →</button>
                    </div>
                  </>
                ) : (
                <>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Scenario di prevalenza — Anno 1</div>
                  <div className="flex gap-2">{[['min', 'Min', scen.min, calcMin], ['avg', 'Medio', scen.avg, calcAvg], ['max', 'Max', scen.max, calcMax]].map(([k, lbl, sc, cc]) => cc && (
                    <button key={k} onClick={() => setScenario(k)} className={`flex-1 rounded-2xl border-2 p-3 text-left ${scenario === k ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}`}>
                      <div className={`text-[11px] font-bold uppercase ${scenario === k ? 'text-green-700' : 'text-gray-400'}`}>{lbl}</div>
                      <div className={`text-lg font-bold ${scenario === k ? 'text-green-700' : 'text-gray-800'}`}>{fmt(cc.price_y1)}</div>
                      <div className="text-[11px] text-gray-500">{sc.l1} L1 · {sc.l2} L2</div>
                    </button>
                  ))}</div>
                  <div className="text-[11px] text-gray-400 mt-2 text-center">Prevalenza {sector === 'services' ? 'Servizi' : sector === 'manufacturing' ? 'Manifattura' : 'Mix'}: {prev.map(p => `${Math.round(p * 100)}%`).join(' / ')} · L2 ≈ {l2Mult}× L1</div>
                </div>

                <div className="bg-green-600 rounded-2xl p-5 text-white">
                  <div className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">Investimento Anno 1 — scenario {scenario === 'avg' ? 'medio' : scenario}</div>
                  <div className="text-4xl font-bold mb-1">{fmt(calc.price_y1)}</div>
                  <div className="text-sm opacity-90">{fmt(calc.price_monthly_y1)}/mese · {fmt(calc.price_per_employee_y1)}/dip · {sel.l1} L1{tierIncludesL2Prevention(tier) ? ` · ${sel.l2} L2 prevenzione` : ''}</div>
                  <div className="text-xs opacity-80 mt-1">{vatExempt ? 'Esente IVA (forfettario)' : `+ IVA 22% = ${fmt(calc.y1.total_with_vat)}`}</div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Dettaglio voci — Anno 1</div>
                  <table className="w-full text-sm"><tbody>
                    {calc.y1.items.map((it, i) => (<tr key={i} className="border-b border-gray-50"><td className="py-2 text-gray-600">{it.label}<span className="block text-[11px] text-gray-400">{it.detail}</span></td><td className="py-2 text-right font-medium text-gray-700">{fmt(it.sell)}</td></tr>))}
                    <tr className="border-b border-gray-50"><td className="py-2 text-gray-600">Buffer {Math.round(calc.y1.buffer_pct * 100)}%</td><td className="py-2 text-right font-medium text-gray-700">{fmt(calc.y1.buffer_sell)}</td></tr>
                    <tr className="border-t-2 border-gray-200"><td className="py-2 font-semibold text-gray-800">Totale Anno 1</td><td className="py-2 text-right font-bold text-green-700">{fmt(calc.y1.total_sell)}</td></tr>
                  </tbody></table>
                  <div className="text-[11px] text-gray-400 mt-2">Costo professionista {fmt(calc.y1.total_cost)} · margine {fmt(calc.y1.margin)} — uso interno</div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Anno 2 e successivi (indicativo)</div>
                  <div className="text-2xl font-bold text-blue-700">{fmt(calc.price_y2)}</div>
                  <div className="text-xs text-blue-500 mt-1">Formazione 1 modulo · nuovi L1 trattati{tierIncludesL2Prevention(tier) ? ' · L2 in prevenzione' : ''}</div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 leading-relaxed">
                  <strong>Clausola di adeguamento:</strong> il corrispettivo è confermato dopo il check-up. Se i L1 reali sono ≤ scenario medio ({scen.avg.l1}) → resta al valore medio ({fmt(calcAvg.price_y1)}); se superiori → sale fino al tetto massimo ({fmt(calcMax.price_y1)}), eccedenza al canale B2C/welfare.
                </div>

                {roi && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 text-sm text-gray-700 space-y-1.5">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">ROI ({absenceDays} gg assenza)</div>
                    <div className="flex justify-between"><span>Costo assenze stimato</span><span className="font-semibold">{fmt(roi.estimated_cost)}</span></div>
                    <div className="flex justify-between"><span>Riduzione per break-even</span><span className="font-semibold text-amber-700">{roi.breakeven_pct}%</span></div>
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <button onClick={() => setShowParams(v => !v)} className="w-full flex items-center justify-between px-4 py-3"><span className="text-sm font-semibold text-gray-700">⚙️ Parametri della Stima</span><span className="text-gray-400">{showParams ? '▲' : '▼'}</span></button>
                  {showParams && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                      <div className="text-[11px] text-gray-400">Tariffe cliente (modificabili liberamente per questo cliente).</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">{[['sportello_sell', 'Sportello €/h vend.'], ['sportello_cost', 'Sportello €/h costo'], ['prevalidation_sell', 'Pre-val € vend.'], ['prevalidation_cost', 'Pre-val € costo'], ['training_sell', 'Formaz. €/mod vend.'], ['training_cost', 'Formaz. €/mod costo']].map(([k, l]) => (
                        <div key={k}><label className="text-[11px] text-gray-500 block mb-1">{l}</label><input type="number" value={rates[k]} onChange={e => setRates(r => ({ ...r, [k]: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
                      ))}</div>
                      <div className="grid grid-cols-2 gap-3 items-end">
                        <div>
                          <label className="text-[11px] text-gray-500 mb-1 flex items-center gap-1">
                            Moltiplicatore L2 (da tarare)
                            <span title="Stima dei Livello 2 attesi = L1 attesi × questo moltiplicatore. Nel listino v2 incide SEMPRE sul prezzo: i Livello 2 ricevono prevenzione attiva in ogni configurazione. È un'ipotesi: il numero reale di L2 emerge dopo il check-up (questionario NMQ)."
                              className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center cursor-help">?</span>
                          </label>
                          <input type="number" step="0.1" value={l2Mult} onChange={e => setL2Mult(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-600 pb-2"><input type="checkbox" checked={vatExempt} onChange={e => setVatExempt(e.target.checked)} className="w-4 h-4 accent-green-600" />Esente IVA</label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => goStep(3)} className="py-3.5 px-5 rounded-2xl border border-gray-300 text-gray-600 font-semibold">←</button>
                  <button onClick={() => save()} disabled={busy} className="py-3.5 px-5 rounded-2xl border border-gray-300 text-gray-700 font-semibold disabled:opacity-50">{busy ? '…' : 'Salva scheda'}</button>
                  <button onClick={goToStima} className="flex-1 py-3.5 rounded-2xl bg-green-600 text-white font-bold">Genera Stima →</button>
                </div>
                </>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => {
  const { getClientById, getFirstMeeting } = require('../../lib/store');
  const { getPricingSettingsV2 } = require('../../lib/pricing/settings');
  const { clientId } = ctx.query;
  // Parametri v2 sempre in props: un'azienda nuova (senza record) nasce v2.
  const { params: v2Params } = await getPricingSettingsV2();
  // Modalità: ?modo=rapido esplicito, altrimenti azienda nuova → intake telefonico,
  // azienda esistente → colloquio completo (si cambia dall'interruttore in alto).
  const modoIniziale = ctx.query.modo === 'rapido' || !clientId ? 'rapido' : 'completo';
  if (!clientId) return { props: { client: null, meeting: null, v2Params, modoIniziale } };
  const [client, meeting] = await Promise.all([getClientById(clientId), getFirstMeeting(clientId)]);
  if (!client) return { notFound: true };
  return { props: { client, meeting: meeting || null, v2Params, modoIniziale } };
});
