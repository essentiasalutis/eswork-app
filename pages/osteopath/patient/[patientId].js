import Head from 'next/head';
import Link from 'next/link';
import { requireProAuthSsr } from '../../../lib/pro-auth';
import {
  getPatientById,
  getSessionsByPatient,
  getCyclesByPatient,
  getPreValidationByPatient,
  getReassessmentT12ByPatient,
  getMiniChecksByPatient,
  proCanAccessPatientClinical,
} from '../../../lib/store';

const LEVEL_LABELS = { level1: 'Livello 1', level2: 'Livello 2', level3: 'Livello 3' };
const LEVEL_COLORS = { level1: 'bg-blue-100 text-blue-800 border-blue-200', level2: 'bg-amber-100 text-amber-800 border-amber-200', level3: 'bg-green-100 text-green-800 border-green-200' };

function NrsBar({ value, max = 10, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color || '#dc2626' }} />
      </div>
      <span className="text-xs font-bold w-6 text-right" style={{ color: color || '#dc2626' }}>{value}</span>
    </div>
  );
}

// Grafico NRS mini (canvas-free con divs)
function NrsChart({ nrsSeries }) {
  if (!nrsSeries || nrsSeries.length === 0) return null;
  const maxNrs = 10;
  const w = 100 / (nrsSeries.length > 1 ? nrsSeries.length - 1 : 1);

  return (
    <div style={{ position: 'relative', height: 80, marginTop: 8 }}>
      <svg width="100%" height="80" viewBox={`0 0 ${nrsSeries.length * 40} 80`} preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 5, 10].map(v => {
          const y = 72 - (v / maxNrs) * 64;
          return <line key={v} x1={0} y1={y} x2={nrsSeries.length * 40} y2={y} stroke="#f1f5f9" strokeWidth={1} />;
        })}
        {/* NRS post line (verde) */}
        {nrsSeries.filter(s => s.nrs_post != null).map((s, i) => {
          const next = nrsSeries.filter(n => n.nrs_post != null)[i + 1];
          if (!next) return null;
          const x1 = s.session * 40 - 20; const y1 = 72 - (s.nrs_post / maxNrs) * 64;
          const x2 = next.session * 40 - 20; const y2 = 72 - (next.nrs_post / maxNrs) * 64;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#16a34a" strokeWidth={2} />;
        })}
        {/* NRS post dots */}
        {nrsSeries.filter(s => s.nrs_post != null).map((s, i) => (
          <circle key={i} cx={s.session * 40 - 20} cy={72 - (s.nrs_post / maxNrs) * 64} r={4} fill="#16a34a" />
        ))}
        {/* NRS pre dots (rossi, piccoli) */}
        {nrsSeries.filter(s => s.nrs_pre != null).map((s, i) => (
          <circle key={`pre-${i}`} cx={s.session * 40 - 20} cy={72 - (s.nrs_pre / maxNrs) * 64} r={3} fill="#dc2626" opacity={0.5} />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        {nrsSeries.map(s => <span key={s.session} style={{ width: 40, textAlign: 'center' }}>S{s.session}</span>)}
      </div>
    </div>
  );
}

export default function OsteopathPatientView({ patient, sessions, cycles, preValidation, reassessmentT12, miniChecks, nrsSeries }) {
  const level = patient.level;
  const activeCycle = cycles.find(c => c.status === 'active');

  return (
    <>
      <Head><title>{patient.first_name} {patient.last_name} — ES Work</title></Head>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-3">
            <Link href="/osteopath/dashboard" className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1">
              <div className="font-bold text-gray-900">{patient.first_name} {patient.last_name}</div>
              <div className="text-xs text-gray-500">{patient.clients?.name || '—'}</div>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full border ${LEVEL_COLORS[level] || LEVEL_COLORS.level3}`}>
              {LEVEL_LABELS[level] || level}
            </span>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-5 py-5 space-y-5">

          {/* Dati demografici */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Anagrafica</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                { label: 'Azienda', value: patient.clients?.name },
                { label: 'Livello', value: LEVEL_LABELS[level] || level },
                { label: 'Status', value: patient.level_status === 'opted_out' ? '🏁 Percorso completato' : patient.level_status === 'active' ? '✅ Attivo' : '⏳ In attesa' },
                { label: 'Ciclo attuale', value: patient.current_cycle ? `Ciclo ${patient.current_cycle}` : '—' },
                { label: 'Sede', value: patient.location || '—' },
                { label: 'Genere', value: patient.gender === 'M' ? 'Maschio' : patient.gender === 'F' ? 'Femmina' : '—' },
              ].map(item => (
                <div key={item.label}>
                  <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                  <div className="font-semibold text-gray-800">{item.value || '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Pre-validazione */}
          {preValidation && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Pre-validazione clinica</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div><div className="text-xs text-gray-400">Esito</div>
                  <div className={`font-bold ${preValidation.outcome === 'l1_confirmed' ? 'text-green-700' : preValidation.outcome === 'not_l1' ? 'text-red-600' : 'text-amber-600'}`}>
                    {preValidation.outcome === 'l1_confirmed' ? '✅ L1 confermato' : preValidation.outcome === 'not_l1' ? '❌ Non L1' : '⏳ Ulteriori info'}
                  </div>
                </div>
                <div><div className="text-xs text-gray-400">NRS call</div><div className="font-bold text-gray-800">{preValidation.nrs_during_call ?? '—'}/10</div></div>
                <div><div className="text-xs text-gray-400">Zona dolore</div><div className="font-semibold text-gray-800">{preValidation.pain_zone || '—'}</div></div>
                <div><div className="text-xs text-gray-400">Durata sintomi</div><div className="font-semibold text-gray-800">{preValidation.symptom_duration_months != null ? `${preValidation.symptom_duration_months} mesi` : '—'}</div></div>
                <div><div className="text-xs text-gray-400">Durata call</div><div className="font-semibold text-gray-800">{preValidation.duration_minutes ? `${preValidation.duration_minutes} min` : '—'}</div></div>
                <div><div className="text-xs text-gray-400">Data</div><div className="font-semibold text-gray-800">{new Date(preValidation.created_at).toLocaleDateString('it-IT')}</div></div>
              </div>
              {preValidation.clinical_notes && (
                <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-xl p-3 italic">{preValidation.clinical_notes}</div>
              )}
            </div>
          )}

          {/* Grafico NRS */}
          {nrsSeries.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Andamento NRS nel tempo</div>
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                <span><span className="inline-block w-3 h-0.5 bg-red-400 mr-1 opacity-50" />NRS pre-sessione</span>
                <span><span className="inline-block w-3 h-0.5 bg-green-600 mr-1" />NRS post-sessione</span>
              </div>
              <NrsChart nrsSeries={nrsSeries} />
            </div>
          )}

          {/* Cicli di trattamento */}
          {cycles.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Cicli di trattamento</div>
              <div className="space-y-3">
                {cycles.map(c => (
                  <div key={c.id} className={`rounded-xl border p-3 ${c.status === 'active' ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-gray-900">Ciclo {c.cycle_number}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {c.status === 'active' ? 'In corso' : 'Chiuso'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {c.sessions_completed}/{c.sessions_planned} sessioni
                      {c.outcome && ` · ${c.outcome === 'improved' ? '✅ Migliorato' : '⚠️ Non migliorato'}`}
                      {c.closed_at && ` · Chiuso ${new Date(c.closed_at).toLocaleDateString('it-IT')}`}
                    </div>
                    {c.status === 'active' && (
                      <div className="mt-2 flex gap-1">
                        {[1,2,3,4].map(n => (
                          <div key={n} className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${n <= c.sessions_completed ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                            {n <= c.sessions_completed ? '✓' : n}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Storico sessioni */}
          {sessions.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Sessioni ({sessions.length})</div>
              <div className="space-y-2">
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800">
                        {s.date ? new Date(s.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </div>
                      {s.notes && <div className="text-xs text-gray-400 truncate">{s.notes}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.nrs_pre != null && (
                        <div className="text-center">
                          <div className="text-xs text-gray-400">Pre</div>
                          <div className="text-sm font-bold text-red-500">{s.nrs_pre}</div>
                        </div>
                      )}
                      {s.nrs_post != null && (
                        <div className="text-center">
                          <div className="text-xs text-gray-400">Post</div>
                          <div className="text-sm font-bold text-green-600">{s.nrs_post}</div>
                        </div>
                      )}
                      <Link href={`/osteopath/session/${s.id}`}
                        className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-100">
                        Modifica
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mini-check */}
          {miniChecks.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Mini-check ricevuti</div>
              {miniChecks.map(mc => (
                <div key={mc.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 text-sm">
                  <div>
                    <span className="font-semibold text-gray-700">{mc.check_type?.toUpperCase()}</span>
                    <span className="text-gray-400 ml-2">NRS {mc.nrs_current ?? '—'}</span>
                    {mc.has_limitations && <span className="ml-2 text-amber-600 text-xs font-semibold">Limitazioni</span>}
                    {mc.wants_contact && <span className="ml-2 text-blue-600 text-xs font-semibold">Vuole contatto</span>}
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${mc.triage_outcome === 'needs_contact' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {mc.triage_outcome === 'needs_contact' ? 'Da contattare' : 'OK'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Re-assessment T12 */}
          {reassessmentT12 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Re-assessment 12 mesi</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-gray-400">Livello risultante</div>
                  <div className={`font-bold ${reassessmentT12.computed_level === 'level1' ? 'text-blue-700' : reassessmentT12.computed_level === 'level2' ? 'text-amber-700' : 'text-green-700'}`}>
                    {LEVEL_LABELS[reassessmentT12.computed_level] || '—'}
                  </div>
                </div>
                <div><div className="text-xs text-gray-400">PGIC</div>
                  <div className="font-bold text-gray-800">
                    {reassessmentT12.pgic ? ['', '😢 Molto peggiorato', '🙁 Peggiorato', '😐 Invariato', '🙂 Migliorato', '😄 Molto migliorato'][reassessmentT12.pgic] : '—'}
                  </div>
                </div>
                <div><div className="text-xs text-gray-400">Completato</div>
                  <div className="font-semibold text-gray-800">{reassessmentT12.completed_at ? new Date(reassessmentT12.completed_at).toLocaleDateString('it-IT') : '—'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Link area professionale */}
          <Link href={`/pro/patients/${patient.id}`}
            className="block bg-white rounded-2xl border border-gray-200 p-4 text-center text-sm font-semibold text-blue-700 hover:border-blue-300 transition-colors">
            Apri cartella completa nell&apos;area professionale →
          </Link>

        </main>
      </div>
    </>
  );
}

export const getServerSideProps = requireProAuthSsr(async (ctx) => {
  const { patientId } = ctx.params;
  const proId = ctx.req.proSession.proId;

  const patient = await getPatientById(patientId).catch(() => null);
  if (!patient) return { notFound: true };

  // Cartella clinica (Livello B): SOLO l'osteopata assegnato al paziente.
  if (!(await proCanAccessPatientClinical(proId, patient))) return { notFound: true };

  const [sessions, cycles, preValidation, reassessmentT12, miniChecks] = await Promise.all([
    getSessionsByPatient(patientId).catch(() => []),
    getCyclesByPatient(patientId).catch(() => []),
    getPreValidationByPatient(patientId).catch(() => null),
    getReassessmentT12ByPatient(patientId).catch(() => null),
    getMiniChecksByPatient(patientId).catch(() => []),
  ]);

  const nrsSeries = sessions
    .filter(s => s.nrs_post != null)
    .sort((a, b) => new Date(a.date || a.created_at) - new Date(b.date || b.created_at))
    .map((s, i) => ({ session: i + 1, date: s.date || s.created_at, nrs_pre: s.nrs_pre, nrs_post: s.nrs_post }));

  return {
    props: { patient, sessions, cycles, preValidation: preValidation || null, reassessmentT12: reassessmentT12 || null, miniChecks, nrsSeries },
  };
});
