// Popolazione dell'azienda demo — deterministica (stesso seme = stessi dati).
import { BODY_ZONES } from '../../lib/scoring.js';

export function rng(seed = 20250922) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const NOMI_M = ['Marco','Luca','Andrea','Giuseppe','Francesco','Alessandro','Matteo','Davide','Stefano','Paolo','Roberto','Simone','Fabio','Antonio','Giovanni','Massimo','Daniele','Riccardo','Claudio','Federico','Nicola','Lorenzo','Alberto','Emanuele','Gabriele','Mauro','Sergio','Enrico','Pietro','Michele'];
const NOMI_F = ['Giulia','Francesca','Chiara','Sara','Laura','Elena','Valentina','Martina','Alessandra','Silvia','Federica','Paola','Anna','Roberta','Elisa','Monica','Cristina','Barbara','Serena','Claudia','Ilaria','Marta','Beatrice','Simona','Daniela'];
const COGNOMI = ['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo','Conti','De Luca','Mancini','Costa','Giordano','Rizzo','Lombardi','Moretti','Barbieri','Fontana','Santoro','Mariani','Rinaldi','Caruso','Ferrara','Galli','Martini','Leone','Longo','Gentile','Martinelli','Vitale','Lombardo','Serra','Coppola','De Santis','D\'Angelo','Marchetti','Parisi','Villa','Conte','Ferraro','Ferri','Fabbri','Bianco','Marini','Grasso','Valentini','Messina','Sala','De Angelis','Gatti','Pellegrini','Palumbo','Sanna','Farina','Rizzi','Monti','Cattaneo','Morelli','Amato','Silvestri','Mazza','Testa','Grassi','Pellegrino','Carbone','Giuliani'];

// Pesi di dolore per zona in una manifattura (lombare e collo in testa).
const PESO_ZONA = [0.55, 0.45, 0.25, 0.75, 0.15, 0.35, 0.15, 0.25, 0.12];

// Genera N dipendenti con area (reparto/ufficio), età, sesso.
export function dipendenti(n, r) {
  const out = [];
  const usati = new Set();
  for (let i = 0; i < n; i++) {
    const f = r() < 0.32;
    let nome, k = 0;
    do { nome = `${(f ? NOMI_F : NOMI_M)[Math.floor(r() * (f ? NOMI_F : NOMI_M).length)]} ${COGNOMI[Math.floor(r() * COGNOMI.length)]}`; k++; } while (usati.has(nome) && k < 50);
    usati.add(nome);
    const [first, ...last] = nome.split(' ');
    out.push({ i, nome, first, last: last.join(' '), sesso: f ? 'F' : 'M', eta: 22 + Math.floor(r() * 40), area: r() < 0.66 ? 'reparto' : 'ufficio', matricola: `M${String(1000 + i).padStart(5, '0')}` });
  }
  return out;
}

// Risposte al questionario con un livello bersaglio (formato reale: nmq_{zona}_{0 12 mesi|1 impatto|2 7 giorni}).
export function risposte(livello, r, area = 'reparto', miglioramento = 0) {
  const a = {};
  const pesi = PESO_ZONA.map((p, zi) => (area === 'ufficio' && (zi === 0 || zi === 5) ? p * 1.2 : area === 'ufficio' ? p * 0.7 : p));
  BODY_ZONES.forEach((_, zi) => { a[`nmq_${zi}_0`] = 0; a[`nmq_${zi}_1`] = 0; a[`nmq_${zi}_2`] = 0; });
  // storia a 12 mesi: comune anche nei L3
  BODY_ZONES.forEach((_, zi) => { if (r() < pesi[zi] * (livello === 'level3' ? 0.35 : 0.6)) a[`nmq_${zi}_0`] = 1; });
  if (livello === 'level3') return a;
  // almeno una zona con dolore negli ultimi 7 giorni
  const zone = pesi.map((p, zi) => ({ zi, s: p * r() })).sort((x, y) => y.s - x.s);
  const nAttive = 1 + (r() < 0.45 ? 1 : 0) + (r() < 0.15 ? 1 : 0);
  zone.slice(0, nAttive).forEach(({ zi }, j) => {
    a[`nmq_${zi}_0`] = 1; a[`nmq_${zi}_2`] = 1;
    if (livello === 'level1' && j === 0) a[`nmq_${zi}_1`] = 1;
  });
  return a;
}
