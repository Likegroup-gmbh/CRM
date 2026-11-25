// _shared/post-insights.js
// Insights-Screenshots lesen (ADR 0078, Screenshot-Weg): Tool-Schema, Prompt und die reinen
// Schritte danach. Die KI gibt Werte so ab, wie sie im Bild stehen („1,2 Tsd.“, „12.3K“, „0:14“);
// geparst wird hier, damit Rundung und Einheiten nicht am Modell hängen. Durch kommen nur die
// Felder der Plattform (post-kennzahlen). Bei mehreren Screenshots gewinnt pro Feld der Wert mit
// der höheren Konfidenz.

const { PLATTFORMEN, felderDerPlattform } = require('./post-kennzahlen');

const TOOL_NAME = 'insights_abgeben';
const STANDARD_KONFIDENZ = 0.5;

const INSIGHTS_TOOL = {
  name: TOOL_NAME,
  description: 'Gibt die aus den Insights-Screenshots gelesenen Kennzahlen ab, ein Eintrag je Screenshot.',
  input_schema: {
    type: 'object',
    properties: {
      screenshots: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            bild: { type: 'integer', description: 'Nummer des Bildes, 1-basiert, in Reihenfolge der Anhänge' },
            plattform: { type: 'string', enum: [...PLATTFORMEN, 'unbekannt'] },
            accountHandle: { type: 'string', description: 'Handle ohne @, nur wenn im Bild zu sehen' },
            postedAt: { type: 'string', description: 'Postdatum JJJJ-MM-TT, nur wenn mit Jahr eindeutig' },
            measuredAt: { type: 'string', description: 'Datum der Aufnahme JJJJ-MM-TT, nur wenn im Bild eindeutig' },
            fields: {
              type: 'object',
              description: 'Feldschlüssel -> { value, confidence }. value genau wie im Bild, confidence 0 bis 1.',
              additionalProperties: {
                type: 'object',
                properties: { value: {}, confidence: { type: 'number' } },
                required: ['value', 'confidence']
              }
            },
            notes: { type: 'string', description: 'Kurz, was unklar war' }
          },
          required: ['bild', 'fields']
        }
      }
    },
    required: ['screenshots']
  }
};

const SYSTEM = [
  'Du liest Screenshots von Instagram- und TikTok-Insights eines Creators für die Auswertung einer',
  `Kampagne. Antworte ausschließlich über das Tool "${TOOL_NAME}". Lies nur, was im Bild steht.`,
  'Nichts schätzen, nichts rechnen, nichts ergänzen. Fehlt eine Kennzahl, lass das Feld weg.',
  '',
  '# FELDER (Schlüssel: deutsch / englisch)',
  '- views: Aufrufe, Wiedergaben, Videoaufrufe / Views, Plays, Video views',
  '- reach: Betrachter, Erreichte Konten / Viewers, Accounts reached, Reach',
  '- likes: „Gefällt mir“-Angaben, Likes / Likes (auch bei Stories)',
  '- comments: Kommentare / Comments',
  '- shares: Geteilt, Teilen, Geteilte Inhalte / Shares',
  '- saves: Gespeichert, Favoriten / Saves, Saved, Favorites',
  '- replies: Antworten / Replies (nur Story)',
  '- linkClicks: Link-Klicks / Link clicks, Link taps (Taps auf den Link-Sticker)',
  '- stickerTaps: Auf Sticker getippt / Sticker taps (nur Story; die Summe, nicht die Zeilen je Sticker darunter wie „@marke 136“)',
  '- exits: Verlassen, Story verlassen / Exited, Exits (Navigation der Story; nicht Weiter/Zurück/Nächste Story)',
  '- avgWatchSec: Durchschnittliche Wiedergabezeit / Average watch time (nicht die gesamte Wiedergabezeit)',
  '- completionPct: Komplett angesehen / Watched full video (Prozent)',
  'Interaktionen, Profilaktivitäten, Profilaufrufe, Follows, Follower/Nicht-Follower-Anteile und die gesamte',
  'Wiedergabezeit sind keine Felder.',
  '',
  '# AUFRUFE UND BETRACHTER SIND VERSCHIEDEN',
  '- Aufrufe (views) zählen jede Wiedergabe, Betrachter (reach) jedes Konto einmal. Betrachter ist fast immer kleiner.',
  '- Beide stehen oft im selben Screenshot mit verschiedenen Zahlen. Jede Zahl gehört nur zu ihrer Zeile:',
  '  „Betrachter“ nie als views, „Aufrufe“ nie als reach. Fehlt eine der beiden, Feld weglassen, nicht die andere einsetzen.',
  '- Die Zahl neben dem Personen-Symbol oben in der Story-Ansicht (z. B. „76,1 Tsd.“) ist die Zahl der Betrachter,',
  '  gerundet. Nie als views. Steht „Betrachter“ in der Liste mit genauer Zahl, nimm die.',
  '',
  '# STORY-ANSICHT',
  '- Oben steht eine Leiste mit Vorschaubildern mehrerer Stories, jede mit einer Zahl. Gelesen wird nur die gewählte',
  '  (größer, mit Pfeil darunter). Die Zahlen unter den anderen Vorschaubildern gehören zu anderen Stories: ignorieren.',
  '- „Link-Klicks“ und „Auf Sticker getippt“ sind getrennte Felder. Nie zusammenzählen.',
  '- „--“ oder „–“ heißt: kein Wert. Feld weglassen.',
  '',
  '# PLATTFORM',
  '- ig_story: Story-Insights (Navigation, Antworten, Sticker, Link-Klicks).',
  '- ig_reel: Reel-Insights (Wiedergabezeit, Aufrufe eines Videos).',
  '- ig_post: Bild- oder Karussell-Post.',
  '- tiktok: TikTok-Analysen.',
  '',
  '# WERTE',
  '- value exakt wie angezeigt, mit Einheit und Trennzeichen: "1,2 Tsd.", "12.3K", "1.234", "0:14", "38 %".',
  '- confidence: 1 wenn die Zahl scharf und eindeutig der Kennzahl zugeordnet ist, darunter bei',
  '  unscharfer, abgeschnittener oder mehrdeutiger Stelle.',
  '- Steht dieselbe Kennzahl mehrfach (Übersicht und Detail), nimm die genauere Zahl.',
  '- Mehrere Screenshots zeigen meist denselben Post, nach unten gescrollt. Je Screenshot nur, was in diesem Bild steht.'
].join('\n');

