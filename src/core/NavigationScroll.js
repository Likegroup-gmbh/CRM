// NavigationScroll.js (ES6-Modul)
// Merkt sich die Scrollposition je Route und stellt sie nach einer Navigation
// wieder her. Gescrollt wird in dieser App immer .main-wrapper (#dashboard-content),
// nicht das Fenster.
//
// Zwei Quellen, weil "Zurueck" in LikeBase zwei Formen hat:
//   - history.state    fuer Browser-/Trackpad-Zurueck (uebersteht auch einen Reload)
//   - sessionStorage   fuer In-App-Rueckwege per navigateTo('/liste')
//
// Zusaetzlich wird die angeklickte Zeile bzw. Karte als Anker gespeichert. Bei
// Listen mit Infinite Scroll (Creator-Grid) reicht ein Pixelwert nicht: der Eintrag
// muss erst nachgeladen werden, bevor die Position ueberhaupt erreichbar ist.

// Obergrenze fuer Nachladeversuche, damit eine kaputte Liste nicht endlos laedt.
const MAX_LOAD_MORE = 20;
// Leerlaeufe durch parallel laufende Chunks ueberbruecken, bevor wir aufgeben.
const IDLE_RETRIES = 2;
// Ist der Anker weg (z. B. geloescht), aber die Pixelposition erreichbar: aufhoeren.
const ANCHOR_GRACE_CHUNKS = 4;
const STORAGE_KEY = 'likebase-nav-scroll';
// Elemente, die eine Entity-ID tragen und Layout haben - Reihenfolge egal,
// die Auswahl entscheidet die Sichtbarkeit.
const ANCHOR_ROLES = ['.creator-card', 'tr'];

const scrollPositions = new Map();
let watchingScroll = false;

function emptyScroll() {
  return { top: 0, anchorId: null };
}

function toScroll(value) {
  if (!value) return emptyScroll();
  if (typeof value === 'number') return { top: value, anchorId: null };
  return {
    top: Number(value.top) || 0,
    anchorId: value.anchorId || null
  };
}

function hydrateFromSession() {
  if (scrollPositions.size > 0) return;
  try {
    const entries = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (!Array.isArray(entries)) return;
    for (const [key, value] of entries) {
      scrollPositions.set(key, toScroll(value));
    }
  } catch {
    // sessionStorage nicht verfuegbar oder unlesbar
  }
}

function persistToSession() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...scrollPositions]));
  } catch {
    // sessionStorage nicht verfuegbar / voll
  }
}

hydrateFromSession();

export function getScrollContainer() {
  return document.querySelector('.main-wrapper')
    || document.getElementById('dashboard-content')
    || document.scrollingElement;
}

export function getScrollTop() {
  return getScrollContainer()?.scrollTop || 0;
}

function applyTop(top) {
  const el = getScrollContainer();
  if (el) el.scrollTop = top;
}

export function currentHistoryRoute() {
  return `${window.location.pathname}${window.location.search}`;
}

export function normalizeRoute(route) {
  if (!route) return currentHistoryRoute();
  const url = String(route).startsWith('/') ? String(route) : `/${route}`;
  return url.split('#')[0];
}

export function enableManualScrollRestoration() {
  if (typeof window === 'undefined' || !window.history) return;
  try {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  } catch {
    // jsdom / aeltere Browser ohne Unterstuetzung
  }

  if (watchingScroll || typeof document === 'undefined') return;
  watchingScroll = true;
  // Capture, weil Scroll-Events des Containers nicht bis document hochblubbern.
  document.addEventListener('scroll', () => {
    if (getScrollTop() > 0) rememberScrollForRoute();
  }, { capture: true, passive: true });

  document.addEventListener('click', (e) => {
    const node = e.target.closest?.('.creator-card[data-id], tr[data-id]');
    if (node?.dataset?.id) {
      rememberScrollForRoute(currentHistoryRoute(), { anchorId: node.dataset.id });
    }
  }, true);
}

/** @param {{anchorId?: string}} [extras] ID der angeklickten Zeile/Karte */
export function rememberScrollForRoute(route = currentHistoryRoute(), extras = {}) {
  hydrateFromSession();
  const key = normalizeRoute(route);
  const previous = toScroll(scrollPositions.get(key));
  const next = {
    top: getScrollTop(),
    anchorId: extras.anchorId ?? previous.anchorId
  };
  scrollPositions.set(key, next);
  persistToSession();
  return next;
}

