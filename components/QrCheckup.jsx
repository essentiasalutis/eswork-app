import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// QR del check-up generato qui, nel browser (21/9). Prima lo produceva un servizio
// esterno (api.qrserver.com), a cui arrivava l'indirizzo del check-up di ogni cliente:
// un fornitore che non compariva in nessun documento. Ora non esce niente.
export default function QrCheckup({ url, nomeFile = 'qr-checkup', grande = false, conAnteprima = false }) {
  const [png, setPng] = useState(null);
  const [errore, setErrore] = useState(false);
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M' })
      .then(setPng).catch(() => setErrore(true));
  }, [url]);
  if (errore) return <span className="text-xs text-red-600">QR non generato.</span>;
  if (!png) return <span className="text-xs text-gray-400">QR…</span>;
  const file = `${nomeFile.replace(/[^\w-]+/g, '-').toLowerCase()}.png`;
  return (
    <span className={conAnteprima ? 'inline-flex flex-col items-center gap-2' : 'inline-flex items-center'}>
      {conAnteprima && <img src={png} alt="QR code del check-up" className={grande ? 'w-72 h-72' : 'w-40 h-40'} />}
      <a href={png} download={file}
        className="text-xs font-semibold text-green-700 bg-white border border-green-300 px-3 py-2 rounded-xl hover:bg-green-50">
        📱 Scarica QR Code
      </a>
    </span>
  );
}
