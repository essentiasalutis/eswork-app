import { useState } from 'react';
import SignatureCanvas from './SignatureCanvas';
import { CONSENSO_TRATTAMENTO, INFORMATIVA_PRIVACY_ESTESA } from '../lib/legal-texts';

const NMQ_ZONES = [
  'Collo', 'Spalle', 'Schiena alta (dorsale)', 'Schiena bassa (lombare)',
  'Gomiti', 'Polsi / Mani', 'Anche / Cosce', 'Ginocchia', 'Caviglie / Piedi',
];

const DOC_TYPES = [
  {
    type: 'consent_treatment',
    label: 'Consenso informato al trattamento osteopatico',
    icon: '📋',
    legal: CONSENSO_TRATTAMENTO,
  },
  {
    type: 'privacy_extended',
    label: 'Informativa privacy (art. 13 GDPR)',
    icon: '🔒',
    legal: INFORMATIVA_PRIVACY_ESTESA,
  },
  {
    type: 'anamnesi',
    label: 'Anamnesi strutturata ES Work',
    icon: '🩺',
    legal: null,
  },
];

export default function PatientDocuments({ patientId, clientId, documents: initialDocs, onDocsChange }) {
  const [docs, setDocs] = useState(initialDocs || []);
  const [activeModal, setActiveModal] = useState(null); // type string
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function getDoc(type) {
    return docs.find(d => d.type === type);
  }

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
        const newDocs = exists
          ? prev.map(d => d.type === type ? updated : d)
          : [...prev, updated];
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
      {/* Lista documenti */}
      <div className="space-y-2">
        {DOC_TYPES.map(dt => {
          const doc = getDoc(dt.type);
          const signed = doc && (doc.status === 'signed' || doc.status === 'completed');
          return (
            <div
              key={dt.type}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{dt.icon}</span>
                <div>
                  <div className="text-sm font-medium text-gray-800">{dt.label}</div>
                  <div className={`text-xs mt-0.5 font-medium ${signed ? 'text-green-600' : 'text-orange-500'}`}>
                    {signed
                      ? `✅ ${dt.type === 'anamnesi' ? 'Compilata' : 'Firmata'} il ${new Date(doc.signed_at).toLocaleDateString('it-IT')}`
                      : `⚠️ ${dt.type === 'anamnesi' ? 'Non compilata' : 'Non firmata'}`
                    }
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(dt.type)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  signed
                    ? 'text-gray-500 border border-gray-200 hover:bg-gray-50'
                    : 'text-white bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {signed ? (dt.type === 'anamnesi' ? '✏️ Modifica' : '👁 Rivedi') : (dt.type === 'anamnesi' ? '📝 Compila' : '✍️ Firma')}
              </button>
            </div>
          );
        })}
      </div>

      {/* Modale */}
      {activeModal && (
        <DocModal
          type={activeModal}
          patientId={patientId}
          clientId={clientId}
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

// ─── Modale firma / compilazione ──────────────────────────────────────────────

function DocModal({ type, existingDoc, saving, error, onSave, onClose }) {
  const [signature, setSignature] = useState(null);
  const [cbConfirm, setCbConfirm] = useState(false);
  const [proNotes, setProNotes] = useState(existingDoc?.pro_notes || '');

  // Campi anamnesi
  const [anamnesi, setAnamnesi] = useState(existingDoc?.form_data || {
    // Storia clinica
    patologie_pregresse: '',
    interventi_chirurgici: '',
    farmaci_in_corso: '',
    allergie: '',
    familiarita: '',
    // Disturbi attuali
    motivo_consultazione: '',
    sede_dolore: [],
    nrs: 0,
    durata: '',
    fattori_peggio: '',
    fattori_meglio: '',
    // Condizionale
    sesso_f: false,
    gravidanza: false,
    settimana_gravidanza: '',
  });

  const dtInfo = DOC_TYPES.find(d => d.type === type);
  const isAnamnesi = type === 'anamnesi';
  const alreadySigned = existingDoc && existingDoc.status === 'signed' && !isAnamnesi;

  const canSubmitDoc = alreadySigned || (signature && cbConfirm);
  const canSubmitAnamnesi = anamnesi.motivo_consultazione && anamnesi.sede_dolore.length > 0 && anamnesi.durata && signature && cbConfirm;

  const canSubmit = isAnamnesi ? canSubmitAnamnesi : canSubmitDoc;

  function handleZoneToggle(zone) {
    setAnamnesi(prev => ({
      ...prev,
      sede_dolore: prev.sede_dolore.includes(zone)
        ? prev.sede_dolore.filter(z => z !== zone)
        : [...prev.sede_dolore, zone],
    }));
  }

  function submit() {
    if (isAnamnesi) {
      onSave(type, {
        form_data: anamnesi,
        signature_image: signature,
        pro_notes: proNotes,
        document_text: JSON.stringify(anamnesi),
      });
    } else {
      const legalText = dtInfo.legal.sezioni.map(s => s.titolo + '\n' + s.testo).join('\n\n');
      onSave(type, {
        signature_image: signature,
        document_text: legalText,
      });
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      overflowY: 'auto', padding: '20px 16px',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header modale */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{dtInfo.label}</div>
            {dtInfo.legal?.riferimento && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{dtInfo.legal.riferimento}</div>
            )}
          </div>
          <button onClick={onClose} style={{ fontSize: 20, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>

          {/* ── DOCUMENTO LEGALE (consenso / privacy) ── */}
          {!isAnamnesi && dtInfo.legal && (
            <>
              {dtInfo.legal.sezioni.map(s => (
                <div key={s.id} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1', marginBottom: 6 }}>{s.titolo}</div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-line', background: '#f8fafc', borderRadius: 8, padding: '12px 14px' }}>
                    {s.testo}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── ANAMNESI STRUTTURATA ── */}
          {isAnamnesi && (
            <>
              <SectionTitle>Storia clinica</SectionTitle>
              <FormField label="Patologie pregresse o in corso">
                <textarea rows={2} value={anamnesi.patologie_pregresse} onChange={e => setAnamnesi(p => ({ ...p, patologie_pregresse: e.target.value }))} style={textareaStyle} placeholder="es. ernia del disco L4-L5, ipertensione..." />
              </FormField>
              <FormField label="Interventi chirurgici">
                <textarea rows={2} value={anamnesi.interventi_chirurgici} onChange={e => setAnamnesi(p => ({ ...p, interventi_chirurgici: e.target.value }))} style={textareaStyle} placeholder="es. appendicectomia 2015, nessuno..." />
              </FormField>
              <FormField label="Terapie farmacologiche in corso">
                <textarea rows={2} value={anamnesi.farmaci_in_corso} onChange={e => setAnamnesi(p => ({ ...p, farmaci_in_corso: e.target.value }))} style={textareaStyle} placeholder="es. ibuprofene al bisogno, nessuna..." />
              </FormField>
              <FormField label="Allergie note">
                <textarea rows={1} value={anamnesi.allergie} onChange={e => setAnamnesi(p => ({ ...p, allergie: e.target.value }))} style={textareaStyle} placeholder="es. penicillina, lattice, nessuna..." />
              </FormField>
              <FormField label="Patologie familiari rilevanti">
                <textarea rows={1} value={anamnesi.familiarita} onChange={e => setAnamnesi(p => ({ ...p, familiarita: e.target.value }))} style={textareaStyle} placeholder="es. diabete tipo 2, cardiopatie, nessuna..." />
              </FormField>

              <SectionTitle>Disturbi attuali</SectionTitle>
              <FormField label="Motivo della consultazione *">
                <textarea rows={2} value={anamnesi.motivo_consultazione} onChange={e => setAnamnesi(p => ({ ...p, motivo_consultazione: e.target.value }))} style={textareaStyle} placeholder="Descrivi il disturbo principale..." />
              </FormField>

              <FormField label="Sede del dolore (seleziona tutte le zone interessate) *">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {NMQ_ZONES.map(z => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => handleZoneToggle(z)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        border: '1.5px solid',
                        cursor: 'pointer',
                        borderColor: anamnesi.sede_dolore.includes(z) ? '#0369a1' : '#e2e8f0',
                        background: anamnesi.sede_dolore.includes(z) ? '#eff6ff' : '#fff',
                        color: anamnesi.sede_dolore.includes(z) ? '#0369a1' : '#64748b',
                      }}
                    >
                      {z}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label="Intensità del dolore NRS (0 = nessun dolore, 10 = massimo)">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="range" min={0} max={10} value={anamnesi.nrs}
                    onChange={e => setAnamnesi(p => ({ ...p, nrs: +e.target.value }))}
                    style={{ flex: 1, accentColor: anamnesi.nrs >= 7 ? '#dc2626' : anamnesi.nrs >= 4 ? '#f59e0b' : '#16a34a' }}
                  />
                  <span style={{
                    fontWeight: 700, fontSize: 18, minWidth: 36, textAlign: 'center',
                    color: anamnesi.nrs >= 7 ? '#dc2626' : anamnesi.nrs >= 4 ? '#f59e0b' : '#16a34a',
                  }}>{anamnesi.nrs}</span>
                </div>
              </FormField>

              <FormField label="Da quanto tempo *">
                <select value={anamnesi.durata} onChange={e => setAnamnesi(p => ({ ...p, durata: e.target.value }))} style={selectStyle}>
                  <option value="">Seleziona…</option>
                  <option value="<1m">Meno di 1 mese</option>
                  <option value="1-3m">1–3 mesi</option>
                  <option value="3-6m">3–6 mesi</option>
                  <option value="6-12m">6–12 mesi</option>
                  <option value=">12m">Più di 12 mesi</option>
                </select>
              </FormField>

              <FormField label="Fattori che peggiorano il disturbo">
                <textarea rows={2} value={anamnesi.fattori_peggio} onChange={e => setAnamnesi(p => ({ ...p, fattori_peggio: e.target.value }))} style={textareaStyle} placeholder="es. stare seduto a lungo, sollevare pesi..." />
              </FormField>
              <FormField label="Fattori che migliorano il disturbo">
                <textarea rows={2} value={anamnesi.fattori_meglio} onChange={e => setAnamnesi(p => ({ ...p, fattori_meglio: e.target.value }))} style={textareaStyle} placeholder="es. movimento, calore, riposo..." />
              </FormField>

              {/* Campo condizionale sesso femminile */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 8px' }}>
                <input type="checkbox" id="sessof" checked={anamnesi.sesso_f} onChange={e => setAnamnesi(p => ({ ...p, sesso_f: e.target.checked, gravidanza: false, settimana_gravidanza: '' }))} style={{ width: 16, height: 16 }} />
                <label htmlFor="sessof" style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>Sesso biologico femminile</label>
              </div>
              {anamnesi.sesso_f && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 8px 24px' }}>
                    <input type="checkbox" id="grav" checked={anamnesi.gravidanza} onChange={e => setAnamnesi(p => ({ ...p, gravidanza: e.target.checked, settimana_gravidanza: '' }))} style={{ width: 16, height: 16 }} />
                    <label htmlFor="grav" style={{ fontSize: 13, color: '#374151', cursor: 'pointer' }}>Gravidanza in corso</label>
                  </div>
                  {anamnesi.gravidanza && (
                    <FormField label="Settimana di gravidanza">
                      <input type="number" min={1} max={42} value={anamnesi.settimana_gravidanza} onChange={e => setAnamnesi(p => ({ ...p, settimana_gravidanza: e.target.value }))} style={{ ...inputStyle, width: 100 }} placeholder="es. 20" />
                    </FormField>
                  )}
                </>
              )}

              {/* Note cliniche del professionista (facoltative) */}
              <div style={{ marginTop: 24, padding: '16px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>📝 Note cliniche del professionista (facoltative — non visibili al paziente)</div>
                <div style={{ fontSize: 12, color: '#78350f', marginBottom: 8 }}>
                  Test funzionali, valutazione posturale, palpazione, osservazioni aggiuntive. Non sostituisce l'anamnesi ES Work, la integra.
                </div>
                <textarea
                  rows={3}
                  value={proNotes}
                  onChange={e => setProNotes(e.target.value)}
                  style={textareaStyle}
                  placeholder="Note riservate del professionista…"
                />
              </div>
            </>
          )}

          {/* ── FIRMA (per tutti) ── */}
          {!alreadySigned && (
            <>
              <div style={{ marginTop: 24, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
                  {isAnamnesi ? 'Firma del paziente (dichiarazione finale)' : 'Firma del paziente'}
                </div>
                {isAnamnesi && (
                  <div style={{ fontSize: 12, color: '#475569', marginBottom: 12, background: '#f8fafc', padding: '10px 12px', borderRadius: 8 }}>
                    Il/La sottoscritto/a dichiara che le informazioni fornite nell'anamnesi sono complete e veritiere, e di prestare il proprio consenso al trattamento dei dati clinici ai sensi dell'art. 9 GDPR per le finalità del programma ES Work.
                  </div>
                )}
                <SignatureCanvas onChange={setSignature} />
              </div>

              <div style={{ marginTop: 16 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cbConfirm}
                    onChange={e => setCbConfirm(e.target.checked)}
                    style={{ width: 18, height: 18, marginTop: 2, accentColor: '#0369a1' }}
                  />
                  <span style={{ fontSize: 13, color: '#374151' }}>
                    {isAnamnesi
                      ? 'Confermo che le informazioni fornite sono corrette e accetto il trattamento dei miei dati.'
                      : 'Confermo di aver letto e accettato il documento.'}
                  </span>
                </label>
              </div>
            </>
          )}

          {alreadySigned && (
            <div style={{ marginTop: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#15803d' }}>
              ✅ Documento firmato il {new Date(existingDoc.signed_at).toLocaleDateString('it-IT')}. Non è possibile modificarlo.
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, color: '#dc2626', fontSize: 13 }}>❌ {error}</div>
          )}
        </div>

        {/* Footer modale */}
        {!alreadySigned && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#64748b' }}>
              Annulla
            </button>
            <button
              onClick={submit}
              disabled={!canSubmit || saving}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed',
                background: canSubmit ? '#0369a1' : '#e2e8f0', color: canSubmit ? '#fff' : '#94a3b8',
              }}
            >
              {saving ? 'Salvataggio…' : isAnamnesi ? '💾 Salva anamnesi' : '✍️ Firma e salva'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers UI ──────────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1', marginTop: 20, marginBottom: 10, paddingBottom: 6, borderBottom: '1.5px solid #bfdbfe' }}>
      {children}
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

const textareaStyle = {
  width: '100%', boxSizing: 'border-box', padding: '8px 12px',
  border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13,
  fontFamily: 'inherit', resize: 'vertical', outline: 'none',
};

const inputStyle = {
  padding: '8px 12px', border: '1.5px solid #e2e8f0',
  borderRadius: 8, fontSize: 13, outline: 'none',
};

const selectStyle = {
  width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0',
  borderRadius: 8, fontSize: 13, background: '#fff', outline: 'none',
};
