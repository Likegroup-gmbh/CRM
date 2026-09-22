// CreatorAuswahlTemplates.js
// Spaltenkatalog, Sichtbarkeit, Sticky-Offsets und Status-Reiter der Casting-Tabelle

import { icon } from '../../core/icons/IconSystem.js';
import { getSourcingStatus } from './sourcingStatusOptions.js';

// --- Shared Helpers ---

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export { NICHT_UMSETZEN_KATEGORIE } from './castingPersonaGroups.js';

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
  'cp-col-gesamtpreis'
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

/**
 * Spalten, die projektweit abgeschaltet sind: sie werden weder gerendert noch
 * im Sichtbarkeits-Drawer angeboten. Zell-Markup und DB-Felder bleiben
 * erhalten - einen Eintrag hier entfernen und die Spalte ist wieder da.
 */
export const DEAKTIVIERTE_SPALTEN = ['cp-col-ek', 'cp-col-vk'];

/** Spalten mit internen Daten, die Kunden und Gaeste nie sehen duerfen */
const NUR_INTERN = ['cp-col-vk', 'cp-col-mail', 'cp-col-telefon'];

/** TikTok-Spalten, in reinen Instagram- und UGC-Listen ausgeblendet */
export const TIKTOK_SPALTEN = [
  'cp-col-link-tt', 'cp-col-follower-tt', 'cp-col-preis-tt-video', 'cp-col-preis-tt-story'
];

export function isColumnVisibleForCustomer(columnClass, isKunde, hiddenColumns) {
  if (DEAKTIVIERTE_SPALTEN.includes(columnClass)) return false;

  if (columnClass === 'cp-col-name' || columnClass === 'cp-col-actions' || columnClass === 'cp-col-drag') {
    return true;
  }

  if (isKunde && NUR_INTERN.includes(columnClass)) return false;

  return !hiddenColumns.includes(columnClass);
}

/**
 * Alle Standardspalten in Renderreihenfolge. Nach Plattform gebuendelt: erst
 * der komplette Instagram-Block (Reels, dann Story), danach TikTok - vorher
 * wechselten sich IG und TT spaltenweise ab.
 *
 * Der Status steht direkt hinter der Creator Art: er entscheidet, wie es mit
 * einem Creator weitergeht, und war hinten in der Tabelle nur mit Querscrollen
 * erreichbar.
 *
 * Die Kurzbeschreibung steht direkt hinter dem Namen: sie sagt, wer der
 * Creator ueberhaupt ist, und gehoert damit neben den Namen statt ans Ende
 * hinter alle Preisspalten. Matching folgt direkt danach (Briefing-Fit).
 */
export const SOURCING_SPALTEN = [
  'cp-col-drag', 'cp-col-bild', 'cp-col-name', 'cp-col-notiz', 'cp-col-matching',
  'cp-col-typ', 'cp-col-status', 'cp-col-kunden-feedback',
  'cp-col-location', 'cp-col-mail', 'cp-col-telefon',
  'cp-col-link-ig', 'cp-col-follower-ig',
  'cp-col-cpm-ig-8', 'cp-col-cpm-ig-30', 'cp-col-preis-reels',
  'cp-col-reichweite-story', 'cp-col-preis-story',
  'cp-col-link-tt', 'cp-col-follower-tt',
  'cp-col-preis-tt-video', 'cp-col-preis-tt-story',
  'cp-col-pricing', 'cp-col-nutzungsrechte', 'cp-col-reichweite-garantie',
  'cp-col-ek', 'cp-col-vk',
  'cp-col-feedback',
  'cp-col-actions'
];

/**
 * Standardspalten, hinter denen eine eigene Spalte verankert werden darf.
 * Die drei linken Sticky-Spalten fehlen bewusst: dort wuerden die festen
 * left-Offsets aus dem CSS brechen. Die Aktionen bleiben immer ganz rechts.
 */
export const SOURCING_ANKER_SPALTEN = SOURCING_SPALTEN.filter(
  col => !['cp-col-drag', 'cp-col-bild', 'cp-col-name', 'cp-col-actions'].includes(col)
);

/**
 * Anzeigenamen der Standardspalten. Eine Quelle fuer Drawer, Positionsmenue
 * und Tooltips – Reihenfolge kommt aus SOURCING_SPALTEN.
 * Drag, Name und Aktionen fehlen bewusst: die sind immer sichtbar bzw. nicht
 * als Anker nutzbar.
 */
