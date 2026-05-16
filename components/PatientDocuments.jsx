import { useState } from 'react';
import SignatureCanvas from './SignatureCanvas';
import { CONSENSO_TRATTAMENTO, INFORMATIVA_PRIVACY_ESTESA } from '../lib/legal-texts';

const todayStr = () => new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

// ─── Componente principale ─────────────────────────────────────────────────────

export default function PatientDocuments({ patientId, clientId, patient, documents: initialDocs, onDocsChange }) {
  const [docs, setDocs] = useState(initialDocs || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [signature, setSignature] = useState(null);
  const [proNotes, setProNotes] = useState('');
  const [nrsTouched, setNrsTouched] = useState(false);
  const [open, setOpen] = useState({ consent_treatment: false, privacy_extended: false, anamnesi: true });

  const [f, setF] = useState({
    first_name:                  patient?.first_name || '',
    last_name:                   patient?.last_name || '',
    age:                         patient?.age || '',
    gender:                      patient?.gender || '',
    job_activity:                patient?.job_activity || '',
    sedentary:                   patient?.sedentary ?? false,
    does_sport:                  patient?.does_sport ?? false,
    sport_details:               patient?.sport_details || '',
    pain_location:               patient?.pain_location || '',
    pain_onset:                  patient?.pain_onset || '',
    pain_type:                   patient?.pain_type || '',
    nrs:                         0,
    durata:                      '',
    fattori_peggio:              '',
    fattori_meglio:              '',
    takes_medications:           patient?.takes_medications ?? false,
    medications_details:         patient?.medications_details || '',
    recent_diagnostics:          patient?.recent_diagnostics ?? false,
    diagnostics_details:         patient?.diagnostics_details || '',
    traumas_surgeries:           patient?.traumas_surgeries || '',
    vision_issues:               patient?.vision_issues ?? false,
    vision_details:              patient?.vision_details || '',
    hearing_issues:              patient?.hearing_issues ?? false,
    hearing_details:             patient?.hearing_details || '',
    headaches:                   patient?.headaches ?? false,
    headaches_details:           patient?.headaches_details || '',
    bruxism:                     patient?.bruxism ?? false,
    bruxism_details:             patient?.bruxism_details || '',
    has_cardiovascular_issues:   patient?.has_cardiovascular_issues ?? false,
    cardiovascular_details:      patient?.cardiovascular_details || '',
    has_gastrointestinal_issues: patient?.has_gastrointestinal_issues ?? false,
    gastrointestinal_details:    patient?.gastrointestinal_details || '',
    urological_issues:           patient?.urological_issues || '',
    gynecological_info:          patient?.gynecological_info || '',
    obstetric_history:           patient?.obstetric_history || '',
    red_flags:                   patient?.red_flags ?? false,
    red_flags_details:           patient?.red_flags_details || '',
    notes:                       patient?.notes || '',
  });

  const [editingAnamnesi, setEditingAnamnesi] = useState(false);
  const [savingAnamnesi, setSavingAnamnesi] = useState(false);

  function upd(k, v) { setF(prev => ({ ...prev, [k]: v })); }
  function toggle(key) { setOpen(p => ({ ...p, [key]: !p[key] })); }

  function allComplete() {
    return ['consent_treatment', 'privacy_extended', 'anamnesi'].every(type => {
      const d = docs.find(d => d.type === type);
      return d && (d.status === 'signed' || d.status === 'completed');
    });
  }

  const canSave = !!(f.pain_location && f.job_activity && nrsTouched && signature);
  const canSaveAnamnesi = !!(f.pain_location && f.job_activity && nrsTouched);

  async function handleSaveAnamnesiOnly() {
    if (!canSaveAnamnesi || savingAnamnesi) return;
    setSavingAnamnesi(true);
    setError(null);
    try {
      const res = await fetch(`/api/pro/patients/documents?patientId=${patientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'anamnesi',
          client_id: clientId,
          form_data: f,
          pro_notes: proNotes,
          document_text: JSON.stringify(f),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setDocs(prev => prev.map(d => d.type === 'anamnesi' ? updated : d));
      onDocsChange?.(docs.map(d => d.type === 'anamnesi' ? updated : d));
      setEditingAnamnesi(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingAnamnesi(false);
    }
  }

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const consentText  = CONSENSO_TRATTAMENTO.sezioni.map(s => s.titolo + '\n' + s.testo).join('\n\n');
      const privacyText  = INFORMATIVA_PRIVACY_ESTESA.sezioni.map(s => s.titolo + '\n' + s.testo).join('\n\n');
      const res = await fetch(`/api/pro/patients/documents/bulk?patientId=${patientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:       clientId,
          signature_image: signature,
          form_data:       f,
          pro_notes:       proNotes,
          consent_text:    consentText,
          privacy_text:    privacyText,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const newDocs = await res.json();
      setDocs(newDocs);
      onDocsChange?.(newDocs);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Vista "già firmato" ──────────────────────────────────────────────────────
  if (allComplete() && !editingAnamnesi) {
    const anchor = docs.find(d => d.type === 'consent_treatment') || docs[0];
    return (
      <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#15803d' }}>
            ✅ Documenti firmati il {anchor?.signed_at ? new Date(anchor.signed_at).toLocaleDateString('it-IT') : '—'}
          </div>
          <button
            onClick={() => { setEditingAnamnesi(true); setOpen(p => ({ ...p, anamnesi: true })); }}
            style={{ fontSize: 12, fontWeight: 600, color: '#0369a1', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: 8, padding: '5px 12px', cursor: 'pointer' }}
          >
            ✏️ Modifica anamnesi
          </button>
        </div>
        {[
          { type: 'consent_treatment', label: '📋 Consenso informato al trattamento osteopatico' },
          { type: 'privacy_extended',  label: '🔒 Informativa privacy (art. 13 GDPR)' },
          { type: 'anamnesi',          label: '🩺 Anamnesi ES Work' },
        ].map(({ type, label }) => {
          const d = docs.find(d => d.type === type);
          return (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#166534', marginBottom: 4 }}>
              <span>✅</span>
              <span>{label}</span>
              {d?.content_hash && (
                <span style={{ fontSize: 11, color: '#4ade80', fontFamily: 'monospace', marginLeft: 4 }}>
                  #{d.content_hash.slice(0, 8)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Vista "modifica solo anamnesi" ───────────────────────────────────────────
  if (allComplete() && editingAnamnesi) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10 }}>
          <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>✏️ Stai modificando l'anamnesi — consensi e privacy restano validi</span>
          <button onClick={() => { setEditingAnamnesi(false); setError(null); }} style={{ fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Annulla</button>
        </div>
        <Accordion icon="🩺" title="Anamnesi ES Work" expanded={open.anamnesi} onToggle={() => toggle('anamnesi')}>
          {anamnesiFormFields({ f, upd, nrsTouched, setNrsTouched, proNotes, setProNotes })}
        </Accordion>
        {error && <div style={{ color: '#dc2626', fontSize: 13, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8 }}>❌ {error}</div>}
        <button
          onClick={handleSaveAnamnesiOnly}
          disabled={!canSaveAnamnesi || savingAnamnesi}
          style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 700, cursor: canSaveAnamnesi ? 'pointer' : 'not-allowed', background: canSaveAnamnesi ? '#0369a1' : '#e2e8f0', color: canSaveAnamnesi ? '#fff' : '#94a3b8' }}
        >
          {savingAnamnesi ? 'Salvataggio…' : '💾 Salva modifiche anamnesi'}
        </button>
      </div>
    );
  }

  // ── Vista "da firmare" ───────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── 1. Consenso informato ── */}
      <Accordion
        icon="📋"
        title="Consenso informato al trattamento osteopatico"
        expanded={open.consent_treatment}
        onToggle={() => toggle('consent_treatment')}
      >
        {CONSENSO_TRATTAMENTO.sezioni.map(s => (
          <div key={s.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>{s.titolo}</div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-line', background: '#f8fafc', borderRadius: 8, padding: '8px 12px' }}>{s.testo}</div>
          </div>
        ))}
      </Accordion>

      {/* ── 2. Informativa privacy ── */}
      <Accordion
        icon="🔒"
        title="Informativa privacy (art. 13 GDPR)"
        expanded={open.privacy_extended}
        onToggle={() => toggle('privacy_extended')}
      >
        {INFORMATIVA_PRIVACY_ESTESA.sezioni.map(s => (
          <div key={s.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>{s.titolo}</div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-line', background: '#f8fafc', borderRadius: 8, padding: '8px 12px' }}>{s.testo}</div>
          </div>
        ))}
      </Accordion>

      {/* ── 3. Anamnesi ES Work ── */}
      <Accordion
        icon="🩺"
        title="Anamnesi ES Work"
        expanded={open.anamnesi}
        onToggle={() => toggle('anamnesi')}
        badge={<span style={{ fontSize: 11, background: '#fef9c3', color: '#92400e', padding: '1px 7px', borderRadius: 99, fontWeight: 600 }}>da compilare</span>}
      >
        {anamnesiFormFields({ f, upd, nrsTouched, setNrsTouched, proNotes, setProNotes })}
      </Accordion>

      {/* ── Blocco firma cumulativa ── */}
      <div style={{ background: '#fff', border: '2px solid #0369a1', borderRadius: 14, padding: '20px 22px', marginTop: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>✍️ Firma cumulativa</div>

        {/* Dichiarazione esplicita */}
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0c4a6e', marginBottom: 8 }}>
            Confermo con la mia firma di:
          </div>
          <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: 13, color: '#0c4a6e', lineHeight: 1.9 }}>
            <li>aver letto e accettato il <strong>consenso informato</strong> al trattamento osteopatico</li>
            <li>aver letto l'<strong>informativa privacy</strong> e prestato il consenso al trattamento dei dati di salute (art. 9 GDPR)</li>
            <li>aver compilato l'<strong>anamnesi clinica</strong> in modo veritiero e completo, senza omettere informazioni rilevanti per la mia sicurezza</li>
          </ul>
        </div>

        {/* Data automatica */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Data: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{todayStr()}</strong>
          </div>
        </div>

        {/* Canvas firma */}
        <SignatureCanvas onChange={setSignature} />
        {!signature && (
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 6 }}>
            Firma nel riquadro sopra per abilitare il salvataggio
          </div>
        )}
      </div>

      {/* Messaggio campi mancanti */}
      {!canSave && (f.pain_location || f.job_activity || nrsTouched) && (
        <div style={{ fontSize: 12, color: '#f59e0b', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
          {!f.job_activity && '⚠️ Compila la mansione lavorativa. '}
          {!f.pain_location && '⚠️ Indica la zona del dolore. '}
          {!nrsTouched && '⚠️ Imposta il valore NRS. '}
          {!signature && '⚠️ Aggiungi la firma. '}
        </div>
      )}

      {error && <div style={{ color: '#dc2626', fontSize: 13, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8 }}>❌ {error}</div>}

      {/* Pulsante salva */}
      <button
        onClick={handleSave}
        disabled={!canSave || saving}
        style={{
          width: '100%', padding: '15px', borderRadius: 12, border: 'none',
          fontSize: 15, fontWeight: 700,
          cursor: canSave ? 'pointer' : 'not-allowed',
          background: canSave ? '#0369a1' : '#e2e8f0',
          color: canSave ? '#fff' : '#94a3b8',
          transition: 'background .2s, color .2s',
        }}
      >
        {saving ? 'Salvataggio in corso…' : canSave ? '✍️ Firma e salva tutti i documenti' : 'Compila anamnesi e firma per procedere'}
      </button>
    </div>
  );
}

// ─── Form anamnesi (riutilizzato in prima firma e in modifica) ────────────────

function anamnesiFormFields({ f, upd, nrsTouched, setNrsTouched, proNotes, setProNotes }) {
  return (
    <>
      <ST>Dati paziente</ST>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <FF label="Nome"><input style={IS} value={f.first_name} onChange={e => upd('first_name', e.target.value)} /></FF>
        <FF label="Cognome"><input style={IS} value={f.last_name} onChange={e => upd('last_name', e.target.value)} /></FF>
        <FF label="Età"><input style={IS} type="number" value={f.age} onChange={e => upd('age', e.target.value)} /></FF>
        <FF label="Sesso biologico">
          <select style={SS} value={f.gender} onChange={e => upd('gender', e.target.value)}>
            <option value="">—</option>
            <option value="M">Maschile</option>
            <option value="F">Femminile</option>
            <option value="altro">Altro / Non specificato</option>
          </select>
        </FF>
      </div>

      <ST>Attività lavorativa</ST>
      <FF label={<>Mansione / attività svolta <span style={{ color: '#ef4444' }}>*</span></>}>
        <input style={IS} value={f.job_activity} onChange={e => upd('job_activity', e.target.value)} placeholder="es. operaio, impiegato, magazziniere…" />
      </FF>
      <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
        <Toggle checked={f.sedentary} onChange={v => upd('sedentary', v)} label="Lavoro prevalentemente sedentario" />
        <Toggle checked={f.does_sport} onChange={v => upd('does_sport', v)} label="Pratica sport" />
      </div>
      {f.does_sport && (
        <FF label="Quale sport / frequenza">
          <input style={IS} value={f.sport_details} onChange={e => upd('sport_details', e.target.value)} placeholder="es. corsa 3×/settimana" />
        </FF>
      )}

      <ST>Sintomatologia attuale</ST>
      <FF label={<>Zona / sede del dolore <span style={{ color: '#ef4444' }}>*</span></>}>
        <input style={IS} value={f.pain_location} onChange={e => upd('pain_location', e.target.value)} placeholder="es. lombare bilaterale, spalla destra…" />
      </FF>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <FF label="Insorgenza">
          <select style={SS} value={f.durata} onChange={e => upd('durata', e.target.value)}>
            <option value="">Seleziona…</option>
            <option value="<1m">Meno di 1 mese</option>
            <option value="1-3m">1–3 mesi</option>
            <option value="3-6m">3–6 mesi</option>
            <option value="6-12m">6–12 mesi</option>
            <option value=">12m">Più di 12 mesi</option>
          </select>
        </FF>
        <FF label="Tipo di dolore">
          <input style={IS} value={f.pain_type} onChange={e => upd('pain_type', e.target.value)} placeholder="es. trafittivo, sordo, urente…" />
        </FF>
      </div>
      <FF label="Modalità di insorgenza">
        <input style={IS} value={f.pain_onset} onChange={e => upd('pain_onset', e.target.value)} placeholder="es. acuto improvviso, progressivo, post-trauma…" />
      </FF>
      <FF label={<>Intensità dolore NRS (0–10) <span style={{ color: '#ef4444' }}>*</span> {!nrsTouched && <span style={{ color: '#f59e0b', fontWeight: 400, fontSize: 11 }}>— obbligatorio</span>}</>}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="range" min={0} max={10} value={f.nrs}
            onChange={e => { upd('nrs', +e.target.value); setNrsTouched(true); }}
            style={{ flex: 1, accentColor: f.nrs >= 7 ? '#dc2626' : f.nrs >= 4 ? '#f59e0b' : '#16a34a' }} />
          <span style={{ fontWeight: 700, fontSize: 18, minWidth: 36, textAlign: 'center', color: nrsTouched ? (f.nrs >= 7 ? '#dc2626' : f.nrs >= 4 ? '#f59e0b' : '#16a34a') : '#94a3b8' }}>
            {nrsTouched ? f.nrs : '—'}
          </span>
        </div>
        {!nrsTouched && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Muovi lo slider per impostare il valore NRS</div>}
      </FF>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FF label="Fattori aggravanti"><textarea style={TS} rows={2} value={f.fattori_peggio} onChange={e => upd('fattori_peggio', e.target.value)} placeholder="es. seduto a lungo, sollevamenti…" /></FF>
        <FF label="Fattori allevianti"><textarea style={TS} rows={2} value={f.fattori_meglio} onChange={e => upd('fattori_meglio', e.target.value)} placeholder="es. movimento, calore, riposo…" /></FF>
      </div>

      <ST>Farmaci ed esami</ST>
      <div style={{ display: 'flex', gap: 24, marginBottom: 10 }}>
        <Toggle checked={f.takes_medications} onChange={v => upd('takes_medications', v)} label="Terapia farmacologica in corso" />
        <Toggle checked={f.recent_diagnostics} onChange={v => upd('recent_diagnostics', v)} label="Esami diagnostici recenti" />
      </div>
      {f.takes_medications && <FF label="Farmaci (quali)"><input style={IS} value={f.medications_details} onChange={e => upd('medications_details', e.target.value)} /></FF>}
      {f.recent_diagnostics && <FF label="Esami (quali/quando)"><input style={IS} value={f.diagnostics_details} onChange={e => upd('diagnostics_details', e.target.value)} /></FF>}
      <FF label="Traumi, fratture, interventi chirurgici">
        <textarea style={TS} rows={2} value={f.traumas_surgeries} onChange={e => upd('traumas_surgeries', e.target.value)} placeholder="es. ernia discale operata 2018, nessuno…" />
      </FF>

      <ST>Anamnesi sistemica</ST>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {[
          ['vision_issues',               'vision_details',           'Problemi visivi'],
          ['hearing_issues',              'hearing_details',          'Problemi uditivi'],
          ['headaches',                   'headaches_details',        'Cefalee / emicranie'],
          ['bruxism',                     'bruxism_details',          'Bruxismo / serramento'],
          ['has_cardiovascular_issues',   'cardiovascular_details',   'Prob. cardiovascolari'],
          ['has_gastrointestinal_issues', 'gastrointestinal_details', 'Prob. gastrointestinali'],
        ].map(([flag, detail, lbl]) => (
          <div key={flag}>
            <Toggle checked={f[flag]} onChange={v => upd(flag, v)} label={lbl} />
            {f[flag] && <input style={{ ...IS, marginTop: 6, fontSize: 12 }} value={f[detail]} onChange={e => upd(detail, e.target.value)} placeholder="Specificare…" />}
          </div>
        ))}
      </div>
      {f.gender === 'F' && (
        <>
          <FF label="Problemi urologici / ginecologici">
            <textarea style={TS} rows={2} value={f.gynecological_info} onChange={e => upd('gynecological_info', e.target.value)} placeholder="Ciclo, gravidanze, interventi ginecologici…" />
          </FF>
          <FF label="Gravidanze / parti / cesarei">
            <input style={IS} value={f.obstetric_history} onChange={e => upd('obstetric_history', e.target.value)} />
          </FF>
        </>
      )}

      <div style={{ background: f.red_flags ? '#fef2f2' : '#f8fafc', border: `1px solid ${f.red_flags ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 10, padding: '12px 14px', margin: '16px 0 12px' }}>
        <Toggle checked={f.red_flags} onChange={v => upd('red_flags', v)} label="⚠️ Red flags presenti" />
        {f.red_flags && (
          <textarea style={{ ...TS, marginTop: 8, borderColor: '#fca5a5' }} rows={2} value={f.red_flags_details} onChange={e => upd('red_flags_details', e.target.value)} placeholder="Descrivi le red flags rilevate…" />
        )}
      </div>

      <FF label="Note anamnestiche generali">
        <textarea style={TS} rows={3} value={f.notes} onChange={e => upd('notes', e.target.value)} placeholder="Annotazioni aggiuntive…" />
      </FF>

      <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10, padding: '14px', marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>📝 Note cliniche del professionista</div>
        <div style={{ fontSize: 11, color: '#78350f', marginBottom: 8 }}>Test funzionali, valutazione posturale, palpazione. Non visibili al paziente.</div>
        <textarea style={TS} rows={3} value={proNotes} onChange={e => setProNotes(e.target.value)} placeholder="Note riservate…" />
      </div>
    </>
  );
}

// ─── Accordion ────────────────────────────────────────────────────────────────

function Accordion({ icon, title, expanded, onToggle, children, badge }) {
  return (
    <div style={{ border: `1.5px solid ${expanded ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color .2s' }}>
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', background: expanded ? '#f0f9ff' : '#fff', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{title}</div>
            {badge && <div style={{ marginTop: 3 }}>{badge}</div>}
          </div>
        </div>
        <span style={{ fontSize: 12, color: '#0369a1', fontWeight: 700, flexShrink: 0 }}>
          {expanded ? 'Chiudi ▲' : 'Leggi ▼'}
        </span>
      </div>
      {expanded && (
        <div style={{ padding: '16px 18px', borderTop: '1.5px solid #e0f2fe', background: '#fafbfc', maxHeight: 520, overflowY: 'auto' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ST({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', margin: '18px 0 10px', paddingBottom: 5, borderBottom: '1.5px solid #bfdbfe' }}>{children}</div>;
}
function FF({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 6 }}>
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#0369a1' }} />
      <span style={{ fontSize: 13, color: '#374151' }}>{label}</span>
    </label>
  );
}

const IS = { width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none' };
const TS = { ...IS, resize: 'vertical', fontFamily: 'inherit' };
const SS = { ...IS, background: '#fff' };
