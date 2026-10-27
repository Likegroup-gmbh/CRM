// linienScope.js
// Aktive Linie einer Produktion (ADR 0045): Zustand, URL (?linie=), Merker pro
// Produktion und die Leiste zum schnellen Umschalten.
//
// Briefing, Produkte, Personas, Casting, Konzepte und Skripte zeigen immer genau
// eine Linie. Produktion, Verträge und Videos können zusätzlich alle Linien zeigen.

import { icon } from '../../core/icons/IconSystem.js';
import { ALTBESTAND_BADGE, zeigeAltbestandBadge } from './altbestandLinie.js';

export const ALLE = 'alle';
const ALLE_TABS = new Set(['produktion', 'vertraege', 'videos']);
const STORAGE_PREFIX = 'crm.linie.';

const esc = (t) => window.validatorSystem?.sanitizeHtml(String(t ?? '')) || String(t ?? '');

export function tabHatAlleLinien(tabId) {
  return ALLE_TABS.has(tabId);
}

function readStored(produktionId) {
  try {
    return window.localStorage?.getItem(`${STORAGE_PREFIX}${produktionId}`) || null;
  } catch {
    return null;
  }
}

function writeStored(produktionId, linieId) {
  try {
    if (linieId) window.localStorage?.setItem(`${STORAGE_PREFIX}${produktionId}`, linieId);
  } catch {
    // Merker ist nur Komfort
  }
}

/**
 * Startzustand: ?linie= (konkret oder "alle"), sonst zuletzt genutzte, sonst die erste.
 * @returns {{ linieId: string|null, alle: boolean }}
 */
export function resolveLinie(linien, produktionId, search = (typeof window !== 'undefined' ? window.location.search : '')) {
  const ids = (linien || []).map(l => l.id);
  if (!ids.length) return { linieId: null, alle: false };

  const fromUrl = new URLSearchParams(search).get('linie');
  const stored = produktionId ? readStored(produktionId) : null;
  const fallback = ids.includes(stored) ? stored : ids[0];

  if (fromUrl === ALLE) return { linieId: fallback, alle: true };
  if (ids.includes(fromUrl)) return { linieId: fromUrl, alle: false };
  return { linieId: fallback, alle: false };
}

/** Linie, die ein Tab tatsächlich lädt. null = alle Linien. */
export function effectiveLinie(detail, tabId) {
  if (!detail?.linien?.length) return null;
  if (tabHatAlleLinien(tabId) && detail.linieAlle) return null;
  return detail.linieId || null;
}

/** Linie für die Kooperationstabelle (Produktion-Tab bestimmt, ob Alle gilt). */
export function koopLinie(detail) {
  if (!detail?.linien?.length) return null;
  return detail.linieAlle ? null : (detail.linieId || null);
}

/** Hinweistext für leere Tabs: Entwurf legt Casting und Konzept erst beim Finalisieren an. */
export function leerHinweis(detail, tabId, fallback) {
  const id = effectiveLinie(detail, tabId);
  const linie = (detail?.linien || []).find(l => l.id === id);
  if (linie?.is_draft) return 'Entsteht beim Finalisieren des Briefings dieser Linie.';
  return fallback;
}

