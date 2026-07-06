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
function Field({ label, hint, children }) {
  return <div><label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>{hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}{children}</div>;
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

export default function FirstMeetingScheda({ client: initialClient, meeting, v2Params }) {
  const router = useRouter();
  const d = meeting?.data || {};
  const s1 = d.step1 || {}, s2 = d.step2 || {}, s3 = d.step3 || {}, sp = d.params || {};
  // Versione listino: dal record cliente (fail-safe v1); azienda nuova → v2.
  const pricingVersion = initialClient ? (initialClient.pricing_version || 'v1') : 'v2';
  const isV2 = pricingVersion === 'v2';

  const [clientId, setClientId] = useState(initialClient?.id || null);
  const [step, setStep] = useState(1);
  const [savedAt, setSavedAt] = useState(null);
  const [busy, setBusy] = useState(false);

  // STEP 1
  const [nome, setNome] = useState(initialClient?.name || s1.nome || '');
  const [refNome, setRefNome] = useState(s1.ref_nome || initialClient?.contact_name || '');
  const [refRuolo, setRefRuolo] = useState(s1.ref_ruolo || '');
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

  // PARAMS preventivo
  const [rates, setRates] = useState(sp.rates || { ...CONFIG.rates_new });
  const [l2Mult, setL2Mult] = useState(sp.l2_mult ?? CONFIG.l2_multiplier_default);
  const [vatExempt, setVatExempt] = useState(sp.vat_exempt ?? CONFIG.vat_exempt);
  const [showParams, setShowParams] = useState(false);
  const [scenario, setScenario] = useState('avg');

  // v2: ergonomia (ufficio per persona, produzione per postazione tipo) + prodotto
  const [ergUfficio, setErgUfficio] = useState(s2.ergonomia_ufficio ?? '');
  const [ergPostazioni, setErgPostazioni] = useState(s2.ergonomia_postazioni ?? '');
  const [tipoProdotto, setTipoProdotto] = useState(initialClient?.tipo_prodotto || 'programma_completo');
  const [prodottoErr, setProdottoErr] = useState('');

  // ─── Derivati calcolatore ───────────────────────────────────────────────────
  const n = useMemo(() => sedi.reduce((a, e) => a + (parseInt(e.employees) || 0), 0), [sedi]);
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
    const ergonomia = isV2 && (ergUfficio !== '' || ergPostazioni !== '')
      ? { nUfficio: parseInt(ergUfficio) || 0, nPostazioni: parseInt(ergPostazioni) || 0 }
      : undefined;
    return computeForchetta({ n, sector, tier, groups, rates, vatExempt, l2Mult, pricingVersion, v2Params, ergonomia });
  }, [n, sector, tier, groups, rates, vatExempt, l2Mult, pricingVersion, v2Params, ergUfficio, ergPostazioni, isV2]);
  // Pacchetto prevenzione (v2, sotto soglia): prezzo dal motore, regole dure lato server.
  const sogliaIngresso = (v2Params && v2Params.soglia_ingresso) || 80;
  const pacchettoDisponibile = isV2 && n > 0 && n <= sogliaIngresso;
  const pacchetto = useMemo(() => {
    if (!isV2 || tipoProdotto !== 'pacchetto_prevenzione') return null;
    const ergonomia = (ergUfficio !== '' || ergPostazioni !== '')
      ? { nUfficio: parseInt(ergUfficio) || 0, nPostazioni: parseInt(ergPostazioni) || 0 }
      : undefined;
    return calculatePacchetto({ n, groups, rates, vatExempt, v2Params, ergonomia });
  }, [isV2, tipoProdotto, n, groups, rates, vatExempt, v2Params, ergUfficio, ergPostazioni]);
  const scen = forchetta;                 // {min, avg, max}, ognuno {pct, l1, l2, ...calcolo}
  const calcMin = forchetta.min, calcAvg = forchetta.avg, calcMax = forchetta.max;
  const calc = scenario === 'min' ? calcMin : scenario === 'max' ? calcMax : calcAvg;
  const sel = calc;                       // sel.l1 / sel.l2 invariati
  const roi = useMemo(() => calc ? calculateROI(calc.price_y1, parseInt(absenceDays) || 0) : null, [calc, absenceDays]);

  function buildData() {
    return {
      step1: { nome, ref_nome: refNome, ref_ruolo: refRuolo, ref_email: refEmail, ref_tel: refTel, work_desc: workDesc, sector, disturbi, disturbi_altro: disturbiAltro, prev_fatta: prevFatta, prev_note: prevNote, assenteismo, absence_days: absenceDays, note: note1 },
      step2: { sedi, capienza, training_mode: trainingMode, fatturato, hr_maturity: hrMaturity, tier_override: tierOverride, tier, ergonomia_ufficio: ergUfficio === '' ? null : parseInt(ergUfficio) || 0, ergonomia_postazioni: ergPostazioni === '' ? null : parseInt(ergPostazioni) || 0 },
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
    router.replace(`/dashboard/first-meeting?clientId=${c.id}`, undefined, { shallow: true });
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

  // Autosave debounce (solo se cliente già creato)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (!clientId) return;
    const t = setTimeout(() => save({ silent: true }), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome, refNome, refRuolo, refEmail, refTel, workDesc, sector, disturbi, disturbiAltro, prevFatta, prevNote, assenteismo, absenceDays, note1, sedi, capienza, trainingMode, fatturato, hrMaturity, tierOverride, spazio, spazioNote, fasce, mc, mcNome, mcContatti, esg, refOpNome, refOpRuolo, refOpContatti, rates, l2Mult, vatExempt, ergUfficio, ergPostazioni]);

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
      if (ergUfficio !== '') params.set('ergu', String(parseInt(ergUfficio) || 0));
      if (ergPostazioni !== '') params.set('ergp', String(parseInt(ergPostazioni) || 0));
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
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-3">
          <Link href={clientId ? `/dashboard/${clientId}` : '/dashboard'} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate">Scheda colloquio</div>
            <div className="text-xs text-gray-500">{nome || 'Nuova azienda'}{savedAt && <span className="text-green-600 ml-2">✓ salvato</span>}</div>
          </div>
          <NavMenu />
        </div>
        <div className="max-w-2xl mx-auto px-5 pb-3 flex gap-2">
          {STEPS.map((label, i) => (
            <button key={i} onClick={() => goStep(i + 1)} className={`flex-1 text-left ${step === i + 1 ? '' : 'opacity-60'}`}>
              <div className={`h-1.5 rounded-full mb-1 ${i + 1 <= step ? 'bg-green-500' : 'bg-gray-200'}`} />
              <div className={`text-[11px] font-semibold ${step === i + 1 ? 'text-green-700' : 'text-gray-400'}`}>{i + 1}. {label}</div>
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-5 space-y-5">

        {step === 1 && (
          <div className="space-y-5">
            <Field label="Nome azienda *"><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Es. Acme S.p.A." className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Referente — nome *"><input value={refNome} onChange={e => setRefNome(e.target.value)} placeholder="Mario Rossi" className={inputCls} /></Field>
              <Field label="Referente — ruolo *"><input value={refRuolo} onChange={e => setRefRuolo(e.target.value)} placeholder="HR / Direzione / Titolare" className={inputCls} /></Field>
            </div>
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
            <Field label="Note del colloquio"><textarea value={note1} onChange={e => setNote1(e.target.value)} rows={4} className={inputCls + ' resize-none'} placeholder="Appunti liberi…" /></Field>
            <button onClick={() => goStep(2)} disabled={!nome.trim()} className="w-full py-3.5 rounded-2xl bg-green-600 text-white font-bold disabled:opacity-40">Avanti →</button>
          </div>
        )}

        {step === 2 && (
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
              <Field label="Capienza aula/sala"><input type="number" value={capienza} onChange={e => setCapienza(e.target.value)} className={inputCls} /></Field>
              <Field label="Formazione"><div className="flex gap-1">{seg('per_sede', trainingMode, setTrainingMode, 'Per sede')}{seg('accorpa', trainingMode, setTrainingMode, 'Accorpa')}</div></Field>
            </div>
            {isV2 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <div className="text-sm font-semibold text-gray-700">🪑 Consulenza ergonomico-posturale</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Dipendenti ufficio" hint={`vuoto = tutti (${n}) · ${v2Params?.ergonomia_minuti_persona ?? 10}′ a persona`}>
                    <input type="number" min="0" value={ergUfficio} onChange={e => setErgUfficio(e.target.value)} placeholder={String(n)} className={inputCls} />
                  </Field>
                  <Field label="Postazioni tipo (produzione)" hint={`stima — conteggio definitivo al sopralluogo · ${v2Params?.ergonomia_minuti_postazione ?? 60}′ a postazione`}>
                    <input type="number" min="0" value={ergPostazioni} onChange={e => setErgPostazioni(e.target.value)} placeholder="0" className={inputCls} />
                  </Field>
                </div>
                {forchetta?.avg?.y1?.ergonomia_sotto_minimo && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    ⚠ Ergonomia sotto il minimo fatturabile ({v2Params?.ergonomia_minimo_ore ?? 4}h): accorpare ad altra attività in sede. (Solo avviso, non blocca.)
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fatturato" hint="Dirime i borderline del tier"><div className="flex gap-1">{FATTURATO.map(([v, l]) => seg(v, fatturato, setFatturato, l))}</div></Field>
              <Field label="Maturità HR"><div className="flex gap-1">{HR.map(([v, l]) => seg(v, hrMaturity, setHrMaturity, l))}</div></Field>
            </div>
            <Field label="Tier interno (uso interno, non mostrato al cliente)">
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

        {step === 3 && (
          <div className="space-y-5">
            <Field label="Avete uno spazio in sede per lo sportello? *">
              <div className="flex flex-col gap-2">{[['dedicata', 'Sì, stanza dedicata'], ['condivisa', 'Sì, sala condivisa'], ['da_trovare', 'No, da trovare']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setSpazio(v)} className={`py-2.5 px-4 rounded-xl border-2 text-sm font-semibold text-left ${spazio === v ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>{l}</button>
              ))}</div>
              <input value={spazioNote} onChange={e => setSpazioNote(e.target.value)} placeholder="Dimensioni, privacy, attrezzatura…" className={inputCls + ' mt-2'} />
            </Field>
            <Field label="Fasce orarie preferite"><div className="flex flex-wrap gap-2">{FASCE.map(f => (
              <button key={f} type="button" onClick={() => toggleArr(fasce, setFasce, f)} className={`px-3 py-1.5 rounded-full border text-sm ${fasce.includes(f) ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 text-gray-600'}`}>{f}</button>
            ))}</div></Field>
            <Field label="Avete un Medico Competente attivo?">
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
              <button onClick={() => goStep(4)} className="flex-1 py-3.5 rounded-2xl bg-green-600 text-white font-bold">Vai al preventivo →</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            {n <= 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">Inserisci i dipendenti nello Step 2 per calcolare il preventivo.</div>
            ) : (
              <>
                {/* v2: scelta prodotto (binaria, al colloquio). L'opzione pacchetto
                    compare SOLO sotto soglia; il rifiuto vero è comunque lato server. */}
                {isV2 && pacchettoDisponibile && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Prodotto</div>
                    <div className="flex gap-2">
                      {seg('programma_completo', tipoProdotto, scegliProdotto, 'Programma completo')}
                      {seg('pacchetto_prevenzione', tipoProdotto, scegliProdotto, `Pacchetto prevenzione (≤${sogliaIngresso} dip)`)}
                    </div>
                    {prodottoErr && <div className="text-xs text-red-600 mt-2">{prodottoErr}</div>}
                  </div>
                )}
                {isV2 && tipoProdotto === 'pacchetto_prevenzione' && pacchetto ? (
                  <>
                    <div className="bg-blue-600 rounded-2xl p-5 text-white">
                      <div className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">Pacchetto prevenzione — 12 mesi, non rinnovabile</div>
                      <div className="text-4xl font-bold mb-1">{fmt(pacchetto.price)}</div>
                      <div className="text-sm opacity-90">Formazione {fmt(pacchetto.training.sell)} · Ergonomia {fmt(pacchetto.ergonomia.sell)} · Assessment {fmt(pacchetto.assessment.sell)}</div>
                      <div className="text-xs opacity-80 mt-1">Include assessment completo (consensi identici al programma), formazione 2 moduli, ergonomia. ESCLUDE cicli L1, prevenzione L2 e buffer clinico.</div>
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
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Stima Anno 2+</div>
                  <div className="text-2xl font-bold text-blue-700">{fmt(calc.price_y2)}</div>
                  <div className="text-xs text-blue-500 mt-1">Formazione 1 modulo · nuovi L1 trattati{tierIncludesL2Prevention(tier) ? ' · L2 in prevenzione' : ''}</div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 leading-relaxed">
                  <strong>Clausola di adeguamento:</strong> il corrispettivo è confermato dopo l'assessment. Se i L1 reali sono ≤ scenario medio ({scen.avg.l1}) → resta al valore medio ({fmt(calcAvg.price_y1)}); se superiori → sale fino al tetto massimo ({fmt(calcMax.price_y1)}), eccedenza al canale B2C/welfare.
                </div>

                {roi && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 text-sm text-gray-700 space-y-1.5">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">ROI ({absenceDays} gg assenza)</div>
                    <div className="flex justify-between"><span>Costo assenze stimato</span><span className="font-semibold">{fmt(roi.estimated_cost)}</span></div>
                    <div className="flex justify-between"><span>Riduzione per break-even</span><span className="font-semibold text-amber-700">{roi.breakeven_pct}%</span></div>
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <button onClick={() => setShowParams(v => !v)} className="w-full flex items-center justify-between px-4 py-3"><span className="text-sm font-semibold text-gray-700">⚙️ Parametri preventivo</span><span className="text-gray-400">{showParams ? '▲' : '▼'}</span></button>
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
                            <span title="Stima dei Livello 2 attesi = L1 attesi × questo moltiplicatore. Incide sul preventivo SOLO per i tier Plus/Enterprise (dove i L2 ricevono prevenzione attiva); per i Core non cambia il prezzo. È un'ipotesi: il numero reale di L2 emerge dopo l'assessment NMQ."
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
  if (!clientId) return { props: { client: null, meeting: null, v2Params } };
  const [client, meeting] = await Promise.all([getClientById(clientId), getFirstMeeting(clientId)]);
  if (!client) return { notFound: true };
  return { props: { client, meeting: meeting || null, v2Params } };
});
