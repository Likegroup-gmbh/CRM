// videoFileNames.js
// Dateinamen für Uploads und Downloads: versionierte/finale Namen, Dropbox-taugliche Namen,
// laufende Indizes gegen Kollisionen (Stills, zweiter Upload desselben Namens).

/** Umlaute und ß ausgeschrieben (ä → ae, Ä → Ae, ß → ss). */
function replaceUmlauts(str) {
  return String(str)
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

function sanitizeForFilename(str) {
  if (!str) return '';
  return replaceUmlauts(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildVersionedFileName(creator, unternehmen, kampagne, videoPosition, version, ext) {
  const parts = [creator, unternehmen, kampagne]
    .map(sanitizeForFilename)
    .filter(Boolean);

  parts.push(String(videoPosition || 1));
  parts.push(`v${version}`);
  return parts.join('_') + '.' + ext;
}

export function buildFinalFileName(creator, unternehmen, kampagne, videoPosition, variantName, ext) {
  const parts = [creator, unternehmen, kampagne, String(videoPosition || 1), 'final', variantName]
    .map(sanitizeForFilename)
    .filter(Boolean);
  return parts.join('_') + '.' + ext;
}

/**
 * Download-Dateiname fuer ein bestehendes Asset: identisch zum Upload-Namen,
 * damit auch Altdateien (alter Dropbox-Name) beim Download die Video-Nr tragen.
 * @param {{creatorName?: string, unternehmen?: string, kampagne?: string}} meta
 * @param {{position?: number}} video
 * @param {{is_final?: boolean, version_number?: number, variant_name?: string, file_path?: string, file_url?: string}} asset
 */
export function buildAssetDownloadName(meta, video, asset) {
  const path = asset?.file_path || asset?.file_url || '';
  const extMatch = /\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/.exec(path);
  const ext = extMatch ? extMatch[1] : 'mp4';
  // Vom Team vergebener Ad-Manager-Name gewinnt: die Datei heißt in Dropbox genauso
  if (asset?.ad_manager_name) return `${asset.ad_manager_name}.${ext}`;
  const position = video?.position || 1;
  if (asset?.is_final) {
    const rebuilt = buildFinalFileName(meta?.creatorName, meta?.unternehmen, meta?.kampagne, position, asset?.variant_name, ext);
    return finalDownloadName(rebuilt, path);
  }
  return buildVersionedFileName(meta?.creatorName, meta?.unternehmen, meta?.kampagne, position, asset?.version_number || 1, ext);
}

/** Basename eines Dropbox-Pfads oder einer URL, ohne Query. */
export function fileBasename(path) {
  if (!path) return '';
  const clean = String(path).split('?')[0].split('#')[0];
  const slash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
  return slash >= 0 ? clean.slice(slash + 1) : clean;
}

/** Dateiname eines Pfads in Name ohne Endung und Endung (mit Punkt, leer wenn keine). */
export function splitFileName(path) {
  const base = fileBasename(path);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? { stem: base.slice(0, dot), ext: base.slice(dot) } : { stem: base, ext: '' };
}

/**
 * Pfad derselben Datei unter neuem Namen: gleicher Ordner, gleiche Endung. Eine mitgetippte
 * Endung wird nicht doppelt angehängt. `null`, wenn vom Namen nichts übrig bleibt.
 */
export function renamedFilePath(path, name, { adManager = false } = {}) {
  if (!path) return null;
  const { ext } = splitFileName(path);
  let stem = String(name || '').trim();
  if (ext && stem.toLowerCase().endsWith(ext.toLowerCase())) stem = stem.slice(0, -ext.length);
  stem = adManager
    ? sanitizeAdManagerName(stem)
    : sanitizeDropboxFileName(stem).replace(/^[\s.-]+|[\s.]+$/g, '');
  if (!stem) return null;
  const slash = path.lastIndexOf('/');
  return `${slash >= 0 ? path.slice(0, slash + 1) : ''}${stem}${ext}`;
}

/**
 * Name, mit dem der Ad Manager arbeiten kann: Umlaute ausgeschrieben, Leerzeichen zu `_`,
 * alles außer A-Z a-z 0-9 _ - entfernt, mehrfache und äußere `_` weg. Leer, wenn nichts übrig bleibt.
 */
export function sanitizeAdManagerName(str) {
  if (!str) return '';
  return replaceUmlauts(str)
    .replace(/\s/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Was beim Speichern aus einer Eingabe wird (für die Live-Vorschau "Wird zu: …").
 * Eine mitgetippte Endung zählt nicht zum Namen.
 * @returns {{ typed: string, stem: string, changed: boolean }} stem ist leer, wenn nichts übrig bleibt
 */
export function previewAdManagerStem(input, ext = '') {
  let typed = String(input || '').trim();
  if (ext && typed.toLowerCase().endsWith(ext.toLowerCase())) typed = typed.slice(0, -ext.length);
  const stem = sanitizeAdManagerName(typed);
  return { typed, stem, changed: stem !== typed };
}

/**
 * Dropbox-Dateiname, gleiche Regeln wie sanitizePath in netlify/functions/_shared/dropbox.js.
 * Muss damit uebereinstimmen, sonst erkennt der Client eine Kollision nicht.
 */
export function sanitizeDropboxFileName(str) {
  if (!str) return '';
  return String(str)
    .replace(/[<>:"|?*\\/]/g, '-')
    .replace(/-{2,}/g, '-')
    .trim();
}

/**
 * Erste Datei behaelt den Basisnamen. Ab der zweiten haengt ein Index an
 * (`name_02.ext`), damit ein zweiter Upload dieselbe Dropbox-Datei nicht
 * ueberschreibt. _01 gibt es nicht: die unindizierte Datei ist die erste.
 */
export function nextFreeIndexedFileName(baseFileName, existingNames) {
  if (!baseFileName) return baseFileName;
  const taken = new Set(
    (existingNames || []).map(n => fileBasename(n).toLowerCase()).filter(Boolean)
  );
  if (!taken.has(baseFileName.toLowerCase())) return baseFileName;
  let n = 2;
  let candidate = withStillIndex(baseFileName, n);
  while (taken.has(candidate.toLowerCase())) {
    n += 1;
    if (n > 999) return candidate;
    candidate = withStillIndex(baseFileName, n);
  }
  return candidate;
}

function finalDownloadName(rebuilt, storedPath) {
  const stored = fileBasename(storedPath);
  if (!stored || !rebuilt) return rebuilt;
  const dot = rebuilt.lastIndexOf('.');
  const stem = dot > 0 ? rebuilt.slice(0, dot) : rebuilt;
  const ext = dot > 0 ? rebuilt.slice(dot) : '';
  const re = new RegExp(`^${escapeRegExp(stem)}(_\\d+)?${escapeRegExp(ext)}$`, 'i');
  if (re.test(stored)) return stored;
  return rebuilt;
}

// ─── Stills: eindeutige Dateinamen ───────────────────────────
// Mehrere Stills derselben Feedbackschleife erzeugen sonst identische
// Dateinamen; Dropbox-Upload laeuft mit mode:'overwrite' -> Dateien
// ueberschreiben sich gegenseitig. Deshalb bekommt jeder Still eine
// laufende Nummer: name_v1.jpg -> name_v1_01.jpg, name_v1_02.jpg, ...

export function withStillIndex(fileName, n) {
  const idx = String(n).padStart(2, '0');
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return `${fileName}_${idx}`;
  return `${fileName.slice(0, dot)}_${idx}${fileName.slice(dot)}`;
}

/**
 * Zaehlt, wie viele vorhandene Assets bereits denselben Basis-Dateinamen
 * belegen (unindiziert `name_v1.jpg` oder indiziert `name_v1_01.jpg`).
 * Liefert den Start-Index fuer neue Uploads (Rueckgabe = belegte Slots).
 */
export function countStillNameUsage(existingImages, baseFileName) {
  if (!baseFileName) return 0;
  const dot = baseFileName.lastIndexOf('.');
  const stem = dot > 0 ? baseFileName.slice(0, dot) : baseFileName;
  const ext = dot > 0 ? baseFileName.slice(dot) : '';
  const re = new RegExp(`^${escapeRegExp(stem)}(_\\d+)?${escapeRegExp(ext)}$`, 'i');
  return (existingImages || []).filter(img => img.file_name && re.test(img.file_name)).length;
}

/**
 * Liefert einen Zaehler, der pro Basis-Dateiname den naechsten freien Index
 * vergibt (1, 2, 3, ...). Startet bei countStillNameUsage + 1, damit
 * Nachschub-Uploads nicht mit Altbestand kollidieren.
 */
export function createStillIndexCounter(existingImages) {
  const usage = new Map();
  return function nextStillIndex(baseFileName) {
    if (!usage.has(baseFileName)) {
      usage.set(baseFileName, countStillNameUsage(existingImages, baseFileName));
    }
    const n = usage.get(baseFileName) + 1;
    usage.set(baseFileName, n);
    return n;
  };
}
