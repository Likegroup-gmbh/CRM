// _shared/ablage/pfad.js
// Die eine Namensregel fuer Ordner und Dateien in der Medienablage (SharePoint).
// CRM fuehrt die Namen: Finder-Umbenennungen von Fachordnern werden zurueckgedreht.
// Kuerzungen halten den Pfad unter 400 Zeichen (Site-Pfad + Bibliothek eingerechnet).

const TEST_ORDNER = '_Test';

// Videos, Bilder und Stories liegen gemeinsam unter Videos/Video_N (ADR 0065)
const TYP_ORDNER = {
  videos: 'Videos',
  rohmaterial: 'Rohmaterial',
};

// Frühere Typ-Ordner: nur noch im Register von Altbestand, bis umsortieren.js sie auflöst
const ALTE_TYP_ORDNER = {
  storys: 'Storys',
  bilder: 'Bilder',
};

const FINALE_ORDNER = 'Finale_Version';

// SharePoint-Formatordner (':' ist verboten) <-> variant_name im CRM
const FORMATE = ['9:16', '4:5', '1:1'];
const FORMAT_WERT = { '9:16': 9 / 16, '4:5': 4 / 5, '1:1': 1 };

const MAX_SEGMENT = 40;
const MAX_THEMA = 30;
const MAX_DATEINAME = 100;
const MAX_PFAD = 400;

const RESERVIERT = /^(con|prn|aux|nul|com\d|lpt\d|\.lock|desktop\.ini|_vti_.*)$/i;

/** Ein Namensteil fuer SharePoint: verbotene Zeichen raus, keine Punkte/Leerzeichen am Rand, gekuerzt. */
function bereinigen(str, max = MAX_SEGMENT) {
  let s = String(str ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[<>:"|?*\\/]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-')
    .trim();
  if (s.length > max) s = s.slice(0, max).trim();
  s = s.replace(/^[.\s~$]+|[.\s]+$/g, '');
  if (RESERVIERT.test(s)) s = `${s}_`;
  return s;
}

/** Dateiname bereinigen, Endung bleibt beim Kuerzen erhalten. */
function dateiname(name, max = MAX_DATEINAME) {
  const roh = String(name ?? '').split(/[\\/]/).pop();
  const dot = roh.lastIndexOf('.');
  const ext = dot > 0 ? bereinigen(roh.slice(dot + 1), 10).toLowerCase() : '';
  const stamm = bereinigen(dot > 0 ? roh.slice(0, dot) : roh, Math.max(1, max - (ext ? ext.length + 1 : 0)));
  const s = stamm || 'datei';
  return ext ? `${s}.${ext}` : s;
}

/** " (2)" vor der Endung bzw. am Ende. n=1 -> unveraendert. */
function mitZaehler(name, n) {
  if (!n || n <= 1) return name;
  const dot = name.lastIndexOf('.');
  const istDatei = dot > 0 && dot >= name.length - 11;
  return istDatei ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`;
}

/** Ordnername ohne " (2)"-Zaehler am Ende. */
const basisName = (name) => String(name || '').replace(/ \(\d+\)$/, '');

/** Anzeigename der Kampagne: eigener Name vor Kampagnenname (wie KampagneUtils.getDisplayName). */
function kampagnenName(k) {
  return String(k?.eigener_name || '').trim() || String(k?.kampagnenname || '').trim() || 'Kampagne';
}

const NAMEN = {
  unternehmen: (u) => bereinigen(u?.firmenname) || 'Unternehmen',
  marke: (m) => bereinigen(m?.markenname) || 'Marke',
  kampagne: (k) => bereinigen(kampagnenName(k)) || 'Kampagne',
  kooperation: (koop) => bereinigen(koop?.name) || 'Kooperation',
  typ: (typ) => TYP_ORDNER[typ],
  video: (v) => {
    const pos = Number(v?.position) || 1;
    const thema = bereinigen(v?.thema, MAX_THEMA);
    return thema ? `Video_${pos}_${thema}` : `Video_${pos}`;
  },
  story: (slotIndex) => `Story_${Number(slotIndex) || 1}`,
  schleife: (n) => `Feedbackschleife_${Number(n) || 1}`,
  finale: () => FINALE_ORDNER,
  format: (variant) => formatOrdner(variant),
  variante: (name) => bereinigen(name, 20) || 'A',
};

function formatOrdner(variant) {
  return FORMATE.includes(variant) ? variant.replace(':', '-') : null;
}

function formatAusOrdner(name) {
  const m = /^(9|4|1)-(16|5|1)$/.exec(String(name || ''));
  const f = m ? `${m[1]}:${m[2]}` : null;
  return FORMATE.includes(f) ? f : null;
}

/** Standardformat aus Pixelmassen (Toleranz 3 %, wie videoBrowserFormat.detectRatio). */
function formatAusMass(breite, hoehe, toleranz = 0.03) {
  const w = Number(breite);
  const h = Number(hoehe);
  if (!w || !h) return null;
  const r = w / h;
  return FORMATE.find((f) => Math.abs(r - FORMAT_WERT[f]) / FORMAT_WERT[f] <= toleranz) || null;
}

// Fachordner erkennen (Finder legt sie evtl. selbst an)
const MUSTER = {
  video: /^Video_(\d+)(?:_.*)?$/i,
  story: /^Story_(\d+)$/i,
  schleife: /^Feedbackschleife_(\d+)$/i,
  finale: /^Finale[_ ]Version$/i,
};

function typAusOrdner(name) {
  const n = String(name || '').trim().toLowerCase();
  return Object.keys(TYP_ORDNER).find((t) => TYP_ORDNER[t].toLowerCase() === n) || null;
}

function nummer(muster, name) {
  const m = MUSTER[muster].exec(String(name || '').trim());
  return m ? Number(m[1]) : null;
}

// Mac-/Office-Muell und Teil-Downloads
const SYSTEM_DATEI = /^(\.ds_store|\._.*|thumbs\.db|desktop\.ini|icon\r?|~\$.*|\.~lock\..*|.*\.(tmp|partial|crdownload|download|part)|\.(spotlight-v100|trashes|fseventsd|temporaryitems))$/i;

function systemdatei(name) {
  return SYSTEM_DATEI.test(String(name || ''));
}

const VIDEO_ENDUNG = /\.(mp4|mov|m4v|avi|mkv|webm)$/i;
const BILD_ENDUNG = /\.(jpe?g|png|webp|heic|heif|gif)$/i;

/** Asset-Typ einer Datei nach Endung: 'video' | 'still' | null (unbekannt). */
function dateiTyp(name) {
  const n = String(name || '').trim();
  if (VIDEO_ENDUNG.test(n)) return 'video';
  if (BILD_ENDUNG.test(n)) return 'still';
  return null;
}

/** Pfadlaenge pruefen (Server-relativer Pfad inkl. Site + Bibliothek). */
function pfadZuLang(sitePfad, relativ) {
  return `${sitePfad || ''}/${relativ || ''}`.length > MAX_PFAD;
}

module.exports = {
  TEST_ORDNER,
  TYP_ORDNER,
  ALTE_TYP_ORDNER,
  FINALE_ORDNER,
  FORMATE,
  MAX_SEGMENT,
  MAX_DATEINAME,
  MAX_PFAD,
  NAMEN,
  MUSTER,
  bereinigen,
  dateiname,
  mitZaehler,
  basisName,
  kampagnenName,
  formatOrdner,
  formatAusOrdner,
  formatAusMass,
  typAusOrdner,
  nummer,
  systemdatei,
  dateiTyp,
  pfadZuLang,
};