export const SOURCING_SPALTEN_LABELS = {
  'cp-col-bild': 'Bild',
  'cp-col-notiz': 'Kurzbeschreibung',
  'cp-col-matching': 'Matching',
  'cp-col-typ': 'Creator Art',
  'cp-col-status': 'Status',
  'cp-col-kunden-feedback': 'Kundenfeedback',
  'cp-col-nutzungsrechte': 'Nutzungsrechte',
  'cp-col-location': 'Location',
  'cp-col-mail': 'Mail (nur intern)',
  'cp-col-telefon': 'Telefon (nur intern)',
  'cp-col-link-ig': 'Link Instagram',
  'cp-col-follower-ig': 'Follower Instagram',
  'cp-col-cpm-ig-8': 'Preis 8 Reels (Instagram)',
  'cp-col-cpm-ig-30': 'Preis 30 Reels (Instagram)',
  'cp-col-preis-reels': 'Preis Reels (Instagram)',
  'cp-col-reichweite-story': 'Reichweite Story (Instagram)',
  'cp-col-preis-story': 'Preis Story (Instagram)',
  'cp-col-link-tt': 'Link TikTok',
  'cp-col-follower-tt': 'Follower TikTok',
  'cp-col-preis-tt-video': 'Preis Video (TikTok)',
  'cp-col-preis-tt-story': 'Preis Story (TikTok)',
  'cp-col-pricing': 'Gesamtpreis',
  'cp-col-reichweite-garantie': 'Reichweitengarantie',
  'cp-col-ek': 'EK (Einkaufspreis)',
  'cp-col-vk': 'VK (Verkaufspreis)',
  'cp-col-feedback': 'Rückmeldung Kunde'
};

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
 * Die linken Spalten bleiben beim Querscrollen stehen. Welche Position Bild und
 * Name dabei einnehmen, haengt davon ab, ob die Drag-Spalte existiert (nur
 * intern) und ob die Bild-Spalte eingeblendet ist. Die passenden left-Offsets
 * leitet das CSS aus den Klassen ab, siehe .col-sticky-* in components.css.
 */
export function getStickyClasses(ctx) {
  const bildSichtbar = isColumnVisibleForCustomer('cp-col-bild', ctx.isKunde, ctx.hiddenColumns);
  // Die Drag-Spalte (Position 1) gibt es nur, wer auch editieren darf -
  // ein view-only Interner (Investor) hat sie nicht.
  const hasDrag = !ctx.isKunde && (ctx.canEdit ?? true);
  let position = hasDrag ? 2 : 1;

  const bild = bildSichtbar ? `col-sticky-${position++}` : '';
  return { bild, name: `col-sticky-${position}` };
}

// --- SVG Icons ---

export const EXTERNAL_LINK_ICON = `${icon('external-link')}`;

export const MAIL_ICON = `${icon('envelope-open')}`;

export const INSTAGRAM_ICON = `${icon('instagram')}`;

export const TIKTOK_ICON = `${icon('tiktok')}`;

export const NICHT_UMSETZEN_ICON = `${icon('x-circle-filled', { className: 'icon-16' })}`;

// --- Status-Reiter (Tabs) ---

// "Alle" ist der Einstiegspunkt; die uebrigen Reiter spiegeln den internen
// Prozessstatus. Das Kundenfeedback (Prio/Abgelehnt) hat keinen eigenen
// Reiter - es steht in der eigenen Spalte und im Toolbar-Filter.
export const SOURCING_TABS = [
  { key: 'alle', label: 'Alle' },
  { key: 'offen', label: 'Offen' },
  { key: 'angefragt', label: 'Angefragt' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'in_verhandlung', label: 'In Verhandlung' },
  { key: 'absage', label: 'Abgesagt' },
  { key: 'zusage', label: 'Zusage' },
  { key: 'gebucht', label: 'Gebucht' }
];

/** Der Reiter eines Items ist sein Prozess-Status; Feedback-Flags spielen keine Rolle. */
export function getSourcingTabForItem(item) {
  return getSourcingStatus(item);
}

export function renderTabNavigation(ctx) {
  const activeTab = ctx.activeTab || 'alle';
  const counts = ctx.tabCounts || {};
  return `
    <div class="tab-navigation sourcing-tab-navigation">
      ${SOURCING_TABS.map(tab => `
        <button type="button" class="tab-button${tab.key === activeTab ? ' active' : ''}" data-sourcing-tab="${tab.key}">
          ${tab.label} <span class="tab-count" data-sourcing-tab-count="${tab.key}">${counts[tab.key] ?? 0}</span>
        </button>
      `).join('')}
    </div>
  `;
}

