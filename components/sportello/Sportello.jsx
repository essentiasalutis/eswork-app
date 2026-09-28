// Pezzi della vista di Essentia Salutis sullo sportello: li usano la sezione «Sportello»
// (tutte le aziende) e la scheda azienda (la sua fetta). Stessi dati, stessi pezzi.
import { useState } from 'react';
import { postiDaOrario, SPORTELLO } from '../../lib/sportello.mjs';

export const giornoBreve = (g) => String(g || '').split('-').reverse().join('/');
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
export const giornoSettimana = (g) => GIORNI[new Date(`${g}T12:00:00Z`).getUTCDay()];

export function ListaAllarmi({ allarmi = [], vuoto = 'Nessun allarme.' }) {
  if (!allarmi.length) return <div className="text-sm text-green-700">✓ {vuoto}</div>;
  return (
    <ul className="space-y-1.5">
      {allarmi.map((x, i) => (
        <li key={i} className={`text-sm rounded-lg px-3 py-2 border ${x.grave ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
          {x.grave ? '⚠' : '•'} {x.azienda && <strong>{x.azienda} — </strong>}{x.testo}
        </li>
      ))}
    </ul>
  );
}

export function Occupazione({ g }) {
  if (g.stato === 'annullata') return <span className="text-xs text-gray-400">annullata</span>;
  if (g.occupati == null) return <span className="text-xs text-amber-700">{g.posti} posti · prenotati non indicati</span>;
  const pochi = g.occupati < SPORTELLO.posti_minimi;
  return <span className={`text-xs font-semibold ${pochi ? 'text-red-700' : 'text-green-700'}`}>{g.occupati} / {g.posti} posti{g.ergonomia_persone ? ` (ergonomia ${g.ergonomia_persone} pers.)` : ''}</span>;
}

// Modulo di una giornata: nuova (con ripetizione settimanale) o da modificare.
export function ModuloGiornata({ iniziale = {}, scelte, nuova = false, onFatto, onAnnulla }) {
  const [f, setF] = useState({
    client_id: iniziale.client_id || '', professional_id: iniziale.professional_id || '',
    data: iniziale.data || '', ora_inizio: iniziale.ora_inizio || '09:00', ora_fine: iniziale.ora_fine || '16:00',
    posti: iniziale.posti != null ? String(iniziale.posti) : '', sede: iniziale.sede || '', stanza: iniziale.stanza || '',
    note_logistiche: iniziale.note_logistiche || '', ripeti: '1',
    sedute_prenotate: iniziale.sedute_prenotate != null ? String(iniziale.sedute_prenotate) : '',
    ergonomia_persone: iniziale.ergonomia_persone != null ? String(iniziale.ergonomia_persone) : '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const massimo = postiDaOrario(f.ora_inizio, f.ora_fine);
  const set = (k) => (e) => setF(x => ({ ...x, [k]: e.target.value }));

  async function salva() {
    setBusy(true); setErr('');
    const corpo = { ...f, posti: f.posti === '' ? massimo : parseInt(f.posti) };
    if (nuova) { delete corpo.sedute_prenotate; delete corpo.ergonomia_persone; }
    else delete corpo.ripeti;
    const r = await fetch(nuova ? '/api/sportello' : `/api/sportello/${iniziale.id}`, {
      method: nuova ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r || !r.ok) { setErr(j.error || 'Non salvata: riprova.'); return; }
    onFatto && onFatto(j);
  }

  const campo = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-xs text-gray-500">Azienda
          <select value={f.client_id} onChange={set('client_id')} disabled={!nuova} className={campo}>
            <option value="">—</option>
            {scelte.aziende.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500">Data
          <input type="date" value={f.data} onChange={set('data')} className={campo} />
        </label>
        <label className="text-xs text-gray-500">Osteopata
          <select value={f.professional_id} onChange={set('professional_id')} className={campo}>
            <option value="">— da assegnare —</option>
            {scelte.osteopati.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500">Dalle
          <input type="time" value={f.ora_inizio} onChange={set('ora_inizio')} className={campo} />
        </label>
        <label className="text-xs text-gray-500">Alle
          <input type="time" value={f.ora_fine} onChange={set('ora_fine')} className={campo} />
        </label>
        <label className="text-xs text-gray-500">Posti (massimo {massimo}, minimo {SPORTELLO.posti_minimi})
          <input inputMode="numeric" value={f.posti} placeholder={String(massimo)} onChange={e => setF(x => ({ ...x, posti: e.target.value.replace(/[^0-9]/g, '') }))} className={campo} />
        </label>
        <label className="text-xs text-gray-500">Sede
          <input value={f.sede} onChange={set('sede')} placeholder="es. Torino, via Roma 1" className={campo} />
        </label>
        <label className="text-xs text-gray-500">Stanza
          <input value={f.stanza} onChange={set('stanza')} placeholder="es. sala riunioni piano 2" className={campo} />
        </label>
        {nuova ? (
          <label className="text-xs text-gray-500">Ripeti ogni settimana (quante giornate in tutto)
            <input inputMode="numeric" value={f.ripeti} onChange={e => setF(x => ({ ...x, ripeti: e.target.value.replace(/[^0-9]/g, '') }))} className={campo} />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-gray-500">Sedute prenotate
              <input inputMode="numeric" value={f.sedute_prenotate} onChange={e => setF(x => ({ ...x, sedute_prenotate: e.target.value.replace(/[^0-9]/g, '') }))} className={campo} />
            </label>
            <label className="text-xs text-gray-500">Ergonomia (persone)
              <input inputMode="numeric" value={f.ergonomia_persone} onChange={e => setF(x => ({ ...x, ergonomia_persone: e.target.value.replace(/[^0-9]/g, '') }))} className={campo} />
            </label>
          </div>
        )}
      </div>
      <label className="text-xs text-gray-500 block">Note logistiche (accessi, referente in sede: mai note cliniche)
        <input value={f.note_logistiche} onChange={set('note_logistiche')} className={campo} />
      </label>
      {err && <div className="text-sm text-red-700">{err}</div>}
      <div className="flex gap-2">
        <button onClick={salva} disabled={busy} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-40">{busy ? 'Salvataggio…' : nuova ? 'Crea' : 'Salva'}</button>
        {onAnnulla && <button onClick={onAnnulla} className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600">Chiudi</button>}
      </div>
    </div>
  );
}

export function RigaGiornata({ g, scelte, conAzienda = true, onCambio }) {
  const [apri, setApri] = useState(false);
  async function stato(nuovo) {
    if (nuovo === 'annullata' && !window.confirm(`Annullare la giornata del ${giornoBreve(g.data)}${g.azienda ? ` da ${g.azienda}` : ''}?`)) return;
    await fetch(`/api/sportello/${g.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stato: nuovo }) }).catch(() => null);
    onCambio && onCambio();
  }
  return (
    <div className={`rounded-lg border px-3 py-2 ${g.stato === 'annullata' ? 'bg-gray-50 border-gray-200 opacity-70' : g.conflitto ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold text-gray-900 tabular-nums">{g.ora_inizio}–{g.ora_fine}</span>
        {conAzienda && <span className="font-semibold text-gray-800">{g.azienda}</span>}
        {(g.sede || g.stanza) && <span className="text-gray-500">{[g.sede, g.stanza].filter(Boolean).join(' · ')}</span>}
        <span className={g.osteopata ? 'text-gray-700' : 'text-red-700 font-semibold'}>{g.osteopata || 'senza osteopata'}</span>
        <Occupazione g={g} />
        {g.conflitto && <span className="text-xs font-bold text-red-700">sovrapposta</span>}
        <span className="ml-auto flex gap-3 text-xs">
          <button onClick={() => setApri(a => !a)} className="underline text-gray-600">{apri ? 'Chiudi' : 'Modifica'}</button>
          {g.stato === 'annullata'
            ? <button onClick={() => stato('pianificata')} className="underline text-gray-600">Ripristina</button>
            : <button onClick={() => stato('annullata')} className="underline text-red-600">Annulla</button>}
        </span>
      </div>
      {g.note_logistiche && <div className="text-xs text-gray-500 mt-1">{g.note_logistiche}</div>}
      {apri && <div className="mt-2"><ModuloGiornata iniziale={g} scelte={scelte} onFatto={() => { setApri(false); onCambio && onCambio(); }} onAnnulla={() => setApri(false)} /></div>}
    </div>
  );
}

export function ContrattoErogato({ azienda }) {
  const c = azienda.contratto;
  const barra = (fatte, totale) => {
    const pct = totale > 0 ? Math.min(100, Math.round((fatte / totale) * 100)) : 0;
    return <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-1"><div className="h-full bg-green-600 rounded-full" style={{ width: `${pct}%` }} /></div>;
  };
  if (!c) return <div className="text-sm text-gray-500">Nessun Report di Attivazione: il contratto delle sedute nasce lì.</div>;
  if (c.mancante) return <div className="text-sm text-amber-800">Il Report di Attivazione del {giornoBreve(String(c.reportDel).slice(0, 10))} non ha le persone a contratto (è precedente al 28/9): rigeneralo per registrarle. Sedute erogate nell&apos;anno: Livello 1 {azienda.erogate.l1}, Livello 2 {azienda.erogate.l2}.</div>;
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <div className="text-sm text-gray-700"><strong>Livello 1</strong>: {azienda.erogate.l1} sedute su {c.l1} <span className="text-gray-400">({c.personeL1} persone × 4)</span></div>
        {barra(azienda.erogate.l1, c.l1)}
      </div>
      <div>
        <div className="text-sm text-gray-700"><strong>Livello 2</strong>: {azienda.erogate.l2} sedute su {c.l2} <span className="text-gray-400">({c.personeL2} persone × 4)</span></div>
        {barra(azienda.erogate.l2, c.l2)}
      </div>
    </div>
  );
}

// Per ogni persona in carico solo lo stato del percorso: mai note, dolore o contenuti clinici.
export function PersoneInCarico({ persone = [] }) {
  const [tutte, setTutte] = useState(false);
  if (!persone.length) return <div className="text-sm text-gray-500">Nessuna persona in carico.</div>;
  const mostrate = tutte ? persone : persone.slice(0, 8);
  const etichetta = { level1: 'Livello 1', level2: 'Livello 2', level3: 'Livello 3' };
  return (
    <div>
      <ul className="divide-y divide-gray-100">
        {mostrate.map(p => (
          <li key={p.id} className="py-1.5 text-sm flex flex-wrap gap-x-3">
            <span className="font-medium text-gray-900 w-44 shrink-0">{p.nome}</span>
            <span className="text-xs text-gray-400 w-16 shrink-0 pt-0.5">{etichetta[p.livello] || ''}</span>
            <span className="text-gray-700 flex-1">{p.stato.join(' · ') || '—'}</span>
          </li>
        ))}
      </ul>
      {persone.length > 8 && <button onClick={() => setTutte(t => !t)} className="text-xs underline text-gray-600 mt-1">{tutte ? 'Mostra meno' : `Mostra tutte (${persone.length})`}</button>}
    </div>
  );
}