function aufgabe({ plattform, anzahl }) {
  return [
    `# AUFTRAG\n${anzahl === 1 ? 'Ein Screenshot ist' : `${anzahl} Screenshots desselben Posts sind`} angehängt, in dieser Reihenfolge nummeriert.`,
    `Der Post ist laut CRM: ${plattform || 'unbekannt'}. Stimmt das Bild nicht dazu, nenne die Plattform, die du siehst.`,
    `Erwartete Felder: ${PLATTFORMEN.map(p => `${p}: ${felderDerPlattform(p).join(', ')}`).join(' | ')}.`
  ].join('\n');
}

const SUFFIX = [
  { muster: /(mrd\.?|b)$/, faktor: 1e9 },
  { muster: /(mio\.?|millionen|million|m)$/, faktor: 1e6 },
  { muster: /(tsd\.?|tausend|k)$/, faktor: 1e3 }
];

/** "1.234" und "1,234" sind Tausender, "1,5" und "12.3" Dezimalzahlen. */
function zahlOhneSuffix(s, mitFaktor) {
  const komma = s.includes(',');
  const punkt = s.includes('.');
  if (komma && punkt) {
    return s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  }
  const trenner = komma ? ',' : punkt ? '.' : null;
  if (!trenner) return s;
  const tausender = new RegExp(`^\\d{1,3}(\\${trenner}\\d{3})+$`);
  if (!mitFaktor && tausender.test(s)) return s.split(trenner).join('');
  return s.replace(trenner, '.');
}

const kompakt = (value) => value.toLowerCase().replace(/[\s\u00a0\u202f]/g, '').replace(/[+%]/g, '');

/** „76,1 Tsd.“ und „12.3K“ sind gerundet, „75,404“ ist genau. */
const gerundet = (value) => typeof value === 'string' && SUFFIX.some(({ muster }) => muster.test(kompakt(value)));

/** Anzeigewert zu Zahl: „1,2 Tsd.“, „12.3K“, „1.234“, „1,5 Mio.“. Null, wenn nichts Belastbares. */
function parseZahl(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string') return null;
  let s = kompakt(value);
  if (!s) return null;
  let faktor = 1;
  const suffix = SUFFIX.find(({ muster }) => muster.test(s));
  if (suffix) {
    faktor = suffix.faktor;
    s = s.replace(suffix.muster, '');
  }
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const n = Number(zahlOhneSuffix(s, faktor > 1)) * faktor;
  return Number.isFinite(n) ? n : null;
}

