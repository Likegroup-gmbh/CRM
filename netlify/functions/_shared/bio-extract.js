// bio-extract.js
// Kontaktdaten aus einer Instagram-Bio ziehen.
//
// Hintergrund: Die Meta Business Discovery API liefert zu fremden Profilen
// ausschliesslich biography, name, username, website, profile_picture_url und
// die Zaehler. E-Mail, Telefon und Standort gibt es dort nicht - viele Creator
// schreiben ihre Booking-Daten aber in die Bio. Das hier ist Best-Effort auf
// genau diesen Freitext.
//
// Reine Textverarbeitung ohne Netzwerk/DB, damit direkt unit-testbar.
//
// Grundregel fuer alle drei Extraktoren: im Zweifel null zurueckgeben. Ein
// falscher Treffer kostet mehr Zeit als ein leeres Feld, weil er im CRM
// unbemerkt weiterverwendet wird.

/** Zeichen, die Creator gern als Trenner zwischen Bio-Zeilen setzen */
const TRENNER = /[\n\r|•·,;/]+/;

// --- E-Mail ---

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

/**
 * Haeufige Verschleierungen aufloesen, mit denen Creator Scraper aussperren:
 *   "hallo (at) domain (dot) de", "hallo [at] domain.de", "hallo AT domain.de"
 * Bewusst nur bei umklammerten Varianten und " at " mit Leerzeichen - ein
 * nacktes "at" mitten im Wort wuerde sonst echte Adressen zerlegen.
 */
function deobfuscate(text) {
  return text
    .replace(/\s*[([{<]\s*(at|ät)\s*[)\]}>]\s*/gi, '@')
    .replace(/\s+(at|ät)\s+/gi, '@')
    .replace(/\s*[([{<]\s*(dot|punkt)\s*[)\]}>]\s*/gi, '.')
    .replace(/\s+(dot|punkt)\s+/gi, '.');
}

/**
 * Erste E-Mail-Adresse aus der Bio.
 * @param {string} text
 * @returns {string|null} kleingeschriebene Adresse
 */
function extractEmail(text) {
  if (!text) return null;

  const direkt = String(text).match(EMAIL_RE);
  if (direkt) return direkt[0].toLowerCase();

  const entschleiert = deobfuscate(String(text)).match(EMAIL_RE);
  return entschleiert ? entschleiert[0].toLowerCase() : null;
}

// --- Telefon ---

// Internationale Schreibweise (+49 ...) oder nationale mit fuehrender 0.
// Dazwischen sind Leerzeichen, Punkte, Bindestriche und Klammern erlaubt.
const PHONE_RE = /(?:\+|00)\d[\d\s().-]{7,}\d|\b0\d[\d\s().-]{6,}\d/g;

const MIN_ZIFFERN = 9;
const MAX_ZIFFERN = 15;   // E.164-Obergrenze

/**
 * Telefonnummer aus der Bio.
 *
 * Vor der Suche fliegen E-Mails und URLs raus, sonst liest der Regex
 * Ziffernfolgen aus Handles und Links als Nummer. Ausserdem gilt ein
 * Ziffernkorridor: darunter sind es Uhrzeiten, Rabattcodes oder Jahreszahlen,
 * darueber ist es keine gueltige Rufnummer mehr.
 *
 * @param {string} text
 * @returns {string|null} normalisierte Nummer, z.B. "+49 170 1234567"
 */
function extractPhone(text) {
  if (!text) return null;

  const bereinigt = String(text)
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\b[\w.-]+\.(?:de|com|net|org|at|ch|io|shop|link)\b/gi, ' ');

  const treffer = bereinigt.match(PHONE_RE) || [];

  for (const roh of treffer) {
    const ziffern = roh.replace(/\D/g, '');
    if (ziffern.length < MIN_ZIFFERN || ziffern.length > MAX_ZIFFERN) continue;

    // Mehrfache Leerzeichen und Trennzeichen auf eine Form bringen
    const normalisiert = roh
      .trim()
      .replace(/^00/, '+')
      .replace(/[().-]/g, ' ')
      .replace(/\s+/g, ' ');

    return normalisiert;
  }

  return null;
}

// --- Location ---

/** Marker, mit denen Creator ihren Standort auszeichnen */
const ORT_MARKER = /[\u{1F4CD}\u{1F3E0}\u{1F30D}\u{1F30E}\u{1F30F}]|\bbased in\b|\bbasiert in\b|\bwohnt in\b|\bliving in\b|\bfrom\b/giu;

/**
 * Englische und alternative Schreibweisen auf den deutschen Namen mappen.
 * Key kleingeschrieben, Value ist der Wert, der in die Spalte wandert.
 */
const ALIASE = {
  munich: 'München',
  muenchen: 'München',
  cologne: 'Köln',
  koeln: 'Köln',
  vienna: 'Wien',
  zurich: 'Zürich',
  zuerich: 'Zürich',
  nuremberg: 'Nürnberg',
  nuernberg: 'Nürnberg',
  frankfort: 'Frankfurt',
  dusseldorf: 'Düsseldorf',
  duesseldorf: 'Düsseldorf',
  hanover: 'Hannover',
  brunswick: 'Braunschweig',
  geneva: 'Genf',
  basle: 'Basel',
  salzbourg: 'Salzburg'
};

