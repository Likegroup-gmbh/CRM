// sourcingSpaltenSichtbarkeit.js
// Migration gespeicherter hidden_columns, Kunden-Sichtbarkeit, Spaltenzahl und Sticky-Offsets

import {
  DEAKTIVIERTE_SPALTEN,
  PLATTFORM_ZEILEN,
  SOURCING_SPALTEN,
  TIKTOK_SPALTEN
} from './sourcingSpaltenKatalog.js';

/** Spalten, die es in der Tabelle nicht mehr gibt, aber noch in hidden_columns stehen koennen */
const ENTFERNTE_SPALTEN = [
  'cp-col-cpm-ig', 'cp-col-cpm-tt',
  // Die manuellen Reichweite-Spalten sind entfallen: die Views stehen jetzt
  // direkt in den Preis-Zellen.
  'cp-col-reichweite-ig', 'cp-col-reichweite-tt',
  // Der getrimmte Schnitt ("Preis Ø Reels") ist durch die beiden
  // Ausreisser-bereinigten Spalten ersetzt.
  'cp-col-cpm-ig-trimmed',
  // Die "o. A."-Spalten sind weg: Preis 8/30 Reels sind jetzt selbst bereinigt,
  // eine ungefilterte Variante gibt es nicht mehr.
  'cp-col-cpm-ig-8-clean', 'cp-col-cpm-ig-30-clean',
  // Angefragt und Rueckmeldung waren Checkbox-Spalten, ihre Information steckt
  // jetzt in den Status-Optionen "Angefragt" und "In Verhandlung".
  'cp-col-anfragen', 'cp-col-check',
  // Der eigene Gesamtpreis im Instagram-Block ist entfallen; den Gesamtpreis
  // fuehrt jetzt die frueher "Tatsächlicher Preis" genannte Spalte cp-col-pricing.
  'cp-col-gesamtpreis',
  // Das Profilbild steht jetzt in der Namenszelle und ist nicht mehr ausblendbar.
  'cp-col-bild'
];

/** Die fuenf Status-Checkbox-Spalten, die zur Select-Spalte cp-col-status wurden */
const ALTE_STATUS_SPALTEN = ['cp-col-onhold', 'cp-col-buchen', 'cp-col-prio1', 'cp-col-prio2', 'cp-col-absagen'];

/**
 * Bringt gespeicherte hidden_columns auf den aktuellen Spaltenstand:
 * - die frueher kombinierte Links-Spalte wurde in IG und TT aufgeteilt
 * - die fuenf Status-Checkboxen wurden zur Select-Spalte cp-col-status
 *   (nur wenn vorher alle fuenf versteckt waren, bleibt der Status versteckt)
 * - die manuellen CPM-Spalten gibt es nicht mehr
 */
export function migrateHiddenColumns(hiddenColumns) {
  let cols = Array.isArray(hiddenColumns) ? [...hiddenColumns] : [];

  if (cols.includes('cp-col-links')) {
    cols = cols
      .filter(c => c !== 'cp-col-links')
      .concat('cp-col-link-ig', 'cp-col-link-tt');
  }

  const alleStatusVersteckt = ALTE_STATUS_SPALTEN.every(c => cols.includes(c));
  if (alleStatusVersteckt) cols.push('cp-col-status');

  cols = cols.filter(c => !ALTE_STATUS_SPALTEN.includes(c) && !ENTFERNTE_SPALTEN.includes(c));

  return [...new Set(cols)];
}

/** Spalten mit internen Daten, die Kunden und Gaeste nie sehen duerfen */
const NUR_INTERN = ['cp-col-vk', 'cp-col-mail', 'cp-col-telefon'];

export function isColumnVisibleForCustomer(columnClass, isKunde, hiddenColumns) {
  if (DEAKTIVIERTE_SPALTEN.includes(columnClass)) return false;

  if (columnClass === 'cp-col-name' || columnClass === 'cp-col-actions' || columnClass === 'cp-col-drag') {
    return true;
  }

  if (isKunde && NUR_INTERN.includes(columnClass)) return false;

  if (hiddenColumns.includes(columnClass)) return false;

  // Gemeinsame Spalte: sichtbar, solange mindestens eine Plattformzeile da ist
  const zeilen = PLATTFORM_ZEILEN[columnClass];
  if (zeilen && zeilen.every(zeile => hiddenColumns.includes(zeile.key))) return false;

  return true;
}

/**
 * Plattformzeilen einer gemeinsamen Spalte, die in dieser Liste sichtbar sind
 * (Instagram vor TikTok). Die Zeilen-Schluessel stehen in hidden_columns und
 * kommen aus den Presets der Liste.
 */
export function sichtbarePlattformZeilen(columnClass, hiddenColumns) {
  const hidden = hiddenColumns || [];
  return (PLATTFORM_ZEILEN[columnClass] || []).filter(zeile => !hidden.includes(zeile.key));
}

/**
 * Hat die Liste TikTok? Dann bekommt jede gestapelte Zelle immer beide Zeilen,
 * auch die reinen Instagram-Spalten, damit die Hoehen zueinander passen.
 */
export function listeZeigtTiktok(hiddenColumns) {
  const hidden = hiddenColumns || [];
  return TIKTOK_SPALTEN.some(key => !hidden.includes(key));
}

export function getVisibleColumnCount(isKunde, hiddenColumns, { canEdit = true, hasActions = true } = {}) {
  let count = 0;
  for (const col of SOURCING_SPALTEN) {
    if (col === 'cp-col-drag' && (isKunde || !canEdit)) continue;
    if (col === 'cp-col-actions' && (isKunde || !hasActions)) continue;
    if (isColumnVisibleForCustomer(col, isKunde, hiddenColumns)) count++;
  }
  return count;
}

/**
 * Die linken Spalten bleiben beim Querscrollen stehen: Drag (nur intern mit
 * edit-Recht, ein view-only Interner wie der Investor hat sie nicht) und der
 * Name mit Profilbild. Die left-Offsets leitet das CSS aus den Klassen ab,
 * siehe .creator-pool-table .col-sticky-* in tables.css.
 */
export function getStickyClasses(ctx) {
  const hasDrag = !ctx.isKunde && (ctx.canEdit ?? true);
  return { name: `col-sticky-${hasDrag ? 2 : 1}` };
}
