import Head from 'next/head';
import Link from 'next/link';
import { requireMcAuthSsr } from '../../lib/mc-auth';
import { dataIt } from '../../lib/date-it.mjs';

async function esci() {
  await fetch('/api/mc/auth/logout', { method: 'POST' });
  window.location.href = '/mc/login';
}

export default function McHome({ nome, aziende }) {
  return (
    <>
      <Head><title>Le tue aziende — ES Work</title></Head>
      <main className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
            <div><span className="font-bold text-slate-900">ES Work</span> <span className="text-sm text-slate-500">· medico competente</span></div>
            <div className="text-sm text-slate-600">{nome} · <button onClick={esci} className="underline">Esci</button></div>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-5 py-6">
          <h1 className="text-lg font-bold text-slate-900">Le aziende assegnate</h1>
          <p className="text-sm text-slate-500 mt-1 mb-4">Solo dati aggregati: nessun dato individuale dei lavoratori, nessun elenco di chi ha aderito al programma.</p>
          {aziende.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 text-sm text-slate-600">Nessuna azienda assegnata al momento.</div>
          ) : (
            <ul className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
              {aziende.map(a => (
                <li key={a.clientId}>
                  <Link href={`/mc/${a.clientId}`} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50">
                    <span className="font-semibold text-slate-900">{a.nome}</span>
                    <span className="text-xs text-slate-500">assegnata dal {dataIt(a.dal)} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

export const getServerSideProps = requireMcAuthSsr(async (ctx) => {
  const { aziendeDelMedico, registra } = await import('../../lib/medico-competente-server');
  const aziende = await aziendeDelMedico(ctx.req.medico.id);
  await registra({ medicoId: ctx.req.medico.id, azione: 'elenco_aziende', ip: ctx.req.headers['x-forwarded-for'] || null, userAgent: ctx.req.headers['user-agent'] });
  return { props: { nome: ctx.req.medico.nome, aziende: JSON.parse(JSON.stringify(aziende)) } };
});