/** DACH-Staedte, bei denen ein Treffer im Freitext eindeutig ist */
const STAEDTE = [
  // DE
  'Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf',
  'Leipzig', 'Dortmund', 'Bremen', 'Dresden', 'Hannover', 'Nürnberg', 'Duisburg',
  'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster', 'Mannheim', 'Karlsruhe',
  'Augsburg', 'Wiesbaden', 'Mönchengladbach', 'Gelsenkirchen', 'Braunschweig',
  'Kiel', 'Chemnitz', 'Aachen', 'Magdeburg', 'Freiburg', 'Krefeld', 'Lübeck',
  'Mainz', 'Erfurt', 'Rostock', 'Oberhausen', 'Kassel', 'Potsdam', 'Saarbrücken',
  'Hagen', 'Ludwigshafen', 'Osnabrück', 'Leverkusen', 'Oldenburg', 'Solingen',
  'Heidelberg', 'Darmstadt', 'Regensburg', 'Würzburg', 'Ingolstadt', 'Wolfsburg',
  'Ulm', 'Heilbronn', 'Pforzheim', 'Göttingen', 'Bottrop', 'Trier', 'Recklinghausen',
  'Reutlingen', 'Bremerhaven', 'Koblenz', 'Jena', 'Erlangen', 'Siegen', 'Hildesheim',
  'Salzgitter', 'Cottbus', 'Kaiserslautern', 'Gütersloh', 'Schwerin', 'Konstanz',
  'Flensburg', 'Bamberg', 'Bayreuth', 'Landshut', 'Tübingen', 'Marburg', 'Gießen',
  'Paderborn', 'Wolfenbüttel', 'Lüneburg', 'Passau', 'Rosenheim', 'Sylt',
  // AT
  'Wien', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt', 'Villach',
  'Wels', 'Sankt Pölten', 'Dornbirn', 'Wiener Neustadt', 'Bregenz', 'Kitzbühel',
  // CH
  'Zürich', 'Genf', 'Basel', 'Lausanne', 'Bern', 'Winterthur', 'Luzern',
  'Sankt Gallen', 'Lugano', 'Biel', 'Thun', 'Köniz', 'Schaffhausen', 'Fribourg',
  'Chur', 'Neuchâtel', 'Uster', 'Sion', 'Davos', 'Zermatt', 'Interlaken'
];

/**
 * Staedtenamen, die auch als normales Wort vorkommen ("Essen" als Mahlzeit,
 * "Zug" als Bahn, "Halle" als Raum). Die zaehlen nur, wenn ein Standort-Marker
 * davor steht.
 */
const STAEDTE_NUR_MIT_MARKER = ['Essen', 'Hof', 'Halle', 'Zug', 'Bar', 'Brand', 'Baden'];

/** Unicode-sichere Wortgrenzen - \b greift bei Umlauten nicht zuverlaessig */
function stadtRegex(stadt) {
  const escaped = stadt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'iu');
}

/** Erster Treffer aus einer Staedteliste, laengste Namen zuerst */
function findeStadt(text, liste) {
  const sortiert = [...liste].sort((a, b) => b.length - a.length);
  let bester = null;

  for (const stadt of sortiert) {
    const treffer = stadtRegex(stadt).exec(text);
    if (!treffer) continue;
    // Bei mehreren Staedten gewinnt die, die in der Bio zuerst steht
    if (!bester || treffer.index < bester.index) {
      bester = { index: treffer.index, stadt };
    }
  }

  return bester ? bester.stadt : null;
}

/**
 * Standort aus der Bio.
 *
 * Zweistufig: steht ein Marker wie 📍 oder "based in" in der Bio, wird der
 * Abschnitt dahinter bevorzugt geprueft - dort ist ein Ortsname mit hoher
 * Wahrscheinlichkeit wirklich der Wohnort und nicht nur erwaehnt. Ohne Marker
 * wird die gesamte Bio geprueft, dann aber ohne die mehrdeutigen Namen.
 *
 * @param {string} text
 * @returns {string|null} Stadtname in deutscher Schreibweise
 */
function extractCity(text) {
  if (!text) return null;
  const bio = String(text);

  const alleStaedte = [...STAEDTE, ...STAEDTE_NUR_MIT_MARKER, ...Object.keys(ALIASE)];

  // Stufe 1: Abschnitte hinter einem Standort-Marker
  ORT_MARKER.lastIndex = 0;
  let marker;
  while ((marker = ORT_MARKER.exec(bio)) !== null) {
    const rest = bio.slice(marker.index + marker[0].length);
    const abschnitt = rest.split(TRENNER)[0] || '';
    const treffer = findeStadt(abschnitt, alleStaedte);
    if (treffer) return normalisiereStadt(treffer);
    if (marker[0].length === 0) break;  // Endlosschleife bei Leer-Match verhindern
  }

  // Stufe 2: gesamte Bio, aber nur eindeutige Namen
  const treffer = findeStadt(bio, [...STAEDTE, ...Object.keys(ALIASE)]);
  return treffer ? normalisiereStadt(treffer) : null;
}

function normalisiereStadt(stadt) {
  return ALIASE[stadt.toLowerCase()] || stadt;
}

module.exports = {
  extractEmail,
  extractPhone,
  extractCity,
  // fuer Tests
  deobfuscate
};