export function savedScrollFor(route) {
  hydrateFromSession();
  return toScroll(scrollPositions.get(normalizeRoute(route)));
}

export function historyScrollFor(route) {
  const state = window.history?.state;
  if (!state) return emptyScroll();
  const stateRoute = state.route ? normalizeRoute(state.route) : currentHistoryRoute();
  if (stateRoute !== normalizeRoute(route)) return emptyScroll();
  return toScroll({ top: state.scrollTop, anchorId: state.anchorId });
}

export function mergeScrolls(...scrolls) {
  const merged = emptyScroll();
  for (const scroll of scrolls) {
    const s = toScroll(scroll);
    if (s.top) merged.top = s.top;
    if (s.anchorId) merged.anchorId = s.anchorId;
  }
  return merged;
}

export function clearSavedScrollPositions() {
  scrollPositions.clear();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function saveScrollToCurrentHistory() {
  if (!window.history?.replaceState) return;
  const route = window.history.state?.route || currentHistoryRoute();
  const anchorId = savedScrollFor(route).anchorId;
  try {
    window.history.replaceState(
      { ...(window.history.state || {}), route, scrollTop: getScrollTop(), anchorId },
      '',
      window.location.href
    );
  } catch (err) {
    console.warn('⚠️ Scroll-Position konnte nicht gespeichert werden:', err?.message);
  }
}

function waitForFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/**
 * Liste und Grid liegen gleichzeitig im DOM, eine der beiden ist display:none.
 * Deshalb gewinnt das sichtbare Element, nicht das erste im Dokument.
 */
function findAnchorNode(anchorId) {
  if (!anchorId) return null;
  const id = String(anchorId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const candidates = document.querySelectorAll(
    ANCHOR_ROLES.map((role) => `${role}[data-id="${id}"]`).join(', ')
  );
  for (const node of candidates) {
    if (node.offsetParent !== null) return node;
  }
  return candidates[0] || null;
}

/** Richtet den Anker mittig im Scroll-Container aus. */
function centerNode(node) {
  const container = getScrollContainer();
  if (!node || !container) return;
  const nodeRect = node.getBoundingClientRect?.();
  if (!nodeRect?.height) return;
  const containerRect = container.getBoundingClientRect?.() || { top: 0 };
  const offset = nodeRect.top - containerRect.top + (container.scrollTop || 0);
  container.scrollTop = Math.max(0, offset - (container.clientHeight || 0) / 2 + nodeRect.height / 2);
}

export async function applyScrollAfterNavigation({ top = 0, anchorId = null, loadMore } = {}) {
  await waitForFrame();

  const target = Number(top) || 0;
  if (!anchorId && target <= 0) {
    applyTop(0);
    return;
  }

  const el = getScrollContainer();
  const anchorReady = () => !!findAnchorNode(anchorId);
  const canReachTarget = () => !el || target <= 0
    || el.scrollHeight - el.clientHeight >= target;

  let attempts = 0;
  let idleAttempts = 0;
  while (attempts < MAX_LOAD_MORE && typeof loadMore === 'function') {
    if (anchorId ? anchorReady() : canReachTarget()) break;
    if (anchorId && canReachTarget() && attempts >= ANCHOR_GRACE_CHUNKS) break;

    const grew = await loadMore();
    attempts += 1;
    // Ein parallel laufender Chunk kann dazu fuehren, dass dieser Aufruf nichts
    // liefert, obwohl die Liste weitergeht. Erst nach mehreren Leerlaeufen aufgeben.
    idleAttempts = grew ? 0 : idleAttempts + 1;
    if (idleAttempts > IDLE_RETRIES) break;
    await waitForFrame();
  }

  // Erst der Pixelwert, dann die Feinausrichtung: scrollIntoView bewegt den
  // .main-wrapper nicht zuverlaessig, weil der Grid-Wrapper overflow:hidden hat.
  const node = findAnchorNode(anchorId);
  applyTop(target);
  centerNode(node);
  requestAnimationFrame(() => {
    applyTop(target);
    centerNode(node);
  });
}
