// CreatorAuswahlTemplates.js
// Reine Render-Funktionen und Shared Helpers fuer die Creator-Auswahl Detail-Ansicht

import { CREATOR_TYP_SELECT_OPTIONS } from './creatorTypeOptions.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { renderTableSelect } from '../../core/components/TableSelect.js';
import { formatCompactNumber, formatExactNumber } from '../../core/format/compactNumber.js';
import {
  SOURCING_STATUS_OPTIONS,
  getSourcingStatus,
  getSourcingStatusMeta
} from './sourcingStatusOptions.js';

// --- Shared Helpers ---

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getTeilbereicheFromListe(liste) {
  if (!liste?.teilbereich) return [];
  return liste.teilbereich.split(',').map(tb => tb.trim()).filter(tb => tb);
}

export function groupItemsByKategorie(items) {
  const groups = {};
  let globalIndex = 0;

  items.forEach(item => {
    const kategorie = item.kategorie || 'Ohne Kategorie';
    if (!groups[kategorie]) {
      groups[kategorie] = [];
    }
    groups[kategorie].push({ ...item, globalIndex: globalIndex++ });
  });

  return groups;
}

/** Spalten, die es in der Tabelle nicht mehr gibt, aber noch in hidden_columns stehen koennen */
const ENTFERNTE_SPALTEN = [
  'cp-col-cpm-ig', 'cp-col-cpm-tt',
  // Die manuellen Reichweite-Spalten sind entfallen: die Views stehen jetzt
  // unter Preis 8 / 30 / Ø direkt in der Zelle.
  'cp-col-reichweite-ig', 'cp-col-reichweite-tt'
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
export const TIKTOK_SPALTEN = ['cp-col-link-tt', 'cp-col-follower-tt'];

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
 */
export const SOURCING_SPALTEN = [
  'cp-col-drag', 'cp-col-bild', 'cp-col-name', 'cp-col-typ', 'cp-col-location',
  'cp-col-mail', 'cp-col-telefon',
  'cp-col-link-ig', 'cp-col-follower-ig',
  'cp-col-cpm-ig-8', 'cp-col-cpm-ig-30', 'cp-col-cpm-ig-trimmed',
  'cp-col-reichweite-story', 'cp-col-preis-story',
  'cp-col-link-tt', 'cp-col-follower-tt',
  'cp-col-pricing', 'cp-col-reichweite-garantie',
  'cp-col-ek', 'cp-col-vk',
  'cp-col-notiz', 'cp-col-feedback', 'cp-col-anfragen', 'cp-col-status',
  'cp-col-check', 'cp-col-actions'
];

export function getVisibleColumnCount(isKunde, hiddenColumns) {
  let count = 0;
  for (const col of SOURCING_SPALTEN) {
    if (col === 'cp-col-drag' && isKunde) continue;
    if (col === 'cp-col-actions' && isKunde) continue;
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
  let position = ctx.isKunde ? 1 : 2;   // intern belegt die Drag-Spalte die 1

  const bild = bildSichtbar ? `col-sticky-${position++}` : '';
  return { bild, name: `col-sticky-${position}` };
}

// --- SVG Icons ---

const EXTERNAL_LINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>`;

const MAIL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>`;

const INSTAGRAM_ICON = `<svg class="platform-icon platform-icon--instagram" viewBox="0 0 24 24" aria-label="Instagram" role="img" focusable="false"><path d="M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Zm0 7.8a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/><path d="M16.95 6.45a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z"/><path d="M12 2.8c2.53 0 2.83.01 3.83.06 1 .05 1.68.21 2.28.44.62.24 1.15.56 1.66 1.07.51.51.83 1.04 1.07 1.66.23.6.39 1.28.44 2.28.05 1 .06 1.3.06 3.83s-.01 2.83-.06 3.83c-.05 1-.21 1.68-.44 2.28-.24.62-.56 1.15-1.07 1.66-.51.51-1.04.83-1.66 1.07-.6.23-1.28.39-2.28.44-1 .05-1.3.06-3.83.06s-2.83-.01-3.83-.06c-1-.05-1.68-.21-2.28-.44a4.54 4.54 0 0 1-2.73-2.73c-.23-.6-.39-1.28-.44-2.28C2.81 14.83 2.8 14.53 2.8 12s.01-2.83.06-3.83c.05-1 .21-1.68.44-2.28.24-.62.56-1.15 1.07-1.66.51-.51 1.04-.83 1.66-1.07.6-.23 1.28-.39 2.28-.44 1-.05 1.3-.06 3.83-.06Zm0 1.8c-2.48 0-2.77.01-3.75.06-.9.04-1.39.19-1.71.31-.43.17-.74.37-1.07.7-.33.33-.53.64-.7 1.07-.12.32-.27.81-.31 1.71-.05.98-.06 1.27-.06 3.75s.01 2.77.06 3.75c.04.9.19 1.39.31 1.71.17.43.37.74.7 1.07.33.33.64.53 1.07.7.32.12.81.27 1.71.31.98.05 1.27.06 3.75.06s2.77-.01 3.75-.06c.9-.04 1.39-.19 1.71-.31.43-.17.74-.37 1.07-.7.33-.33.53-.64.7-1.07.12-.32.27-.81.31-1.71.05-.98.06-1.27.06-3.75s-.01-2.77-.06-3.75c-.04-.9-.19-1.39-.31-1.71-.17-.43-.37-.74-.7-1.07-.33-.33-.64-.53-1.07-.7-.32-.12-.81-.27-1.71-.31-.98-.05-1.27-.06-3.75-.06Z"/></svg>`;

const TIKTOK_ICON = `<svg class="platform-icon platform-icon--tiktok" viewBox="0 0 24 24" aria-label="TikTok" role="img" focusable="false"><path d="M14.5 3c.4 3.2 2.3 5.1 5.5 5.5v2.3c-1.9 0-3.6-.6-5-1.7v6.4c0 3.1-2.5 5.6-5.6 5.6S3.8 19 3.8 15.9s2.5-5.6 5.6-5.6c.5 0 1 .1 1.5.2v2.6c-.5-.2-1-.4-1.5-.4-1.8 0-3.2 1.4-3.2 3.2s1.4 3.2 3.2 3.2 3.2-1.4 3.2-3.2V3h2.9Z"/></svg>`;

const NICHT_UMSETZEN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>`;

export const IG_FETCH_CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>`;

const IG_FETCH_WARN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008M10.34 3.94 2.7 17.1A1.5 1.5 0 0 0 4 19.35h16a1.5 1.5 0 0 0 1.3-2.25L13.66 3.94a1.5 1.5 0 0 0-2.62 0Z" /></svg>`;

const IG_FETCH_REFRESH_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M88,104H40a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0V76.69L62.63,62.06A95.43,95.43,0,0,1,130,33.94h.53a95.36,95.36,0,0,1,67.07,27.33,8,8,0,0,1-11.18,11.44,79.52,79.52,0,0,0-55.89-22.77h-.45A79.56,79.56,0,0,0,73.94,73.37L59.31,88H88a8,8,0,0,1,0,16Zm128,48H168a8,8,0,0,0,0,16h28.69l-14.63,14.63a79.56,79.56,0,0,1-56.13,23.43h-.45a79.52,79.52,0,0,1-55.89-22.77,8,8,0,1,0-11.18,11.44,95.36,95.36,0,0,0,67.07,27.33H126a95.43,95.43,0,0,0,67.36-28.12L208,179.31V208a8,8,0,0,0,16,0V160A8,8,0,0,0,216,152Z"></path></svg>`;

/**
 * Haekchen-Button neben dem IG-Link: holt Profil, Follower und CPM.
 * Der erste Klick nimmt bekannte Creator aus dem Pool (sourcing_creator),
 * der Refresh-Zustand holt frisch bei Instagram.
 */
export function renderIgFetchButton(item) {
  const hasError = !!item.ig_fetch_error;
  const hasFetched = !hasError && !!item.ig_fetched_at;

  let icon = IG_FETCH_CHECK_ICON;
  let stateClass = '';
  let title = 'Instagram-Daten abrufen (bekannte Creator kommen aus dem Pool)';
  let label = 'Instagram-Daten abrufen';

  if (hasError) {
    icon = IG_FETCH_WARN_ICON;
    stateClass = ' is-error';
    title = `Abruf fehlgeschlagen: ${item.ig_fetch_error}`;
  } else if (hasFetched) {
    icon = IG_FETCH_REFRESH_ICON;
    stateClass = ' is-refresh';
    title = `Stand: ${new Date(item.ig_fetched_at).toLocaleString('de-DE')} · frisch bei Instagram abrufen`;
    label = 'Instagram-Daten frisch abrufen';
  }

  return `
    <button type="button"
            class="ig-fetch-btn${stateClass}"
            data-ig-fetch
            data-item-id="${item.id}"
            title="${escapeHtml(title)}"
            aria-label="${escapeHtml(label)}">
      ${icon}
    </button>
  `;
}

// --- Status-Reiter (Tabs) ---

export const SOURCING_TABS = [
  { key: 'offen', label: 'Offen' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'gebucht', label: 'Gebucht' },
  { key: 'nicht_buchen', label: 'Nicht buchen' },
  { key: 'alle', label: 'Alle' }
];

export function getSourcingTabForItem(item) {
  if (item.absage) return 'nicht_buchen';
  if (item.gebucht) return 'gebucht';
  if (item.on_hold) return 'on_hold';
  return 'offen';
}

export function renderTabNavigation(ctx) {
  const activeTab = ctx.activeTab || 'offen';
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

// --- Render-Funktionen ---
// ctx = { items, liste, isKunde, hiddenColumns }

export function renderAddSection(ctx = {}) {
  const kundenCallActive = ctx.kundenCallActive || false;
  return `
    <div class="add-item-section add-item-section--compact">
      <div class="add-item-actions-left">
        ${SearchInput.render('sourcing-item', {
          placeholder: 'Name suchen...',
          currentValue: escapeHtml(ctx.searchQuery || '')
        })}
      </div>
      ${!ctx.isKunde ? `
      <div class="add-item-actions-right">
        <div id="sourcing-status-filter-container"></div>
        <button type="button" class="secondary-btn" id="btn-share-sourcing" title="Liste per E-Mail teilen">
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" style="width: 16px; height: 16px;">
            <path d="M229.66,109.66l-48,48a8,8,0,0,1-11.32-11.32L204.69,112H165a88,88,0,0,0-85.23,66,8,8,0,0,1-15.5-4A103.94,103.94,0,0,1,165,96h39.71L170.34,61.66a8,8,0,0,1,11.32-11.32l48,48A8,8,0,0,1,229.66,109.66ZM192,208H40V88a8,8,0,0,0-16,0V216a8,8,0,0,0,8,8H192a8,8,0,0,0,0-16Z"></path>
          </svg>
          Teilen
        </button>
        <button type="button" class="secondary-btn${kundenCallActive ? ' active' : ''}" id="btn-kunden-call-toggle" title="EK und CPM für Kundenpräsentation ausblenden">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
          </svg>
          Kunden Call
        </button>
        <button type="button" class="secondary-btn" id="btn-sourcing-tabelle-anpassen" title="TKP, Art der Liste und Spalten-Sichtbarkeit">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          Tabelle anpassen
        </button>
        <button type="button" class="secondary-btn" id="btn-sourcing-custom-columns" title="Eigene Spalten verwalten">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
          Eigene Spalten
        </button>
        <button type="button" class="secondary-btn" id="btn-manage-kategorien" title="Kategorien verwalten">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6Z" />
          </svg>
          Kategorien
        </button>
        <button type="button" class="primary-btn" id="btn-open-add-drawer">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Creator hinzufügen
        </button>
      </div>
      ` : ''}
    </div>
  `;
}

export function renderItemsTable(ctx) {
  const searchQuery = (ctx.searchQuery || '').trim();
  // Suche aktiv und gar kein Name matcht (unabhaengig vom Reiter)
  if (ctx.items.length === 0 && ctx.hasAnyItems && searchQuery && (ctx.tabCounts?.alle ?? 0) === 0) {
    return `
      <div class="table-container table-container--empty" style="text-align: center; padding: var(--space-xxl); color: var(--text-secondary);">
        <p>Keine Treffer für "${escapeHtml(searchQuery)}"</p>
      </div>
    `;
  }
  const statusFilter = ctx.statusFilter || [];
  if (ctx.items.length === 0 && ctx.hasAnyItems && statusFilter.length > 0) {
    const imReiter = ctx.activeTab && ctx.activeTab !== 'alle'
      ? ` im Reiter "${SOURCING_TABS.find(t => t.key === ctx.activeTab)?.label || ctx.activeTab}"`
      : '';
    return `
      <div class="table-container table-container--empty" style="text-align: center; padding: var(--space-xxl); color: var(--text-secondary);">
        <p>Keine Creator mit Status ${escapeHtml(statusFilter.join(' oder '))}${imReiter}</p>
      </div>
    `;
  }
  if (ctx.items.length === 0 && ctx.hasAnyItems && ctx.activeTab && ctx.activeTab !== 'alle') {
    const tabLabel = SOURCING_TABS.find(t => t.key === ctx.activeTab)?.label || ctx.activeTab;
    return `
      <div class="table-container table-container--empty" style="text-align: center; padding: var(--space-xxl); color: var(--text-secondary);">
        <p>Keine Creator im Reiter "${tabLabel}"</p>
      </div>
    `;
  }
  if (ctx.items.length === 0) {
    return `
      <div class="table-container table-container--empty" style="text-align: center; padding: var(--space-xxl); color: var(--text-secondary);">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" style="width: 64px; height: 64px; margin: 0 auto var(--space-md); opacity: 0.5;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
        <p>Noch keine Creator hinzugefügt</p>
        ${!ctx.isKunde ? '<p style="font-size: var(--text-sm);">Fügen Sie oben einen Creator hinzu</p>' : ''}
      </div>
    `;
  }

  const vis = (col) => isColumnVisibleForCustomer(col, ctx.isKunde, ctx.hiddenColumns);
  const customCount = ctx.customManager ? ctx.customManager.visibleCount(ctx.hiddenColumns, ctx.isKunde) : 0;
  const visibleColCount = getVisibleColumnCount(ctx.isKunde, ctx.hiddenColumns) + customCount;
  const hide = (col) => !vis(col) ? 'style="display:none;"' : '';
  const sticky = getStickyClasses(ctx);
  const tkpLabel = getListenTkp(ctx.liste).toLocaleString('de-DE');

  return `
    <div class="table-container creator-pool-table-container">
      <table class="data-table strategie-items-table creator-pool-table${!ctx.isKunde ? ' has-bulk-select' : ''}">
        <thead>
          <tr>
            ${!ctx.isKunde ? '<th class="col-drag col-sticky-1 cp-col-drag"><input type="checkbox" class="sourcing-select-all" title="Alle auswählen"></th>' : ''}
            <th class="cp-col-bild ${sticky.bild}" ${hide('cp-col-bild')}></th>
            <th class="${sticky.name} cp-col-name">Name</th>
            <th class="cp-col-typ" ${hide('cp-col-typ')}>Creator Art</th>
            <th class="cp-col-location" ${hide('cp-col-location')}>Location</th>
            <th class="cp-col-mail" ${hide('cp-col-mail')} title="Aus der Instagram-Bio gelesen, sofern dort hinterlegt">Mail</th>
            <th class="cp-col-telefon" ${hide('cp-col-telefon')} title="Aus der Instagram-Bio gelesen, sofern dort hinterlegt">Telefon</th>
            <th class="cp-col-link-ig" ${hide('cp-col-link-ig')}>Link ${INSTAGRAM_ICON}</th>
            <th class="cp-col-follower-ig" ${hide('cp-col-follower-ig')}>Follower ${INSTAGRAM_ICON}</th>
            <th class="cp-col-cpm-ig-8" ${hide('cp-col-cpm-ig-8')} title="Geschätzter Preis bei ${tkpLabel} € TKP – Views-Schnitt der letzten 8 Reels">Preis 8 Reels ${INSTAGRAM_ICON}</th>
            <th class="cp-col-cpm-ig-30" ${hide('cp-col-cpm-ig-30')} title="Geschätzter Preis bei ${tkpLabel} € TKP – Views-Schnitt der letzten 30 Reels">Preis 30 Reels ${INSTAGRAM_ICON}</th>
            <th class="cp-col-cpm-ig-trimmed" ${hide('cp-col-cpm-ig-trimmed')} title="Geschätzter Preis bei ${tkpLabel} € TKP – getrimmter Views-Schnitt, Ausreißer gekürzt">Preis Ø Reels ${INSTAGRAM_ICON}</th>
            <th class="cp-col-reichweite-story" ${hide('cp-col-reichweite-story')} title="Manuell gepflegt – Story-Reichweite liefert die Instagram-API für fremde Accounts nicht">Reichweite Story ${INSTAGRAM_ICON}</th>
            <th class="cp-col-preis-story" ${hide('cp-col-preis-story')} title="Manuell gepflegt">Preis Story ${INSTAGRAM_ICON}</th>
            <th class="cp-col-link-tt" ${hide('cp-col-link-tt')}>Link ${TIKTOK_ICON}</th>
            <th class="cp-col-follower-tt" ${hide('cp-col-follower-tt')}>Follower ${TIKTOK_ICON}</th>
            <th class="cp-col-pricing" ${hide('cp-col-pricing')}>Tatsächlicher Preis</th>
            <th class="cp-col-reichweite-garantie" ${hide('cp-col-reichweite-garantie')}>RW Garantie</th>
            <th class="cp-col-ek" ${hide('cp-col-ek')}>EK</th>
            <th class="cp-col-vk" ${hide('cp-col-vk')}>VK</th>
            <th class="cp-col-notiz" ${hide('cp-col-notiz')}>Kurzbeschreibung</th>
            <th class="cp-col-feedback" ${hide('cp-col-feedback')}>Rückmeldung Kunde</th>
            <th class="cp-col-anfragen" ${hide('cp-col-anfragen')}>Anfragen</th>
            <th class="cp-col-status" ${hide('cp-col-status')}>Status</th>
            <th class="cp-col-check" ${hide('cp-col-check')}>Rückmeldung</th>
            ${ctx.customManager ? ctx.customManager.renderHeaders(ctx.hiddenColumns, ctx.isKunde) : ''}
            ${!ctx.isKunde ? '<th class="col-actions cp-col-actions">Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody id="items-table-body">
          ${renderGroupedItems(ctx)}
        </tbody>
        ${!ctx.isKunde ? `
        <tfoot>
          <tr class="add-row-footer">
            <td colspan="${visibleColCount}">
              <button type="button" class="add-row-btn" id="btn-add-empty-row" title="Neue Zeile hinzufügen">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </td>
          </tr>
        </tfoot>
        ` : ''}
      </table>
    </div>
  `;
}

export function renderGroupedItems(ctx) {
  const NICHT_UMSETZEN_KATEGORIE = 'Nicht umsetzen';
  const definierteKategorien = getTeilbereicheFromListe(ctx.liste);
  const hatDefinierteKategorien = definierteKategorien.length > 0;

  if (!hatDefinierteKategorien) {
    return ctx.items.map((item, index) => renderItemRow(ctx, item, index)).join('');
  }

  const groupedItems = groupItemsByKategorie(ctx.items);
  const customCount = ctx.customManager ? ctx.customManager.visibleCount(ctx.hiddenColumns, ctx.isKunde) : 0;
  const colCount = getVisibleColumnCount(ctx.isKunde, ctx.hiddenColumns) + customCount;

  let html = '';
  let globalIndex = 0;

  const normaleKategorien = definierteKategorien.filter(k => k !== NICHT_UMSETZEN_KATEGORIE);

  for (const kategorie of normaleKategorien) {
    const items = groupedItems[kategorie] || [];
    html += `
      <tr class="kategorie-header-row" data-kategorie="${kategorie}">
        <td colspan="${colCount}" class="kategorie-header">
          <div class="kategorie-header-content">
            ${!ctx.isKunde ? `<input type="checkbox" class="sourcing-group-select" data-kategorie="${kategorie}" title="Alle in '${kategorie}' auswählen">` : ''}
            <span class="kategorie-label">${kategorie}</span>
            <span class="kategorie-count">(${items.length})</span>
          </div>
        </td>
      </tr>
    `;
    for (const item of items) {
      html += renderItemRow(ctx, item, globalIndex++);
    }
  }

  const ohneKategorie = groupedItems['Ohne Kategorie'] || [];
  if (ohneKategorie.length > 0 || normaleKategorien.length > 0) {
    html += `
      <tr class="kategorie-header-row" data-kategorie="Ohne Kategorie">
        <td colspan="${colCount}" class="kategorie-header kategorie-header--default">
          <div class="kategorie-header-content">
            ${!ctx.isKunde ? `<input type="checkbox" class="sourcing-group-select" data-kategorie="Ohne Kategorie" title="Alle ohne Kategorie auswählen">` : ''}
            <span class="kategorie-label">Ohne Kategorie</span>
            <span class="kategorie-count">(${ohneKategorie.length})</span>
          </div>
        </td>
      </tr>
    `;
    for (const item of ohneKategorie) {
      html += renderItemRow(ctx, item, globalIndex++);
    }
  }

  const nichtUmsetzenItems = groupedItems[NICHT_UMSETZEN_KATEGORIE] || [];
  if (nichtUmsetzenItems.length > 0 || definierteKategorien.includes(NICHT_UMSETZEN_KATEGORIE)) {
    html += `
      <tr class="kategorie-header-row kategorie-header-row--rejected" data-kategorie="${NICHT_UMSETZEN_KATEGORIE}">
        <td colspan="${colCount}" class="kategorie-header kategorie-header--rejected">
          <div class="kategorie-header-content">
            ${!ctx.isKunde ? `<input type="checkbox" class="sourcing-group-select" data-kategorie="${NICHT_UMSETZEN_KATEGORIE}" title="Alle in 'Nicht umsetzen' auswählen">` : ''}
            <span class="kategorie-label">${NICHT_UMSETZEN_ICON} ${NICHT_UMSETZEN_KATEGORIE}</span>
            <span class="kategorie-count">(${nichtUmsetzenItems.length})</span>
          </div>
        </td>
      </tr>
    `;
    for (const item of nichtUmsetzenItems) {
      html += renderItemRow(ctx, item, globalIndex++);
    }
  }

  return html;
}

/** 740500 -> "740,5K", 6000 -> "6,0K", 850 -> "850" */
function formatReachShort(views) {
  const n = Number(views);
  if (!Number.isFinite(n)) return null;
  const oneDecimal = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  if (n >= 1000000) return `${(n / 1000000).toLocaleString('de-DE', oneDecimal)}M`;
  if (n >= 1000) return `${(n / 1000).toLocaleString('de-DE', oneDecimal)}K`;
  return Math.round(n).toLocaleString('de-DE');
}

/** TKP fuer Listen ohne eigenen Wert - entspricht dem alten festen Satz */
export const DEFAULT_TKP = 25;

/** Preis pro 1.000 Views dieser Liste */
export function getListenTkp(liste) {
  const tkp = Number(liste?.tkp);
  return Number.isFinite(tkp) && tkp > 0 ? tkp : DEFAULT_TKP;
}

/** Views-Schnitt -> Preis in Euro, auf Cent gerundet */
export function berechnePreisAusViews(views, tkp) {
  // Number(null) waere 0 und wuerde einen Preis von 0,00 € statt "-" ergeben
  if (views == null || views === '') return null;
  const n = Number(views);
  if (!Number.isFinite(n)) return null;
  return Math.round((n / 1000) * tkp * 100) / 100;
}

/**
 * Automatisch berechnete Preis-Zelle (read-only). Der Preis entsteht hier aus
 * Views x Listen-TKP, nicht aus den gespeicherten cpm_ig_* - so wirkt eine
 * TKP-Aenderung sofort, ohne die Instagram-Daten neu abzurufen.
 * Mit showViews steht unter dem Preis die View-Basis, sonst waere in der
 * Tabelle nicht erkennbar, worauf sich der 8er- bzw. 30er-Wert bezieht.
 */
function renderAutoCpmCell(ctx, item, columnClass, views, hide, showViews = false) {
  const tkp = getListenTkp(ctx.liste);
  const cpm = berechnePreisAusViews(views, tkp);

  const value = cpm != null
    ? `${cpm.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
    : '-';
  const title = views != null
    ? `${Number(views).toLocaleString('de-DE')} Views im Schnitt × ${tkp.toLocaleString('de-DE')} € TKP`
    : 'Noch nicht abgerufen';

  const reach = showViews && views != null ? formatReachShort(views) : null;

  return `
    <td class="cell-textarea ${columnClass}" style="${hide(columnClass)}">
      <div class="cell-text-readonly cpm-auto-value${ctx.kundenCallActive ? ' kunden-call-blur' : ''}"
           data-blur-target
           title="${escapeHtml(title)}">
        <div class="cpm-auto-price">${value}</div>
        ${reach ? `<div class="cpm-auto-reach">Ø ${reach} Views</div>` : ''}
      </div>
    </td>
  `;
}

/**
 * Status-Zelle: fasst die frueheren Checkboxen On Hold / Buchen / Prio 1 / Prio 2 /
 * Absage in einem Select zusammen. Kunden duerfen wie bisher keine Absage setzen
 * und eine bestehende Absage nicht zuruecknehmen.
 */
function renderSourcingStatusCell(ctx, item) {
  const status = getSourcingStatus(item);
  const disabled = !!ctx.gastReadonly || (!!ctx.isKunde && !!item.absage);

  const options = SOURCING_STATUS_OPTIONS.map(option => (
    ctx.isKunde && option.value === 'absage'
      ? { ...option, disabled: true }
      : option
  ));

  return renderTableSelect({
    field: 'sourcing_status',
    itemId: item.id,
    value: status,
    options,
    disabled,
    meta: getSourcingStatusMeta(item, status)
  });
}

/**
 * Follower-Zelle: der Rohwert steckt im Input, darueber liegt die kompakte
 * Anzeige (5,5K / 1,39M). Beim Fokussieren blendet CSS das Overlay aus, sodass
 * immer die exakte Zahl bearbeitet wird und beim Speichern nichts gerundet wird.
 */
function renderFollowerCell(ctx, item, columnClass, field, hide) {
  const value = item[field];
  const compact = formatCompactNumber(value);
  const exact = formatExactNumber(value);

  if (ctx.isKunde) {
    return `
      <td class="${columnClass}" style="${hide(columnClass)}">
        <div class="cell-number__static" title="${exact}">${compact || '-'}</div>
      </td>
    `;
  }

  return `
    <td class="${columnClass}" style="${hide(columnClass)}">
      <div class="cell-number">
        <input type="text"
               inputmode="numeric"
               class="cell-number__input"
               data-field="${field}"
               data-item-id="${item.id}"
               value="${value ?? ''}"
               aria-label="${escapeHtml(FOLLOWER_LABELS[field] || field)}">
        <span class="cell-number__display" data-number-display title="${exact}">${compact || '–'}</span>
      </div>
    </td>
  `;
}

const FOLLOWER_LABELS = {
  follower_instagram: 'Follower Instagram',
  follower_tiktok: 'Follower TikTok'
};

const KONTAKT_FELDER = {
  email: { label: 'E-Mail', placeholder: 'mail@...', typ: 'email' },
  telefon: { label: 'Telefon', placeholder: '+49...', typ: 'tel' }
};

/**
 * Mail- und Telefon-Zelle. Beide Felder sind intern: bei Kunden und Gaesten
 * bleibt die Zelle leer, damit der Wert nicht ueber das Markup abfliesst -
 * ausgeblendet wird sie ohnehin schon von isColumnVisibleForCustomer.
 *
 * Der Wert wird beim Instagram-Fetch aus der Bio vorbefuellt. Telefon bleibt
 * in der Tabelle editierbar, die Mail-Spalte zeigt nur noch das Mail-Icon:
 * die Adresse braucht in der Tabelle keine eigene Spaltenbreite.
 */
function renderKontaktCell(ctx, item, columnClass, field, hide) {
  const meta = KONTAKT_FELDER[field];

  if (ctx.isKunde) {
    return `<td class="cell-textarea ${columnClass}" style="${hide(columnClass)}"><div class="cell-text-readonly">-</div></td>`;
  }

  const value = item[field] || '';
  // Das Schema steht fest, escapeHtml sichert das Attribut - encodeURIComponent
  // wuerde hier das @ der Adresse zerlegen
  const schema = meta.typ === 'email' ? 'mailto:' : 'tel:';
  const link = value
    ? `<a href="${schema}${escapeHtml(value)}" class="link-icon-btn" title="${escapeHtml(value)}">${field === 'email' ? MAIL_ICON : EXTERNAL_LINK_ICON}</a>`
    : '';

  if (field === 'email') {
    return `
      <td class="cell-textarea ${columnClass} cell-icon-only" style="${hide(columnClass)}">
        ${link || '<span class="cell-text-readonly">-</span>'}
      </td>
    `;
  }

  return `
    <td class="cell-textarea ${columnClass}" style="${hide(columnClass)}">
      <div class="links-compact-row">
        <input type="text"
               class="links-compact-input"
               data-field="${field}"
               data-item-id="${item.id}"
               placeholder="${meta.placeholder}"
               value="${escapeHtml(value)}"
               aria-label="${meta.label}">
        ${link}
      </div>
    </td>
  `;
}

/**
 * Profilbild-Zelle. Das Bild kommt beim Instagram-Fetch als AVIF in den Storage,
 * sonst steht der Initial des Namens als Platzhalter - gleiches Muster wie in
 * der CRM-Creator-Tabelle.
 *
 * Fuer den kleinen Avatar reicht das 128px-Thumbnail; Zeilen, die vor der
 * Umstellung abgerufen wurden, haben nur das Hauptbild.
 */
function renderBildCell(ctx, item, sticky, hide) {
  const rawUrl = item.profile_image_thumb_url || item.profile_image_url;
  const safeUrl = rawUrl ? (window.validatorSystem?.sanitizeUrl(rawUrl) ?? rawUrl) : null;
  const initial = (item.name || '?').trim().charAt(0).toUpperCase() || '?';

  const inner = safeUrl
    ? `<img src="${escapeHtml(safeUrl)}" alt="${escapeHtml(item.name || 'Profilbild')}" class="table-avatar table-avatar-img table-avatar--sourcing" loading="lazy" />`
    : `<span class="table-avatar table-avatar--sourcing">${escapeHtml(initial)}</span>`;

  return `<td class="cp-col-bild ${sticky.bild}" style="${hide('cp-col-bild')}">${inner}</td>`;
}

export function renderItemRow(ctx, item, index) {
  const isLinkedToCRM = !!item.creator_id;
  const vis = (col) => isColumnVisibleForCustomer(col, ctx.isKunde, ctx.hiddenColumns);
  const hide = (col) => !vis(col) ? ' display:none;' : '';
  const sticky = getStickyClasses(ctx);

  const isBooked = !!item.gebucht;

  return `
    <tr class="item-row ${!ctx.isKunde ? 'draggable' : ''} ${isBooked ? 'item-gebucht' : ''}" data-item-id="${item.id}" draggable="false">
      ${!ctx.isKunde ? `
        <td class="col-drag drag-handle col-sticky-1 cp-col-drag">
          <div class="drag-cell-content">
            <input type="checkbox" class="sourcing-item-check" data-item-id="${item.id}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="drag-icon" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </div>
        </td>
      ` : ''}
      ${renderBildCell(ctx, item, sticky, hide)}
      <td class="cell-textarea cp-col-name ${sticky.name}">
        ${!ctx.isKunde ? `
          <div class="cp-name-cell-inner">
            <textarea class="strategie-textarea" data-field="name" data-item-id="${item.id}" placeholder="Name...">${item.name || ''}</textarea>
          </div>
        ` : `<div class="cell-text-readonly">${item.name || '-'}</div>`}
      </td>
      <td class="cp-col-typ" style="${hide('cp-col-typ')}">
        ${!ctx.isKunde ? renderTableSelect({
          field: 'creator_typ',
          itemId: item.id,
          value: item.typ || '',
          options: CREATOR_TYP_SELECT_OPTIONS,
          disabled: !!ctx.gastReadonly
        }) : `<div class="cell-text-readonly">${item.typ || '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-location" style="${hide('cp-col-location')}">
        ${!ctx.isKunde ? `
          <textarea class="strategie-textarea" data-field="wohnort" data-item-id="${item.id}" placeholder="Location...">${item.wohnort || ''}</textarea>
        ` : `<div class="cell-text-readonly">${item.wohnort || '-'}</div>`}
      </td>
      ${renderKontaktCell(ctx, item, 'cp-col-mail', 'email', hide)}
      ${renderKontaktCell(ctx, item, 'cp-col-telefon', 'telefon', hide)}
      <td class="cp-col-link-ig" style="${hide('cp-col-link-ig')}">
        ${!ctx.isKunde ? `
          <div class="links-compact-row">
            <input type="text" class="links-compact-input" data-field="link_instagram" data-item-id="${item.id}" placeholder="IG Link..." value="${item.link_instagram || ''}">
            ${renderIgFetchButton(item)}
            ${item.link_instagram ? `<a href="${item.link_instagram}" target="_blank" class="link-icon-btn" title="${item.link_instagram}">${EXTERNAL_LINK_ICON}</a>` : ''}
          </div>
        ` : `
          <div class="links-compact-cell links-compact-cell--readonly">
            ${item.link_instagram ? `<a href="${item.link_instagram}" target="_blank" class="link-icon-btn" title="Instagram">${INSTAGRAM_ICON}</a>` : '<span class="cell-text-readonly">-</span>'}
          </div>
        `}
      </td>
      ${renderFollowerCell(ctx, item, 'cp-col-follower-ig', 'follower_instagram', hide)}
      ${renderAutoCpmCell(ctx, item, 'cp-col-cpm-ig-8', item.ig_views_8, hide, true)}
      ${renderAutoCpmCell(ctx, item, 'cp-col-cpm-ig-30', item.ig_views_30, hide, true)}
      ${renderAutoCpmCell(ctx, item, 'cp-col-cpm-ig-trimmed', item.ig_views_trimmed, hide, true)}
      <td class="cell-textarea cp-col-reichweite-story" style="${hide('cp-col-reichweite-story')}">
        ${!ctx.isKunde ? `
          <input type="text" class="strategie-textarea" data-field="reichweite_story" data-item-id="${item.id}" placeholder="z.B. 10K" value="${item.reichweite_story || ''}">
        ` : `<div class="cell-text-readonly">${item.reichweite_story || '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-preis-story" style="${hide('cp-col-preis-story')}">
        ${!ctx.isKunde ? `
          <input type="text" class="strategie-textarea" data-field="preis_story" data-item-id="${item.id}" placeholder="Preis..." value="${item.preis_story || ''}">
        ` : `<div class="cell-text-readonly">${item.preis_story || '-'}</div>`}
      </td>
      <td class="cp-col-link-tt" style="${hide('cp-col-link-tt')}">
        ${!ctx.isKunde ? `
          <div class="links-compact-row">
            <input type="text" class="links-compact-input" data-field="link_tiktok" data-item-id="${item.id}" placeholder="TT Link..." value="${item.link_tiktok || ''}">
            ${item.link_tiktok ? `<a href="${item.link_tiktok}" target="_blank" class="link-icon-btn" title="${item.link_tiktok}">${EXTERNAL_LINK_ICON}</a>` : ''}
          </div>
        ` : `
          <div class="links-compact-cell links-compact-cell--readonly">
            ${item.link_tiktok ? `<a href="${item.link_tiktok}" target="_blank" class="link-icon-btn" title="TikTok">${TIKTOK_ICON}</a>` : '<span class="cell-text-readonly">-</span>'}
          </div>
        `}
      </td>
      ${renderFollowerCell(ctx, item, 'cp-col-follower-tt', 'follower_tiktok', hide)}
      <td class="cell-textarea cp-col-pricing" style="${hide('cp-col-pricing')}">
        ${!ctx.isKunde ? `
          <textarea class="strategie-textarea" data-field="pricing" data-item-id="${item.id}" placeholder="Preis...">${item.pricing || ''}</textarea>
        ` : `<div class="cell-text-readonly">${item.pricing || '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-reichweite-garantie" style="${hide('cp-col-reichweite-garantie')}">
        ${!ctx.isKunde ? `
          <input type="text" class="strategie-textarea" data-field="reichweite_garantie" data-item-id="${item.id}" placeholder="z.B. 50K" value="${item.reichweite_garantie || ''}">
        ` : `<div class="cell-text-readonly">${item.reichweite_garantie || '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-ek" style="${hide('cp-col-ek')}">
        ${!ctx.isKunde ? `
          <input type="number" class="strategie-textarea${ctx.kundenCallActive ? ' kunden-call-blur' : ''}" data-field="preis_ek" data-item-id="${item.id}" data-blur-target placeholder="0" value="${item.preis_ek ?? ''}" step="0.01">
        ` : `<div class="cell-text-readonly">${item.preis_ek != null ? Number(item.preis_ek).toLocaleString('de-DE', {minimumFractionDigits: 0}) + ' €' : '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-vk" style="${hide('cp-col-vk')}">
        ${!ctx.isKunde ? `
          <input type="number" class="strategie-textarea" data-field="preis_vk" data-item-id="${item.id}" placeholder="0" value="${item.preis_vk ?? ''}" step="0.01">
        ` : `<div class="cell-text-readonly">-</div>`}
      </td>
      <td class="cell-textarea cp-col-notiz" style="${hide('cp-col-notiz')}">
        ${!ctx.isKunde ? `
          <textarea class="strategie-textarea" data-field="notiz" data-item-id="${item.id}" placeholder="Kurzbeschreibung...">${item.notiz || ''}</textarea>
        ` : `<div class="cell-text-readonly">${item.notiz || '-'}</div>`}
      </td>
      <td class="cell-textarea cp-col-feedback" style="${hide('cp-col-feedback')}">
        <textarea
          class="strategie-textarea auto-resize-textarea ${(ctx.isKunde && !ctx.gastReadonly) ? '' : 'readonly-textarea'}"
          data-field="feedback_kunde"
          data-item-id="${item.id}"
          placeholder="${(ctx.isKunde && !ctx.gastReadonly) ? 'Ihr Feedback...' : 'Rückmeldung Kunde...'}"
          ${(ctx.isKunde && !ctx.gastReadonly) ? '' : 'readonly'}
        >${item.feedback_kunde || ''}</textarea>
        ${item.feedback_kunde && item.feedback_kunde_author_name ? `
          <div class="feedback-author-meta" style="font-size:0.72rem;color:var(--text-secondary,#999);padding:2px 4px;">
            ${item.feedback_kunde_author_name}${item.feedback_kunde_updated_at ? ` · ${new Date(item.feedback_kunde_updated_at).toLocaleDateString('de-DE')}` : ''}
          </div>` : ''}
      </td>
      <td class="cp-col-anfragen" style="${hide('cp-col-anfragen')}">
        <div class="angefragt-cell">
          <input
            type="checkbox"
            ${item.angefragt ? 'checked' : ''}
            data-field="angefragt"
            data-item-id="${item.id}"
            class="cp-checkbox${ctx.isKunde ? ' cp-checkbox--readonly' : ''}"
            ${ctx.isKunde ? 'disabled' : ''}
          >
          ${item.angefragt_am ? `<span class="angefragt-datum">${new Date(item.angefragt_am).toLocaleDateString('de-DE')}</span>` : ''}
        </div>
      </td>
      <td class="cp-col-status" style="${hide('cp-col-status')}">
        ${renderSourcingStatusCell(ctx, item)}
      </td>
      <td class="cp-col-check" style="${hide('cp-col-check')}">
        <input
          type="checkbox"
          ${item.rueckmeldung_creator ? 'checked' : ''}
          data-field="rueckmeldung_creator"
          data-item-id="${item.id}"
          class="cp-checkbox${ctx.isKunde ? ' cp-checkbox--readonly' : ''}"
          ${ctx.isKunde ? 'disabled' : ''}
        >
      </td>
      ${ctx.customManager ? ctx.customManager.renderCells(item.id, ctx.hiddenColumns, ctx.isKunde) : ''}
      ${!ctx.isKunde ? `
        <td class="col-actions cp-col-actions">
          <div class="actions-dropdown-container" data-entity-type="creator_auswahl_item">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            <div class="actions-dropdown">
              ${''}
              <!-- CRM-Uebernahme vorerst ausgeblendet -->
              <a href="#" class="action-item action-danger" data-action="delete-item" data-id="${item.id}">
                ${window.ActionsDropdown?.getHeroIcon('delete') || ''}
                Löschen
              </a>
            </div>
          </div>
        </td>
      ` : ''}
    </tr>
  `;
}
