// Verknuepfungs-Dropdown: ab zwei Verknuepfungen in einer Zelle ein Chip
// "4 Produkte" statt des Pill-Stapels. Klick oeffnet ein Popover am body
// (position: fixed), damit overflow von Tabelle und Scroll-Container es nicht
// abschneidet. Die Pills liegen versteckt in der Zelle und werden beim Oeffnen
// geklont; ihre Navigation laeuft ueber den Handler in tableVerknuepfungen.js.

import { entityIcon } from '../icons/entityIcons.js';
import { icon } from '../icons/IconSystem.js';
import { escapeHtml } from '../format.js';
import { playMenu, closeMenu, discardMenu } from '../animation/menu.js';

const PLURAL = {
  produkt: 'Produkte',
  briefing: 'Briefings',
  persona: 'Personas',
  casting: 'Castings',
  konzept: 'Konzepte',
  skript: 'Skripte',
  vertrag: 'Verträge',
  creator: 'Creator',
  kampagne: 'Kampagnen',
  video: 'Videos'
};
const GEMISCHT = 'Verknüpfungen';
const RAND = 8;
const ABSTAND = 4;

let offen = null;
let gebunden = false;

/** "3 Produkte"; gemischte oder unbekannte Kinds werden zu "3 Verknüpfungen". */
export function verknuepfungChipLabel(kinds, anzahl, label) {
  const einzig = [...new Set(kinds || [])];
  const nomen = label || (einzig.length === 1 && PLURAL[einzig[0]]) || GEMISCHT;
  return `${anzahl} ${nomen}`;
}

/**
 * @param {string[]} pillsHtml  Fertige Pills aus renderVerknuepfungPill
 * @param {object}   [opts]
 * @param {string[]} [opts.kinds] Kind je Pill, bestimmt Icon und Plural
 * @param {string}   [opts.label] Eigenes Nomen statt des Plurals ("2 Linien")
 */
export function renderVerknuepfungDropdown(pillsHtml, { kinds = [], label } = {}) {
  const pills = (pillsHtml || []).filter(Boolean);
  if (!pills.length) return '-';
  ensureVerknuepfungDropdowns();
  const einzig = [...new Set(kinds)];
  const chipIcon = einzig.length === 1
    ? entityIcon(einzig[0], { className: 'verknuepfung-pill__icon' })
    : icon('link', { className: 'verknuepfung-pill__icon' });
  const text = verknuepfungChipLabel(kinds, pills.length, label);
  // table-link: die Zeilen-Handler der Listen lassen Klicks auf .table-link aus.
  return '<div class="verknuepfung-dropdown">'
    + '<button type="button" class="table-link verknuepfung-pill verknuepfung-chip" aria-haspopup="true" aria-expanded="false">'
    + `${chipIcon}<span class="verknuepfung-pill__label">${escapeHtml(text)}</span>`
    + icon('chevron-down', { className: 'verknuepfung-chip__chevron' })
    + '</button>'
    + `<div class="verknuepfung-menu" hidden>${pills.join('')}</div>`
    + '</div>';
}

function positionieren(portal, rect) {
  const breite = Math.min(portal.offsetWidth || 240, window.innerWidth - RAND * 2);
  const links = Math.max(RAND, Math.min(rect.left, window.innerWidth - breite - RAND));
  const hoehe = portal.offsetHeight;
  const platzUnten = window.innerHeight - rect.bottom - ABSTAND - RAND;
  const platzOben = rect.top - ABSTAND - RAND;
  const nachOben = hoehe > platzUnten && platzOben > platzUnten;
  const platz = Math.max(0, nachOben ? platzOben : platzUnten);

  portal.style.left = `${links}px`;
  portal.style.top = `${nachOben ? rect.top - ABSTAND - Math.min(hoehe, platz) : rect.bottom + ABSTAND}px`;
  portal.style.transformOrigin = nachOben ? 'bottom left' : 'top left';
  if (hoehe > platz) portal.style.maxHeight = `${platz}px`;
}

function oeffnen(chip, { fokus = false } = {}) {
  const menu = chip.nextElementSibling;
  if (!menu?.classList.contains('verknuepfung-menu')) return;

  const portal = document.createElement('div');
  portal.className = 'verknuepfung-popover';
  portal.innerHTML = menu.innerHTML;
  document.body.appendChild(portal);
  positionieren(portal, chip.getBoundingClientRect());

  portal.dataset.menuState = 'open';
  playMenu(portal, true);
  chip.setAttribute('aria-expanded', 'true');
  offen = { portal, chip };
  if (fokus) portal.querySelector('a')?.focus();
}

export function schliesseVerknuepfungDropdown({ sofort = false, fokusZurueck = false } = {}) {
  if (!offen) return;
  const { portal, chip } = offen;
  offen = null;
  chip.setAttribute('aria-expanded', 'false');
  if (sofort) discardMenu(portal);
  else closeMenu(portal);
  if (fokusZurueck && chip.isConnected) chip.focus();
}

function onClick(event) {
  const chip = event.target.closest?.('.verknuepfung-chip');
  if (chip) {
    event.preventDefault();
    const warOffen = offen?.chip === chip;
    schliesseVerknuepfungDropdown({ sofort: !warOffen });
    // detail 0: per Tastatur ausgeloest, dann Fokus in die Liste
    if (!warOffen) oeffnen(chip, { fokus: event.detail === 0 });
    return;
  }
  if (!offen) return;
  const link = event.target.closest?.('a');
  if (offen.portal.contains(event.target) && !link) return;
  schliesseVerknuepfungDropdown({ sofort: Boolean(link) });
}

function onKeydown(event) {
  if (event.key === 'Escape' && offen) schliesseVerknuepfungDropdown({ fokusZurueck: true });
}

function onScroll(event) {
  if (!offen || offen.portal.contains(event.target)) return;
  schliesseVerknuepfungDropdown({ sofort: true });
}

function sofortZu() {
  schliesseVerknuepfungDropdown({ sofort: true });
}

export function ensureVerknuepfungDropdowns() {
  if (gebunden || typeof document === 'undefined') return;
  gebunden = true;
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('scroll', onScroll, { capture: true });
  window.addEventListener('resize', sofortZu);
  window.addEventListener('popstate', sofortZu);
}
