// breadcrumbTrail.js
// Klickpfad der Breadcrumb: die Ebenen, über die man auf die aktuelle Seite kam.
// Liegt in history.state.trail und übersteht so Reload, Zurück und Vor.
// Neuer Tab oder geteilter Link: kein Pfad, die Seite zeigt den offiziellen Weg.

export const MAX_TRAIL = 12;
export const MAX_VISIBLE = 6;
const PLACEHOLDER = '...';

export function pathOf(url) {
  if (!url || typeof url !== 'string') return '';
  const path = url.split(/[?#]/)[0];
  if (!path) return '';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
}

export function parseRoute(url) {
  const path = pathOf(url);
  const [segment = '', id = null, action = null] = path
    .replace(/^\/admin(?=\/)/, '')
    .split('/')
    .filter(Boolean);
  return { path, segment, id, action };
}

function snapshot(crumbs, currentUrl) {
  const list = (crumbs || [])
    .filter((crumb) => crumb && crumb.label)
    .map((crumb) => ({ label: String(crumb.label), url: crumb.url && crumb.url !== '#' ? crumb.url : null }));
  if (list.length && currentUrl) list[list.length - 1].url = currentUrl;
  return list;
}

// Anlegen/Bearbeiten: der Pfad muss die Herkunft halten, sonst findet
// Speichern/Abbrechen nicht dorthin zurück.
export function isFormRoute(url) {
  const parts = pathOf(url).replace(/^\/admin(?=\/)/, '').split('/').filter(Boolean);
  if (parts[0] === 'projekt-erstellen') return true;
  return parts.slice(1).some((part) => part === 'new' || part === 'edit');
}

// Pfad für das Ziel einer Navigation.
// currentTrail/currentCrumbs/currentUrl beschreiben die Seite, die man verlässt.
export function nextTrail({ currentTrail = [], currentCrumbs = [], currentUrl = '', targetRoute }) {
  const target = parseRoute(targetRoute);
  const prev = parseRoute(currentUrl);
  const form = isFormRoute(targetRoute);

  if (!target.id && !form) return [];
  if (target.path === prev.path) return currentTrail;

  const crumbs = snapshot(currentCrumbs, currentUrl);
  const hit = crumbs.findIndex((crumb) => pathOf(crumb.url) === target.path);
  if (hit !== -1) return crumbs.slice(0, hit);

  if (!form && target.segment === prev.segment) {
    if (!prev.id) return [];
    if (!target.action && !prev.action && target.id !== prev.id) return currentTrail;
  }
  return crumbs.slice(-MAX_TRAIL);
}

// Pfad + offizielle Kette der Seite. Setzt die offizielle Kette dort fort, wo
// der Pfad endet (Kampagne → Produktion, Unternehmen → Persona-Form), sonst
// hängt nur das Blatt am Pfad.
export function composeCrumbs(trail, official) {
  const leaf = official?.[official.length - 1];
  if (!trail?.length) return official || [];
  const parents = trail.map((crumb) => ({ label: crumb.label, url: crumb.url, clickable: Boolean(crumb.url) }));
  if (!leaf) return parents;

  const lastPath = pathOf(trail[trail.length - 1].url);
  const joinAt = lastPath ? official.findIndex((crumb) => pathOf(crumb.url) === lastPath) : -1;
  if (joinAt !== -1 && joinAt < official.length - 1) {
    return [...parents, ...official.slice(joinAt + 1)];
  }
  return [...parents, leaf];
}

// Zu lange Ketten: erster Crumb, "…", die letzten Ebenen.
export function collapse(crumbs, max = MAX_VISIBLE) {
  if (!crumbs || crumbs.length <= max) return { visible: crumbs || [], hidden: [] };
  const tail = max - 2;
  return {
    visible: [crumbs[0], { collapsed: true }, ...crumbs.slice(-tail)],
    hidden: crumbs.slice(1, crumbs.length - tail),
  };
}

export function currentTrail() {
  if (typeof window === 'undefined') return [];
  const trail = window.history?.state?.trail;
  return Array.isArray(trail) ? trail : [];
}

// Pfad des aktuellen History-Eintrags, sofern er zur Route gehört.
export function trailForRoute(route) {
  const state = typeof window !== 'undefined' ? window.history?.state : null;
  if (!state || !Array.isArray(state.trail)) return [];
  if (state.route && pathOf(state.route) !== pathOf(route)) return [];
  return state.trail;
}

// URL ersetzen, ohne Pfad und Scroll-State im History-Eintrag zu verlieren.
export function replaceRoute(url) {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  window.history.replaceState({ ...(window.history.state || {}), route: url }, '', url);
}

// Rückweg für Abbrechen/Speichern: die Ebene, von der man kam.
export function backTarget(fallback) {
  const trail = currentTrail();
  return trail[trail.length - 1]?.url || fallback;
}

// Nach Speichern/Abbrechen zurück zur Herkunft. Ersetzt den History-Eintrag,
// sonst landet Browser-Zurück wieder im ausgefüllten Formular.
// Außerhalb einer Formular-Route (Inline-Bearbeiten im Detail) zählt der
// Fallback: die letzte Pfad-Ebene wäre dort "Detail verlassen".
export function navigateBack(fallback) {
  if (typeof window === 'undefined') return undefined;
  return returnTo(isFormRoute(window.location.pathname) ? backTarget(fallback) : fallback);
}

// Wie navigateBack, aber mit fertigem Ziel (Seiten, die selbst Formular sind).
export function returnTo(url) {
  if (typeof window === 'undefined') return undefined;
  const go = window.navigateReplace || window.navigateTo;
  return go?.(url);
}

// Nächste Produktion im Pfad (z. B. Kooperation aus der Produktion angelegt).
export function trailProduktion() {
  const trail = currentTrail();
  for (let i = trail.length - 1; i >= 0; i--) {
    const { segment, id, action } = parseRoute(trail[i].url);
    if (segment === 'produktion' && id && !action) {
      return { produktionId: id, url: trail[i].url };
    }
  }
  return null;
}

export function createLabelCache(max = 200) {
  const map = new Map();
  return {
    get(url) {
      return map.get(pathOf(url)) || null;
    },
    set(url, label) {
      const key = pathOf(url);
      // Nur Entitäts-Pfade: Ordner-Crumbs teilen sich den Listen-Pfad mit anderen Labels.
      if (!label || label === PLACEHOLDER || !parseRoute(key).id) return;
      map.delete(key);
      map.set(key, String(label));
      if (map.size > max) map.delete(map.keys().next().value);
    },
  };
}