export function syncLinieQueryParam(linieId, alle) {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  const value = alle ? ALLE : linieId;
  if (value) url.searchParams.set('linie', value);
  else url.searchParams.delete('linie');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

const PRODUKTION_PFAD = /^\/produktion\/[^/]+\/?$/;

/**
 * Rücksprung-URL aus dem Briefing-Formular: liegt die Herkunft auf einer Produktion,
 * zeigt sie danach das Briefing-Tab mit diesem Briefing als Linie. Andere Herkünfte
 * bleiben unverändert.
 * @param {string} url - Herkunft (Pfad plus Query), meist backTarget(...)
 * @param {string} briefingId
 */
export function linieRueckkehr(url, briefingId) {
  if (!url || !briefingId) return url;
  let parsed;
  try {
    parsed = new URL(url, 'http://local');
  } catch {
    return url;
  }
  if (!PRODUKTION_PFAD.test(parsed.pathname)) return url;
  parsed.searchParams.set('tab', 'briefing');
  parsed.searchParams.set('linie', briefingId);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function rememberLinie(produktionId, linieId) {
  if (produktionId) writeStored(produktionId, linieId);
}

/** Aktive Auswahl im Dropdown für den aktuellen Tab. */
export function activeChip(detail, tabId) {
  if (tabHatAlleLinien(tabId) && detail.linieAlle) return ALLE;
  return detail.linieId || null;
}

const CHEVRON = `<span class="linien-switch__chevron">${icon('chevron-down')}</span>`;

/**
 * Linien-Dropdown, fest links in der Tab-Zeile (vor "Briefing").
 * Trigger zeigt die aktive Linie, das Menü listet alle Linien, bei Bedarf
 * "Alle Linien" und am Ende "+ Briefing".
 */
export function renderLinienSwitch(detail, tabId) {
  const linien = detail?.linien || [];
  if (!linien.length) return '';

  const active = activeChip(detail, tabId);
  const showAlle = tabHatAlleLinien(tabId) && linien.length > 1;
  const canCreate = window.canCreate?.('briefing') ?? false;
  const current = linien.find(l => l.id === active);
  const label = active === ALLE ? 'Alle Linien' : (current?.name || linien[0].name);

  const item = (value, text, { isActive, draft, altbestand } = {}) => `
    <button type="button" class="linien-switch__item${isActive ? ' active' : ''}" role="option" aria-selected="${isActive ? 'true' : 'false'}" data-linie="${esc(value)}" title="${esc(text)}">
      <span class="linien-switch__name">${esc(text)}</span>
      ${draft ? '<span class="linien-switch__badge">Entwurf</span>' : ''}
      ${altbestand ? `<span class="linien-switch__badge">${ALTBESTAND_BADGE}</span>` : ''}
    </button>`;

  const alle = showAlle ? item(ALLE, 'Alle Linien', { isActive: active === ALLE }) : '';
  const items = linien.map(l => item(l.id, l.name, { isActive: active === l.id, draft: l.is_draft, altbestand: zeigeAltbestandBadge(l) })).join('');
  const neu = canCreate
    ? '<button type="button" class="linien-switch__item linien-switch__item--neu" data-linie-neu title="Weiteres Briefing in dieser Produktion">+ Briefing</button>'
    : '';

  return `
    <div class="linien-switch" data-linien-switch>
      <button type="button" class="linien-switch__trigger" data-linien-toggle aria-haspopup="listbox" aria-expanded="false" title="Linie wechseln">
        <span class="linien-switch__label">${esc(label)}</span>
        ${CHEVRON}
      </button>
      <div class="linien-switch__menu" role="listbox" data-linien-menu>${alle}${items}${neu}</div>
    </div>`;
}

/**
 * Gleiches Dropdown für Listen innerhalb einer Linie (Casting-Listen, Konzepte).
 * Öffnen/Schließen läuft über denselben globalen Handler wie das Linien-Dropdown,
 * die Auswahl über bindListenSwitch (eigenes Attribut statt data-linie).
 * @param {{ items: Array<{id: string, name?: string}>, activeId: string, itemAttr: string, title?: string }} opts
 */
export function renderListenSwitch({ items, activeId, itemAttr, title = 'Liste wechseln' }) {
  const list = items || [];
  if (!list.length) return '';
  const current = list.find(i => i.id === activeId) || list[0];
  const label = (i) => i.name || 'Unbenannt';

  const rows = list.map(i => `
    <button type="button" class="linien-switch__item${i.id === current.id ? ' active' : ''}" role="option" aria-selected="${i.id === current.id ? 'true' : 'false'}" ${itemAttr}="${esc(i.id)}" title="${esc(label(i))}">
      <span class="linien-switch__name">${esc(label(i))}</span>
    </button>`).join('');

  return `
    <div class="linien-switch linien-switch--liste" data-linien-switch data-liste-switch>
      <button type="button" class="linien-switch__trigger" data-linien-toggle aria-haspopup="listbox" aria-expanded="false" title="${esc(title)}">
        <span class="linien-switch__label">${esc(label(current))}</span>
        ${CHEVRON}
      </button>
      <div class="linien-switch__menu" role="listbox" data-linien-menu>${rows}</div>
    </div>`;
}

const LISTE_SLOT = '[data-workflow-liste-slot]';

/** Dropdown aus der Tab-Zeile entfernen (Tab verlassen, leerer Tab). */
export function clearListenSwitch() {
  const slot = document.querySelector(LISTE_SLOT);
  if (slot) slot.innerHTML = '';
}

/**
 * Listen-Dropdown ganz rechts in die Tab-Zeile setzen. Gibt es keinen Slot,
 * kommt es als Zeile oben ins Pane (inline). html '' leert den Slot.
 * @returns {{ slot: Element|null, inline: string }}
 */
export function placeListenSwitch(html, fallbackClass) {
  const slot = document.querySelector(LISTE_SLOT);
  if (slot) {
    slot.innerHTML = html;
    return { slot, inline: '' };
  }
  return { slot: null, inline: html ? `<div class="${fallbackClass}">${html}</div>` : '' };
}

/**
 * Klick auf einen Eintrag eines renderListenSwitch-Dropdowns: Menü schließen,
 * Label und aktiven Eintrag nachziehen, dann onSelect(id) aufrufen.
 * Der Listener hängt am Dropdown selbst und verschwindet mit jedem Neurendern.
 */
export function bindListenSwitch(root, itemAttr, onSelect) {
  const switchEl = root?.querySelector('[data-liste-switch]');
  if (!switchEl) return;
  switchEl.addEventListener('click', (e) => {
    const item = e.target.closest(`[${itemAttr}]`);
    if (!item) return;
    e.preventDefault();
    closeLinienMenu();
    const id = item.getAttribute(itemAttr);
    const already = item.classList.contains('active');
    switchEl.querySelectorAll(`[${itemAttr}]`).forEach(el => {
      const on = el === item;
      el.classList.toggle('active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const labelEl = switchEl.querySelector('.linien-switch__label');
    if (labelEl) labelEl.textContent = item.querySelector('.linien-switch__name')?.textContent || '';
    if (!already) onSelect(id);
  });
}

/** Dropdown im DOM nachziehen (aktive Linie, "Alle Linien" je Tab). */
export function syncLinienSwitch(detail, tabId) {
  const current = document.querySelector('[data-linien-switch]:not([data-liste-switch])');
  if (!current) return;
  const holder = document.createElement('div');
  holder.innerHTML = renderLinienSwitch(detail, tabId);
  const next = holder.firstElementChild;
  if (next) current.replaceWith(next);
  else current.remove();
}

export function closeLinienMenu() {
  document.querySelectorAll('[data-linien-switch].open').forEach(el => {
    el.classList.remove('open');
    el.querySelector('[data-linien-toggle]')?.setAttribute('aria-expanded', 'false');
  });
}

/** Menü öffnen/schließen. Fixed positioniert, damit die scrollbare Tab-Zeile es nicht abschneidet. */
export function toggleLinienMenu(switchEl) {
  if (!switchEl) return;
  const wasOpen = switchEl.classList.contains('open');
  closeLinienMenu();
  if (wasOpen) return;
  const trigger = switchEl.querySelector('[data-linien-toggle]');
  const menu = switchEl.querySelector('[data-linien-menu]');
  const rect = trigger.getBoundingClientRect();
  // Am rechten Rand (Listen-Dropdown) nicht über den Viewport hinausragen
  const maxLeft = window.innerWidth - menu.offsetWidth - 8;
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.max(8, Math.min(rect.left, maxLeft))}px`;
  switchEl.classList.add('open');
  trigger.setAttribute('aria-expanded', 'true');
}
