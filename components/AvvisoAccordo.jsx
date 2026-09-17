import Link from 'next/link';
import { dataOraIt } from '../lib/date-it.mjs';

// Avviso dell'accordo sul trattamento dei dati, a ogni accesso all'area del
// professionista e nei documenti. Tace solo quando l'accordo è in regola.
export default function AvvisoAccordo({ stato, compatto = false }) {
  if (!stato || stato.stato === 'valido') {
    if (compatto && stato?.stato === 'valido') {
      return <Link href="/pro/accordo" className="block bg-white rounded-2xl border border-gray-200 p-4 text-sm"><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2" /><strong>Accordo sul trattamento dei dati</strong> <span className="text-green-700">· in regola, versione {stato.versione}</span></Link>;
    }
    return null;
  }
  const preavviso = stato.stato === 'in_preavviso';
  const testo = preavviso
    ? <>È in vigore una nuova versione dell&apos;accordo sul trattamento dei dati ({stato.versione}). Resti in regola fino al {dataOraIt(stato.scadenza, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}: poi, senza la nuova sottoscrizione e la copia firmata, non potrai prendere in carico nuovi pazienti né ricevere nuove aziende.</>
    : stato.stato === 'testo_non_pubblicato'
      ? <>L&apos;accordo sul trattamento dei dati non è ancora disponibile per la sottoscrizione. Senza accordo non si ricevono aziende né si prendono in carico nuovi pazienti.</>
      : <>Accordo sul trattamento dei dati non in regola (versione {stato.versione}: {stato.mancaSpunta && stato.mancaFile ? 'manca la sottoscrizione e la copia firmata' : stato.mancaSpunta ? 'manca la sottoscrizione' : 'manca la copia firmata'}). Senza accordo non puoi ricevere aziende né prendere in carico nuovi pazienti.</>;
  const cls = preavviso ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-red-50 border-red-200 text-red-800';
  return (
    <div role="alert" className={`rounded-2xl border px-4 py-3 text-sm ${compatto ? '' : 'mb-4'} ${cls}`}>
      {testo}{' '}
      {stato.stato !== 'testo_non_pubblicato' && <Link href="/pro/accordo" className="underline font-semibold">Vai all&apos;accordo</Link>}
    </div>
  );
}