/** „0:14“, „1:05“, „14 Sek.“, „1 Min. 5 Sek.“, „12,5 s“ zu Sekunden. */
function parseSekunden(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string') return null;
  const s = value.toLowerCase().trim();
  const uhr = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (uhr) {
    const [a, b, c] = uhr.slice(1).map(x => (x == null ? null : Number(x)));
    return c == null ? a * 60 + b : a * 3600 + b * 60 + c;
  }
  const min = s.match(/(\d+(?:[.,]\d+)?)\s*(?:minuten|minutes|min|m)(?![a-z])/);
  const sek = s.match(/(\d+(?:[.,]\d+)?)\s*(?:sekunden|seconds|sek|sec|s)(?![a-z])/);
  if (min || sek) {
    const zahl = (m) => (m ? Number(m[1].replace(',', '.')) : 0);
    return zahl(min) * 60 + zahl(sek);
  }
  return parseZahl(s);
}

function parseWert(key, value) {
  if (key === 'avgWatchSec') {
    const sek = parseSekunden(value);
    return sek == null ? null : Math.round(sek * 10) / 10;
  }
  const n = parseZahl(value);
  if (n == null) return null;
  if (key === 'completionPct') return n <= 100 ? Math.round(n * 10) / 10 : null;
  return Math.round(n);
}

function parseDatum(value) {
  const s = String(value || '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return de ? `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}` : null;
}

function handleAus(value) {
  const s = String(value || '').trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : null;
}

const konfidenz = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : STANDARD_KONFIDENZ;
};

/** Felder eines Screenshots für die Plattform: { key: { value, confidence } }. */
function felderAus(fields, plattform) {
  const out = {};
  felderDerPlattform(plattform).forEach((key) => {
    const roh = fields?.[key];
    if (roh == null || roh.value == null || roh.value === '') return;
    const value = parseWert(key, roh.value);
    if (value == null) return;
    out[key] = { value, confidence: konfidenz(roh.confidence) };
  });
  return out;
}

/** Plattform, auf die die meisten Felder entfallen; sonst die des Posts. */
function plattformAus(screenshots, bisher) {
  const zaehler = new Map();
  screenshots.forEach((s) => {
    if (!PLATTFORMEN.includes(s?.plattform)) return;
    zaehler.set(s.plattform, (zaehler.get(s.plattform) || 0) + Object.keys(s.fields || {}).length + 1);
  });
  const [beste] = [...zaehler.entries()].sort((a, b) => b[1] - a[1]);
  return beste ? beste[0] : bisher;
}

/**
 * KI-Antwort zu einem Ergebnis: Plattform, Eckdaten und je Feld ein Wert. Über mehrere Screenshots
 * schlägt die genaue Zahl die gerundete („75,404“ vor „76,1 Tsd.“ aus der Kopfzeile), sonst gewinnt
 * die höhere Konfidenz.
 * @returns {{ plattform: string|null, accountHandle: string|null, postedAt: string|null,
 *   measuredAt: string|null, felder: Object<string, { value: number, confidence: number }> }}
 */
function leseAntwort(json, { plattform: bisher = null } = {}) {
  const screenshots = Array.isArray(json?.screenshots) ? json.screenshots : [];
  const plattform = plattformAus(screenshots, bisher);
  const felder = {};
  const rund = {};
  screenshots.forEach((s) => {
    Object.entries(felderAus(s.fields, plattform)).forEach(([key, eintrag]) => {
      const istRund = gerundet(s.fields[key].value);
      const alt = felder[key];
      const besser = !alt || (istRund !== rund[key] ? !istRund : eintrag.confidence > alt.confidence);
      if (!besser) return;
      felder[key] = eintrag;
      rund[key] = istRund;
    });
  });
  const erstes = (fn) => screenshots.map(fn).find(Boolean) || null;
  return {
    plattform,
    accountHandle: erstes(s => handleAus(s.accountHandle)),
    postedAt: erstes(s => parseDatum(s.postedAt)),
    measuredAt: erstes(s => parseDatum(s.measuredAt)),
    felder
  };
}

module.exports = {
  INSIGHTS_TOOL,
  SYSTEM,
  aufgabe,
  parseZahl,
  parseSekunden,
  parseWert,
  felderAus,
  leseAntwort
};
