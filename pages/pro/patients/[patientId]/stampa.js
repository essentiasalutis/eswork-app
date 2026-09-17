// Modulo da stampare per la firma su carta (punto d). Il testo viene SOLO
// dall'archivio (versione in vigore); codice, versione e impronta sono stampati
// su ogni pagina, così la versione è scritta sul foglio e non va ricordata.
// Nessun testo legale aggiunto dal codice: sul foglio c'è solo ciò che l'impronta
// copre, più gli spazi per nome, data e firma.
import Head from 'next/head';
import { requireProAuthSsr } from '../../../../lib/pro-auth';
import { getPatientById, proCanAccessPatientClinical } from '../../../../lib/store';
import { CODICE_PER_DOCUMENTO, cartaSospesa } from '../../../../lib/copia-cartacea.mjs';

export default function StampaModulo({ testo, paziente }) {
  const c = testo.contenuto || {};
  const riferimento = `${testo.codice} · versione ${testo.versione} · impronta ${testo.impronta.slice(0, 12)}`;
  return (
    <>
      <Head>
        <title>{`${c.titolo || 'Modulo'} — versione ${testo.versione}`}</title>
        <style>{`
          @page { size: A4; margin: 18mm 16mm 22mm; }
          body { font-family: Georgia, 'Times New Roman', serif; color: #111; background: #fff; margin: 0; }
          .foglio { max-width: 760px; margin: 0 auto; padding: 28px 32px 90px; }
          h1 { font-size: 19px; margin: 0 0 4px; }
          .sotto { font-size: 12px; color: #444; margin: 0 0 18px; }
          h2 { font-size: 13px; margin: 18px 0 6px; }
          p { font-size: 12px; line-height: 1.6; margin: 0; white-space: pre-line; }
          .firma { margin-top: 30px; border-top: 1px solid #111; padding-top: 16px; display: grid; gap: 22px; break-inside: avoid; }
          .riga { display: flex; gap: 10px; align-items: flex-end; font-size: 12px; }
          .riga span:last-child { flex: 1; border-bottom: 1px solid #111; min-height: 20px; }
          .osteopata { margin-top: 26px; border: 1px dashed #666; padding: 10px 12px; font-size: 11px; color: #333; break-inside: avoid; }
          .piede { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-family: 'Courier New', monospace; font-size: 10px; color: #333; padding: 6px 0; background: #fff; }
          .comandi { background: #0f172a; color: #fff; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; font-family: system-ui, sans-serif; font-size: 13px; }
          .comandi button { background: #fff; color: #0f172a; border: 0; border-radius: 8px; padding: 7px 14px; font-weight: 700; cursor: pointer; }
          @media print { .comandi { display: none; } .foglio { padding: 0 0 40px; } }
        `}</style>
      </Head>
      <div className="comandi">
        <span>Versione {testo.versione} in vigore — stampala e falla firmare. Poi carica la copia in cartella entro 7 giorni.</span>
        <button onClick={() => window.print()}>Stampa</button>
      </div>
      <div className="foglio">
        <h1>{c.titolo}</h1>
        {(c.sottotitolo || c.riferimento) && <div className="sotto">{[c.sottotitolo, c.riferimento].filter(Boolean).join(' · ')}</div>}
        {(c.sezioni || []).map((s, i) => (
          <section key={s.id || i}>
            {s.titolo && <h2>{s.titolo}</h2>}
            <p>{s.testo}</p>
          </section>
        ))}
        {c.consensi && Object.keys(c.consensi).sort().map(k => (
          <p key={k} style={{ marginTop: 10 }}>☐ {c.consensi[k]}</p>
        ))}
        {c.dichiarazione_firma && <p style={{ marginTop: 14 }}>{c.dichiarazione_firma}</p>}

        <div className="firma">
          <div className="riga"><span>Paziente</span><span>{paziente}</span></div>
          <div className="riga"><span>Luogo e data</span><span /></div>
          <div className="riga"><span>Firma del paziente</span><span /></div>
        </div>

        <div className="osteopata">
          <strong>Per l&apos;osteopata</strong> — Conservare l&apos;originale firmato fino a indicazione contraria.
          Caricare la copia in cartella entro 7 giorni dalla firma, indicando la versione riportata a piè di pagina.
        </div>
      </div>
      <div className="piede">{riferimento}</div>
    </>
  );
}

export const getServerSideProps = requireProAuthSsr(async (ctx) => {
  const { patientId } = ctx.params;
  const proId = ctx.req.proSession.proId;
  if (ctx.req.proSession.mustReset) return { redirect: { destination: '/pro/reset-password', permanent: false } };

  const codice = CODICE_PER_DOCUMENTO[ctx.query.documento];
  // Carta sospesa per questo documento: non si stampa un modulo che poi non si
  // potrebbe caricare (il perché è nella cartella).
  if (!codice || cartaSospesa(ctx.query.documento)) return { notFound: true };

  const patient = await getPatientById(patientId);
  if (!patient || !(await proCanAccessPatientClinical(proId, patient))) return { notFound: true };

  const { testoInVigore } = await import('../../../../lib/testi-legali-server');
  const t = await testoInVigore(codice);
  if (!t) return { notFound: true };

  return {
    props: {
      testo: { codice: t.codice, versione: t.versione, impronta: t.impronta, contenuto: t.contenuto },
      paziente: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
    },
  };
});
