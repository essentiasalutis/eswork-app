import { useState } from 'react';
import { MOTIVI, MESSAGGI, GIORNI_MAX, BYTE_MAX, giornoRoma } from '../lib/copia-cartacea.mjs';

// Firma su carta — l'ECCEZIONE (punto d). Si stampa la versione in vigore, si fa
// firmare, si carica entro 7 giorni indicando la versione. Il documento risulta
// firmato solo quando il server ha accettato la copia: qui non si decide nulla.

const ETICHETTE = {
  consent_treatment: 'Consenso informato al trattamento osteopatico',
  privacy_extended: 'Informativa privacy estesa',
};
const NON_SO = '__non_so';

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('it-IT') : '');

export default function CopiaCartacea({ patientId, daCaricare, versioni, onAccettata }) {
  const [aperto, setAperto] = useState(false);
  const [scelti, setScelti] = useState(() => Object.fromEntries(daCaricare.map(t => [t, true])));
  const [versione, setVersione] = useState(() => Object.fromEntries(daCaricare.map(t => [t, ''])));
  const [dataFirma, setDataFirma] = useState('');
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errori, setErrori] = useState([]);

  const oggi = giornoRoma(new Date());
  const minimo = (() => { const d = new Date(`${oggi}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - GIORNI_MAX); return d.toISOString().slice(0, 10); })();

  const selezionati = daCaricare.filter(t => scelti[t]);
  const nonSo = selezionati.some(t => versione[t] === NON_SO);
  const pronto = selezionati.length > 0 && !nonSo && selezionati.every(t => versione[t])
    && dataFirma && motivo && (motivo !== 'altro' || nota.trim().length >= 5) && file && !busy;

  async function carica() {
    if (!pronto) return;
    setErrori([]);
    if (file.size > BYTE_MAX) return setErrori([MESSAGGI.file_troppo_grande]);
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return setErrori([MESSAGGI.file_tipo_non_ammesso]);
    setBusy(true);
    try {
      const base = `/api/pro/patients/${patientId}/carta`;
      const p = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione: 'prepara', content_type: file.type }) });
      const pj = await p.json();
      if (!p.ok) throw new Error(pj.error || 'Impossibile preparare il caricamento');
      const up = await fetch(pj.signed_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!up.ok) throw new Error('Il file non è stato caricato: riprova.');
      const a = await fetch(base, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          azione: 'accetta', path: pj.path,
          documenti: selezionati.map(t => ({ tipo: t, testo_legale_id: versione[t] })),
          data_firma: dataFirma, motivo, motivo_nota: motivo === 'altro' ? nota : null,
        }),
      });
      const aj = await a.json();
      if (!a.ok) { setErrori(aj.messaggi || [aj.error || 'Copia rifiutata']); setBusy(false); return; }
      onAccettata(aj.documenti);
    } catch (e) {
      setErrori([e.message]);
    }
    setBusy(false);
  }

  const box = { background: '#fff', border: '1px solid #cbd5e1', borderRadius: 14, padding: '14px 16px' };
  const label = { fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 };
  const campo = { width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, background: '#fff', boxSizing: 'border-box' };

  if (!aperto) {
    return (
      <button onClick={() => setAperto(true)}
        style={{ ...box, width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: 13, color: '#475569' }}>
        Firmato su carta? <span style={{ color: '#0369a1', fontWeight: 600 }}>Carica la copia firmata</span>
        <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Solo in via eccezionale: la firma in piattaforma resta la regola.</span>
      </button>
    );
  }

  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Copia firmata su carta</div>
        <button onClick={() => { setAperto(false); setErrori([]); }} style={{ fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Chiudi</button>
      </div>

      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, background: '#f8fafc', borderRadius: 8, padding: '8px 10px' }}>
        Stampa la versione in vigore, falla firmare e carica la copia entro {GIORNI_MAX} giorni dalla firma.
        La versione è stampata a piè di pagina del modulo.
        <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
          {daCaricare.map(t => (
            <a key={t} href={`/pro/patients/${patientId}/stampa?documento=${t}`} target="_blank" rel="noopener noreferrer"
              style={{ color: '#0369a1', fontWeight: 600 }}>Stampa: {ETICHETTE[t]}</a>
          ))}
        </div>
      </div>

      {daCaricare.map(t => (
        <div key={t} style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
            <input type="checkbox" checked={!!scelti[t]} onChange={e => setScelti(s => ({ ...s, [t]: e.target.checked }))} />
            {ETICHETTE[t]}
          </label>
          {scelti[t] && (
            <div style={{ marginTop: 6 }}>
              <span style={label}>Versione fatta firmare</span>
              <select style={campo} value={versione[t]} onChange={e => setVersione(v => ({ ...v, [t]: e.target.value }))}>
                <option value="">— scegli dal piè di pagina del modulo —</option>
                {(versioni?.[t] || []).map(v => (
                  <option key={v.id} value={v.id}>
                    {v.versione} · {v.stato === 'in_vigore' ? `in vigore dal ${fmt(v.pubblicato_il)}` : `in vigore dal ${fmt(v.pubblicato_il)} al ${fmt(v.ritirato_il)}`} · {v.impronta.slice(0, 12)}
                  </option>
                ))}
                <option value={NON_SO}>Non so quale versione ho fatto firmare</option>
              </select>
              {versione[t] === NON_SO && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 10px' }}>
                  {MESSAGGI.versione_sconosciuta}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div>
          <span style={label}>Data della firma</span>
          <input type="date" style={campo} value={dataFirma} min={minimo} max={oggi} onChange={e => setDataFirma(e.target.value)} />
        </div>
        <div>
          <span style={label}>Perché non in piattaforma</span>
          <select style={campo} value={motivo} onChange={e => setMotivo(e.target.value)}>
            <option value="">— scegli —</option>
            {Object.entries(MOTIVI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      {motivo === 'altro' && (
        <div>
          <span style={label}>Spiega in breve</span>
          <input style={campo} value={nota} maxLength={500} onChange={e => setNota(e.target.value)} />
        </div>
      )}

      <div>
        <span style={label}>Copia firmata (PDF, JPG o PNG, max 10 MB)</span>
        <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={e => setFile(e.target.files?.[0] || null)} style={{ fontSize: 13 }} />
      </div>

      {errori.length > 0 && (
        <div role="alert" style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 12px' }}>
          <strong>Copia non accettata.</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>{errori.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      <button onClick={carica} disabled={!pronto}
        style={{ padding: '12px', borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: pronto ? 'pointer' : 'not-allowed', background: pronto ? '#0f172a' : '#e2e8f0', color: pronto ? '#fff' : '#94a3b8' }}>
        {busy ? 'Verifica in corso…' : 'Carica e verifica la copia'}
      </button>
    </div>
  );
}
