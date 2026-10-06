// linienScope.js
// Aktive Linie einer Produktion (ADR 0045): Zustand, URL (?linie=), Merker pro
// Produktion und die Leiste zum schnellen Umschalten.
//
// Briefing, Produkte, Personas, Casting, Konzepte und Skripte zeigen immer genau
// eine Linie. Produktion, Verträge und Videos können zusätzlich alle Linien zeigen.

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

export function rememberLinie(produktionId, linieId) {
  if (produktionId) writeStored(produktionId, linieId);
}

/** Aktiver Chip in der Leiste für den aktuellen Tab. */
export function activeChip(detail, tabId) {
  if (tabHatAlleLinien(tabId) && detail.linieAlle) return ALLE;
  return detail.linieId || null;
}

export function renderLinienBar(detail, tabId) {
  const linien = detail?.linien || [];
  if (!linien.length) return '';

  const active = activeChip(detail, tabId);
  const showAlle = tabHatAlleLinien(tabId) && linien.length > 1;
  const canCreate = window.canCreate?.('briefing') ?? false;

  const alleChip = showAlle
    ? `<button type="button" class="linien-chip${active === ALLE ? ' active' : ''}" data-linie="${ALLE}">Alle Linien</button>`
    : '';
  const chips = linien.map(linie => `
    <button type="button" class="linien-chip${active === linie.id ? ' active' : ''}" data-linie="${esc(linie.id)}" title="${esc(linie.name)}">
      <span class="linien-chip__name">${esc(linie.name)}</span>
      ${linie.is_draft ? '<span class="linien-chip__badge">Entwurf</span>' : ''}
    </button>`).join('');
  const neu = canCreate
    ? '<button type="button" class="linien-chip linien-chip--neu" data-linie-neu title="Weiteres Briefing in dieser Produktion">+ Briefing</button>'
    : '';

  return `
    <div class="linien-bar" data-linien-bar>
      <span class="linien-bar__label">Linie</span>
      <div class="linien-bar__chips">${alleChip}${chips}${neu}</div>
    </div>`;
}

/** Leiste im DOM nachziehen (aktiver Chip, Alle-Chip je Tab). */
export function syncLinienBar(detail, tabId) {
  const bar = document.querySelector('[data-linien-bar]');
  if (!bar) return;
  const holder = document.createElement('div');
  holder.innerHTML = renderLinienBar(detail, tabId);
  const next = holder.firstElementChild;
  if (next) bar.replaceWith(next);
}
