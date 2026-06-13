import Head from 'next/head';
import { requireAuthSsr } from '../../../../lib/auth';
import {
  getPatientById,
  getPatientDocuments,
  getSessionsByPatient,
  getClientById,
  getConsentByPatient,
} from '../../../../lib/store';
import { CONSENSO_TRATTAMENTO, INFORMATIVA_PRIVACY_ESTESA } from '../../../../lib/legal-texts';

const NMQ_LABELS_IT = {
  '<1m': 'Meno di 1 mese', '1-3m': '1–3 mesi', '3-6m': '3–6 mesi',
  '6-12m': '6–12 mesi', '>12m': 'Più di 12 mesi',
};

export default function PatientExport({ patient, client, documents, sessions, assessmentConsent, exportedAt }) {

  const getDoc = type => documents.find(d => d.type === type);
  const consent = getDoc('consent_treatment');
  const privacy = getDoc('privacy_extended');
  const anamnesi = getDoc('anamnesi');
  const f = anamnesi?.form_data || {};

  const closedSessions = sessions.filter(s => s.closed_at).sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <>
      <Head>
        <title>Cartella paziente — {patient.first_name} {patient.last_name}</title>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .page-break { page-break-before: always; }
            body { font-size: 11px; }
          }
          body { font-family: Georgia, serif; color: #1a1a1a; margin: 0; background: #fff; }
          .container { max-width: 800px; margin: 0 auto; padding: 32px 40px; }
          h1 { font-size: 20px; margin: 0 0 4px; }
          h2 { font-size: 14px; color: #0369a1; border-bottom: 1.5px solid #bfdbfe; padding-bottom: 4px; margin: 24px 0 12px; }
          h3 { font-size: 12px; color: #374151; margin: 14px 0 6px; font-weight: bold; }
          p, li { font-size: 11px; line-height: 1.7; color: #374151; }
          .meta { font-size: 10px; color: #6b7280; }
          .badge { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 12px; font-weight: bold; }
          .badge-ok { background: #dcfce7; color: #15803d; }
          .badge-warn { background: #fef3c7; color: #92400e; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #f8fafc; text-align: left; padding: 6px 8px; font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; border-bottom: 1px solid #e2e8f0; }
          td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
          .sig-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; margin-top: 8px; background: #f8fafc; }
          .hash { font-family: monospace; font-size: 9px; color: #94a3b8; word-break: break-all; }
          .watermark { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        `}</style>
      </Head>

      {/* Pulsante stampa (non stampato) */}
      <div className="no-print" style={{ background: '#0369a1', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#fff', fontFamily: 'system-ui', fontWeight: 700 }}>ES Work — Cartella paziente completa</span>
        <button
          onClick={() => window.print()}
          style={{ background: '#fff', color: '#0369a1', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, cursor: 'pointer', fontFamily: 'system-ui' }}
        >
          🖨️ Stampa / Salva PDF
        </button>
      </div>

      <div className="container">

        {/* ── COPERTINA ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #0369a1' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 4, letterSpacing: 1 }}>ESSENTIA SALUTIS — PROGRAMMA ES WORK</div>
            <h1>Cartella Paziente Completa</h1>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{patient.first_name} {patient.last_name}</div>
            <div className="meta" style={{ marginTop: 6 }}>
              Azienda: <strong>{client?.name}</strong> · Livello: <strong>{patient.level?.replace('level', 'L')}</strong>
              {patient.age && ` · ${patient.age} anni`}
              {patient.gender && ` · ${patient.gender}`}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 10, color: '#6b7280' }}>
            <div>Esportato il</div>
            <div style={{ fontWeight: 700 }}>{new Date(exportedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            <div style={{ marginTop: 8 }}>
              <span className="badge badge-ok">✅ Documenti completi</span>
            </div>
          </div>
        </div>

        {/* ── STATO DOCUMENTI ── */}
        <h2>Stato documenti e consensi</h2>
        <table>
          <thead><tr><th>Documento</th><th>Stato</th><th>Data firma</th><th>Hash documento</th></tr></thead>
          <tbody>
            {[
              { label: 'Consenso informato al trattamento osteopatico', doc: consent },
              { label: 'Informativa privacy (art. 13 GDPR)', doc: privacy },
              { label: 'Anamnesi strutturata ES Work', doc: anamnesi },
            ].map(({ label, doc }) => (
              <tr key={label}>
                <td>{label}</td>
                <td><span className={`badge ${doc?.status === 'signed' || doc?.status === 'completed' ? 'badge-ok' : 'badge-warn'}`}>{doc?.status === 'signed' ? 'Firmato' : doc?.status === 'completed' ? 'Compilato' : 'Mancante'}</span></td>
                <td>{doc?.signed_at ? new Date(doc.signed_at).toLocaleDateString('it-IT') : '—'}</td>
                <td className="hash">{doc?.content_hash ? doc.content_hash.slice(0, 32) + '…' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── CONSENSO TRATTAMENTO ── */}
        <div className="page-break" />
        <h2>1. {CONSENSO_TRATTAMENTO.titolo}</h2>
        <p className="meta">{CONSENSO_TRATTAMENTO.riferimento}</p>
        {CONSENSO_TRATTAMENTO.sezioni.map(s => (
          <div key={s.id}>
            <h3>{s.titolo}</h3>
            <p style={{ whiteSpace: 'pre-line' }}>{s.testo}</p>
          </div>
        ))}
        {consent && (
          <div className="sig-box">
            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Firma del paziente — {new Date(consent.signed_at).toLocaleDateString('it-IT')}</div>
            {consent.signature_image && (
              <img src={consent.signature_image} alt="Firma" style={{ maxWidth: 300, height: 80, objectFit: 'contain', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 4 }} />
            )}
            <div className="hash" style={{ marginTop: 6 }}>SHA-256: {consent.content_hash}</div>
          </div>
        )}

        {/* ── INFORMATIVA PRIVACY ── */}
        <div className="page-break" />
        <h2>2. {INFORMATIVA_PRIVACY_ESTESA.titolo}</h2>
        <p className="meta">{INFORMATIVA_PRIVACY_ESTESA.riferimento}</p>
        {INFORMATIVA_PRIVACY_ESTESA.sezioni.map(s => (
          <div key={s.id}>
            <h3>{s.titolo}</h3>
            <p style={{ whiteSpace: 'pre-line' }}>{s.testo}</p>
          </div>
        ))}
        {privacy && (
          <div className="sig-box">
            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Firma del paziente — {new Date(privacy.signed_at).toLocaleDateString('it-IT')}</div>
            {privacy.signature_image && (
              <img src={privacy.signature_image} alt="Firma" style={{ maxWidth: 300, height: 80, objectFit: 'contain', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 4 }} />
            )}
            <div className="hash" style={{ marginTop: 6 }}>SHA-256: {privacy.content_hash}</div>
          </div>
        )}

        {/* ── ANAMNESI ── */}
        <div className="page-break" />
        <h2>3. Anamnesi strutturata ES Work</h2>
        {anamnesi ? (
          <>
            <h3>Storia clinica</h3>
            <table>
              <tbody>
                {[
                  ['Patologie pregresse/in corso', f.patologie_pregresse],
                  ['Interventi chirurgici', f.interventi_chirurgici],
                  ['Farmaci in corso', f.farmaci_in_corso],
                  ['Allergie', f.allergie],
                  ['Familiarità', f.familiarita],
                ].map(([k, v]) => v ? <tr key={k}><td style={{ width: 200, color: '#6b7280' }}>{k}</td><td>{v}</td></tr> : null)}
              </tbody>
            </table>
            <h3>Disturbi attuali</h3>
            <table>
              <tbody>
                <tr><td style={{ width: 200, color: '#6b7280' }}>Motivo consultazione</td><td>{f.motivo_consultazione}</td></tr>
                <tr><td style={{ color: '#6b7280' }}>Zone interessate</td><td>{(f.sede_dolore || []).join(', ') || '—'}</td></tr>
                <tr><td style={{ color: '#6b7280' }}>NRS iniziale</td><td><strong style={{ fontSize: 14 }}>{f.nrs}/10</strong></td></tr>
                <tr><td style={{ color: '#6b7280' }}>Durata disturbo</td><td>{NMQ_LABELS_IT[f.durata] || f.durata}</td></tr>
                {f.fattori_peggio && <tr><td style={{ color: '#6b7280' }}>Fattori peggiorativi</td><td>{f.fattori_peggio}</td></tr>}
                {f.fattori_meglio && <tr><td style={{ color: '#6b7280' }}>Fattori migliorativi</td><td>{f.fattori_meglio}</td></tr>}
                {f.sesso_f && <tr><td style={{ color: '#6b7280' }}>Gravidanza in corso</td><td>{f.gravidanza ? `Sì — settimana ${f.settimana_gravidanza}` : 'No'}</td></tr>}
              </tbody>
            </table>
            {anamnesi.pro_notes && (
              <>
                <h3>Note cliniche del professionista</h3>
                <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 12px', fontSize: 11 }}>
                  {anamnesi.pro_notes}
                </div>
              </>
            )}
            <div className="sig-box" style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>Firma del paziente — {new Date(anamnesi.signed_at).toLocaleDateString('it-IT')}</div>
              {anamnesi.signature_image && (
                <img src={anamnesi.signature_image} alt="Firma" style={{ maxWidth: 300, height: 80, objectFit: 'contain', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 4 }} />
              )}
            </div>
          </>
        ) : <p>Anamnesi non disponibile.</p>}

        {/* ── SESSIONI ── */}
        <div className="page-break" />
        <h2>4. Storico sedute e trend NRS</h2>
        {closedSessions.length === 0 ? (
          <p>Nessuna seduta registrata.</p>
        ) : (
          <table>
            <thead><tr><th>#</th><th>Data</th><th>NRS pre</th><th>Note trattamento</th><th>Indicazioni prossima</th></tr></thead>
            <tbody>
              {closedSessions.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td>{new Date(s.date).toLocaleDateString('it-IT')}</td>
                  <td><strong style={{ color: s.nrs_pre >= 7 ? '#dc2626' : s.nrs_pre >= 4 ? '#ca8a04' : '#16a34a' }}>{s.nrs_pre ?? '—'}/10</strong></td>
                  <td>{s.treatment_notes || '—'}</td>
                  <td>{s.next_session_notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── CONSENSO PRE-QUESTIONARIO (prova GDPR) ── */}
        <h2>Consenso pre-questionario (assessment)</h2>
        {assessmentConsent ? (
          <table>
            <tbody>
              <tr><td><strong>Consenso dati personali</strong></td><td>✓ prestato il {new Date(assessmentConsent.consent_privacy_at).toLocaleString('it-IT')}</td></tr>
              <tr><td><strong>Consenso dati di salute (art. 9 GDPR)</strong></td><td>✓ prestato il {new Date(assessmentConsent.consent_health_at).toLocaleString('it-IT')}</td></tr>
              <tr><td><strong>Versione informativa accettata</strong></td><td>{assessmentConsent.informativa_version || '—'}</td></tr>
              <tr><td><strong>Registrato il</strong></td><td>{assessmentConsent.created_at ? new Date(assessmentConsent.created_at).toLocaleString('it-IT') : '—'}</td></tr>
              <tr><td><strong>Impronta tecnica</strong></td><td>IP (hash): {assessmentConsent.ip_hash || '—'} · User-agent: {assessmentConsent.user_agent || '—'}</td></tr>
            </tbody>
          </table>
        ) : (
          <p style={{ color: '#64748b' }}>Nessun consenso pre-questionario registrato per questo paziente.</p>
        )}

        {/* ── WATERMARK ── */}
        <div className="watermark">
          Documento generato da ES Work — Essentia Salutis · info@essentiasalutis.it · Via Salbertrand 9, Torino<br />
          Conservazione 10 anni dall'ultima seduta ai sensi degli obblighi normativi sulle cartelle cliniche
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = requireAuthSsr(async (ctx) => {
  const { patientId } = ctx.params;

  const patient = await getPatientById(patientId);
  if (!patient) return { notFound: true };

  const [documents, sessions, client, assessmentConsent] = await Promise.all([
    getPatientDocuments(patientId),
    getSessionsByPatient(patientId),
    getClientById(patient.client_id),
    getConsentByPatient(patientId).catch(() => null),
  ]);

  return {
    props: {
      patient,
      client,
      documents: JSON.parse(JSON.stringify(documents)), // serializza Date
      sessions: JSON.parse(JSON.stringify(sessions)),
      assessmentConsent: assessmentConsent ? JSON.parse(JSON.stringify(assessmentConsent)) : null,
      exportedAt: new Date().toISOString(),
    },
  };
});
