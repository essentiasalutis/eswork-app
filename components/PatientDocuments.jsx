import { useState } from 'react';
import SignatureCanvas from './SignatureCanvas';
import { CONSENSO_TRATTAMENTO, INFORMATIVA_PRIVACY_ESTESA } from '../lib/legal-texts';

const DOC_TYPES = [
  { type: 'consent_treatment', label: 'Consenso informato al trattamento osteopatico', icon: '📋', legal: CONSENSO_TRATTAMENTO },
  { type: 'privacy_extended',  label: 'Informativa privacy (art. 13 GDPR)',             icon: '🔒', legal: INFORMATIVA_PRIVACY_ESTESA },
  { type: 'anamnesi',          label: 'Anamnesi ES Work',                                icon: '🩺', legal: null },
];

export default function PatientDocuments({ patientId, clientId, patient, documents: initialDocs, onDocsChange }) {
  const [docs, setDocs] = useState(initialDocs || []);
  const [activeModal, setActiveModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function getDoc(type) { return docs.find(d => d.type === type); }

  function allComplete() {
    return DOC_TYPES.every(dt => {
      const d = getDoc(dt.type);
      return d && (d.status === 'signed' || d.status === 'completed');
    });
  }

  async function saveDoc(type, payload) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/pro/patients/documents?patientId=${patientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, client_id: clientId, ...payload }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();
      setDocs(prev => {
        const exists = prev.find(d => d.type === type);
        const newDocs = exists ? prev.map(d => d.type === type ? updated : d) : [...prev, updated];
        onDocsChange?.(newDocs);
        return newDocs;
      });
      setActiveModal(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="space-y-2">
        {DOC_TYPES.map(dt => {
          const doc = getDoc(dt.type);
          const signed = doc && (doc.status === 'signed' || doc.status === 'completed');
          return (
            <div key={dt.type} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">{dt.icon}</span>
                <div>
                  <div className="text-sm font-medium text-gray-800">{dt.label}</div>
                  <div className={`text-xs mt-0.5 font-medium ${signed ? 'text-green-600' : 'text-orange-500'}`}>
                    {signed
                      ? `✅ ${dt.type === 'anamnesi' ? 'Compilata' : 'Firmata'} il ${new Date(doc.signed_at).toLocaleDateString('it-IT')}`
                      : `⚠️ ${dt.type === 'anamnesi' ? 'Non compilata' : 'Non firmata'}`}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(dt.type)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${signed ? 'text-gray-500 border border-gray-200 hover:bg-gray-50' : 'text-white bg-blue-600 hover:bg-blue-700'}`}
              >
                {signed ? (dt.type === 'anamnesi' ? '✏️ Modifica' : '👁 Rivedi') : (dt.type === 'anamnesi' ? '📝 Compila' : '✍️ Firma')}
              </button>
            </div>
          );
        })}
      </div>

      {activeModal && (
        <DocModal
          type={activeModal}
          patientId={patientId}
          patient={patient}
          existingDoc={getDoc(activeModal)}
          saving={saving}
          error={error}
          onSave={saveDoc}
          onClose={() => { setActiveModal(null); setError(null); }}
        />
      )}
    </div>
  );
}

// ─── Modale ───────────────────────────────────────────────────────────────────

function DocModal({ type, patient, existingDoc, saving, error, onSave, onClose }) {
  const [signature, setSignature] = useState(null);
  const [cbConfirm, setCbConfirm] = useState(false);
  const [proNotes, setProNotes] = useState(existingDoc?.pro_notes || '');

  // Anamnesi — campi (stessi del DB paziente, estesi)
  const [f, setF] = useState(existingDoc?.form_data || {
    // Dati anagrafici (pre-popolati dal paziente)
    first_name:                   patient?.first_name || '',
    last_name:                    patient?.last_name || '',
    age:                          patient?.age || '',
    gender:                       patient?.gender || '',
    // Attività
    job_activity:                 patient?.job_activity || '',
    sedentary:                    patient?.sedentary ?? false,
    does_sport:                   patient?.does_sport ?? false,
    sport_details:                patient?.sport_details || '',
    // Sintomatologia
    pain_location:                patient?.pain_location || '',
    pain_onset:                   patient?.pain_onset || '',
    pain_type:                    patient?.pain_type || '',
    nrs:                          0,
    durata:                       '',
    fattori_peggio:               '',
    fattori_meglio:               '',
    // Farmaci e diagnostica
    takes_medications:            patient?.takes_medications ?? false,
    medications_details:          patient?.medications_details || '',
    recent_diagnostics:           patient?.recent_diagnostics ?? false,
    diagnostics_details:          patient?.diagnostics_details || '',
    traumas_surgeries:            patient?.traumas_surgeries || '',
    // Anamnesi sistemica
    vision_issues:                patient?.vision_issues ?? false,
    vision_details:               patient?.vision_details || '',
    hearing_issues:               patient?.hearing_issues ?? false,
    hearing_details:              patient?.hearing_details || '',
    headaches:                    patient?.headaches ?? false,
    headaches_details:            patient?.headaches_details || '',
    bruxism:                      patient?.bruxism ?? false,
    bruxism_details:              patient?.bruxism_details || '',
    has_cardiovascular_issues:    patient?.has_cardiovascular_issues ?? false,
    cardiovascular_details:       patient?.cardiovascular_details || '',
    has_gastrointestinal_issues:  patient?.has_gastrointestinal_issues ?? false,
    gastrointestinal_details:     patient?.gastrointestinal_details || '',
    urological_issues:            patient?.urological_issues || '',
    gynecological_info:           patient?.gynecological_info || '',
    obstetric_history:            patient?.obstetric_history || '',
    // Red flags
    red_flags:                    patient?.red_flags ?? false,
    red_flags_details:            patient?.red_flags_details || '',
    // Note
    notes:                        patient?.notes || '',
  });

  function upd(k, v) { setF(prev => ({ ...prev, [k]: v })); }

  const dtInfo = DOC_TYPES.find(d => d.type === type);
  const isAnamnesi = type === 'anamnesi';
  const alreadySigned = existingDoc && existingDoc.status === 'signed' && !isAnamnesi;

  // Per consensi: serve firma + conferma. Per anamnesi: serve almeno conferma (firma facoltativa)
  const canSubmitDoc = alreadySigned || (signature && cbConfirm);
  const canSubmitAnamnesi = f.pain_location && f.job_activity && cbConfirm; // firma facoltativa
  const canSubmit = isAnamnesi ? canSubmitAnamnesi : canSubmitDoc;

  function submit() {
    if (isAnamnesi) {
      onSave(type, { form_data: f, signature_image: signature || null, pro_notes: proNotes, document_text: JSON.stringify(f) });
    } else {
      const legalText = dtInfo.legal.sezioni.map(s => s.titolo + '\n' + s.testo).join('\n\n');
      onSave(type, { signature_image: signature, document_text: legalText });
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '20px 16px' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{dtInfo.icon} {dtInfo.label}</div>
            {dtInfo.legal?.riferimento && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{dtInfo.legal.riferimento}</div>}
          </div>
          <button onClick={onClose} style={{ fontSize: 20, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>

          {/* ── DOCUMENTO LEGALE ── */}
          {!isAnamnesi && dtInfo.legal && dtInfo.legal.sezioni.map(s => (
            <div key={s.id} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1', marginBottom: 6 }}>{s.titolo}</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-line', background: '#f8fafc', borderRadius: 8, padding: '12px 14px' }}>{s.testo}</div>
            </div>
          ))}

          {/* ── ANAMNESI ES WORK ── */}
          {isAnamnesi && (
            <>
              {/* Dati anagrafici */}
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

              {/* Attività */}
              <ST>Attività lavorativa</ST>
              <FF label="Mansione / attività svolta">
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

              {/* Sintomatologia */}
              <ST>Sintomatologia attuale</ST>
              <FF label="Zona / sede del dolore *">
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
              <FF label="Intensità dolore NRS (0–10)">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min={0} max={10} value={f.nrs}
                    onChange={e => upd('nrs', +e.target.value)}
                    style={{ flex: 1, accentColor: f.nrs >= 7 ? '#dc2626' : f.nrs >= 4 ? '#f59e0b' : '#16a34a' }} />
                  <span style={{ fontWeight: 700, fontSize: 18, minWidth: 36, textAlign: 'center', color: f.nrs >= 7 ? '#dc2626' : f.nrs >= 4 ? '#f59e0b' : '#16a34a' }}>{f.nrs}</span>
                </div>
              </FF>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FF label="Fattori aggravanti"><textarea style={TS} rows={2} value={f.fattori_peggio} onChange={e => upd('fattori_peggio', e.target.value)} placeholder="es. seduto a lungo, sollevamenti…" /></FF>
                <FF label="Fattori allevianti"><textarea style={TS} rows={2} value={f.fattori_meglio} onChange={e => upd('fattori_meglio', e.target.value)} placeholder="es. movimento, calore, riposo…" /></FF>
              </div>

              {/* Farmaci e diagnostica */}
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

              {/* Anamnesi sistemica */}
              <ST>Anamnesi sistemica</ST>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {[
                  ['vision_issues', 'vision_details', 'Problemi visivi'],
                  ['hearing_issues', 'hearing_details', 'Problemi uditivi'],
                  ['headaches', 'headaches_details', 'Cefalee / emicranie'],
                  ['bruxism', 'bruxism_details', 'Bruxismo / serramento'],
                  ['has_cardiovascular_issues', 'cardiovascular_details', 'Prob. cardiovascolari'],
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

              {/* Red flags */}
              <div style={{ background: f.red_flags ? '#fef2f2' : '#f8fafc', border: `1px solid ${f.red_flags ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 10, padding: '12px 14px', margin: '16px 0 12px' }}>
                <Toggle checked={f.red_flags} onChange={v => upd('red_flags', v)} label="⚠️ Red flags presenti" />
                {f.red_flags && (
                  <textarea style={{ ...TS, marginTop: 8, borderColor: '#fca5a5' }} rows={2} value={f.red_flags_details} onChange={e => upd('red_flags_details', e.target.value)} placeholder="Descrivi le red flags rilevate…" />
                )}
              </div>

              <FF label="Note anamnestiche generali">
                <textarea style={TS} rows={3} value={f.notes} onChange={e => upd('notes', e.target.value)} placeholder="Annotazioni aggiuntive…" />
              </FF>

              {/* Note cliniche del professionista */}
              <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10, padding: '14px', marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>📝 Note cliniche del professionista</div>
                <div style={{ fontSize: 11, color: '#78350f', marginBottom: 8 }}>Test funzionali, valutazione posturale, palpazione. Facoltative — non visibili al paziente.</div>
                <textarea style={TS} rows={3} value={proNotes} onChange={e => setProNotes(e.target.value)} placeholder="Note riservate del professionista…" />
              </div>
            </>
          )}

          {/* ── FIRMA ── */}
          {!alreadySigned && (
            <div style={{ marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                Firma del paziente {isAnamnesi ? <span style={{ fontWeight: 400, color: '#64748b', fontSize: 12 }}>(facoltativa)</span> : <span style={{ color: '#ef4444' }}>*</span>}
              </div>
              <SignatureCanvas onChange={setSignature} />
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={cbConfirm} onChange={e => setCbConfirm(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: '#0369a1' }} />
              <span style={{ fontSize: 13, color: '#374151' }}>
                {isAnamnesi ? 'Confermo che le informazioni fornite sono corrette.' : 'Confermo di aver letto e accettato il documento.'}
              </span>
            </label>
          </div>

          {alreadySigned && (
            <div style={{ marginTop: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#15803d' }}>
              ✅ Firmato il {new Date(existingDoc.signed_at).toLocaleDateString('it-IT')}. Non modificabile.
            </div>
          )}

          {error && <div style={{ marginTop: 10, color: '#dc2626', fontSize: 13 }}>❌ {error}</div>}
        </div>

        {/* Footer */}
        {!alreadySigned && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#64748b' }}>Annulla</button>
            <button onClick={submit} disabled={!canSubmit || saving}
              style={{ padding: '9px 22px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed', background: canSubmit ? '#0369a1' : '#e2e8f0', color: canSubmit ? '#fff' : '#94a3b8' }}>
              {saving ? 'Salvataggio…' : isAnamnesi ? '💾 Salva anamnesi' : '✍️ Firma e salva'}
            </button>
          </div>
        )}
      </div>
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
