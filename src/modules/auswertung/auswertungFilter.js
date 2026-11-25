// auswertungFilter.js
// Filter der Post-Tabelle: Creator, Ansatz und Plattform als Mehrfachauswahl im Kopf der Tabelle.
// Innerhalb eines Filters reicht ein Treffer, mehrere Filter gelten zusammen. Ein Filter steht nur
// da, wenn die Ebene mindestens zwei Werte dafür hat. Die Kacheln darüber bleiben ungefiltert.

import { readFilterSelectValues, renderFilterSelect } from '../../core/filters/FilterSelect.js';
import { PLATTFORMEN } from './auswertungKonfig.js';

const OHNE = '__ohne';
const PANEL_OWNER = 'filter-select-auswertung-';
const PLATTFORM_FOLGE = Object.keys(PLATTFORMEN);

const FILTER = [
  { key: 'creator', label: 'Creator', emptyLabel: 'Alle Creator', placeholder: 'Creator suchen...' },
  { key: 'ansatz', label: 'Ansatz', emptyLabel: 'Alle Ansätze', placeholder: 'Ansatz suchen...' },
  { key: 'plattform', label: 'Plattform', emptyLabel: 'Alle Plattformen' }
];
const OHNE_LABEL = { creator: 'Ohne Creator', ansatz: 'Ohne Ansatz' };

export const leererFilter = () => ({ creator: [], ansatz: [], plattform: [] });

/** Schlüssel des Creators einer Einheit; auch die Gruppen der Post-Tabelle hängen daran. */
export const creatorWert = (einheit) => einheit?.creator?.id || einheit?.creator?.name || OHNE;
const ansatzWerte = (einheit) => (einheit?.tags?.ansatz?.length ? einheit.tags.ansatz : [OHNE]);

/** Werte einer Tabellenzeile je Filter. Ohne Post hat die Zeile keine Plattform. */
function werteDerZeile(key, { einheit, post }) {
  if (key === 'creator') return [creatorWert(einheit)];
  if (key === 'ansatz') return ansatzWerte(einheit);
  return post?.plattform ? [post.plattform] : [];
}

/** Alphabetisch, „Ohne …“ am Ende; Plattformen in der Reihenfolge der Konfiguration. */
function sortiert(key, map) {
  const liste = [...map].map(([value, label]) => ({ value, label }));
  if (key === 'plattform') return liste.sort((a, b) => PLATTFORM_FOLGE.indexOf(a.value) - PLATTFORM_FOLGE.indexOf(b.value));
  return liste.sort((a, b) => (a.value === OHNE) - (b.value === OHNE) || a.label.localeCompare(b.label, 'de'));
}

/** Wählbare Werte je Filter aus allen Einheiten und Posts der Ebene. */
export function filterOptionen(modell) {
  const creator = new Map();
  const ansatz = new Map();
  (modell.einheiten || []).forEach((e) => {
    const wert = creatorWert(e);
    creator.set(wert, wert === OHNE ? OHNE_LABEL.creator : e.creator?.name || OHNE_LABEL.creator);
    ansatzWerte(e).forEach(a => ansatz.set(a, a === OHNE ? OHNE_LABEL.ansatz : a));
  });
  const plattform = new Map((modell.posts || [])
    .filter(p => p.plattform)
    .map(p => [p.plattform, PLATTFORMEN[p.plattform]?.label || p.plattform]));
  return { creator: sortiert('creator', creator), ansatz: sortiert('ansatz', ansatz), plattform: sortiert('plattform', plattform) };
}

/**
 * Was die Tabelle zeigt und womit sie filtert. Werte aus einer anderen Ebene bleiben im Zustand
 * stehen, filtern hier aber nicht, damit ein Ebenenwechsel nicht ins Leere führt.
 * @returns {{ optionen: object, filter: object, aktiv: boolean }}
 */
export function filterLage(modell, filter) {
  const alle = filterOptionen(modell);
  const optionen = {};
  const wirksam = {};
  FILTER.forEach(({ key }) => {
    optionen[key] = alle[key].length >= 2 ? alle[key] : [];
    const bekannt = new Set(optionen[key].map(o => o.value));
    wirksam[key] = (filter?.[key] || []).filter(v => bekannt.has(v));
  });
  return { optionen, filter: wirksam, aktiv: FILTER.some(({ key }) => wirksam[key].length > 0) };
}

/** @param {{ einheit: object, post?: object|null }} zeile */
export function passtZumFilter(zeile, filter) {
  return FILTER.every(({ key }) => {
    const auswahl = filter?.[key] || [];
    return !auswahl.length || werteDerZeile(key, zeile).some(v => auswahl.includes(v));
  });
}

export function renderFilterLeiste({ optionen, filter }) {
  const felder = FILTER.filter(f => optionen[f.key].length).map(f => `
    <div class="auswertung-filter__feld" data-auswertung-filter="${f.key}">
      ${renderFilterSelect({
        id: `auswertung-${f.key}`,
        label: f.label,
        type: 'multiSelect',
        emptyLabel: f.emptyLabel,
        placeholder: f.placeholder,
        portal: true
      }, filter[f.key], optionen[f.key])}
    </div>`).join('');
  return felder ? `<div class="auswertung-filter">${felder}</div>` : '';
}

/** Neue Auswahl eines Filters aus seinem change-Event, null bei anderen Feldern. */
export function filterAusEvent(event) {
  if (event.target.closest?.('[data-select-search]')) return null;
  const feld = event.target.closest?.('[data-auswertung-filter]');
  const wrapper = feld?.querySelector('[data-filter-select]');
  return wrapper ? { key: feld.dataset.auswertungFilter, werte: readFilterSelectValues(wrapper) } : null;
}

/** Offene Panels hängen am body; beim Abbau der Ansicht mit weg. */
export function entferneFilterPanels() {
  document.querySelectorAll(`.filter-select__panel[data-filter-owner^="${PANEL_OWNER}"]`).forEach(p => p.remove());
}
