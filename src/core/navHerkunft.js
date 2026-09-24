// navHerkunft.js
// Herkunft einer Seite: linke Nav oder Kampagne → Produktion.
// Steckt im Query `von`, damit Breadcrumb und Rückweg einen Reload überleben.

import { KampagneUtils } from '../modules/kampagne/KampagneUtils.js';
import { loadProduktion } from '../modules/produktion/ProduktionService.js';

const ORIGIN = 'http://herkunft.local';
const PATH_RE = /^\/(produktion|kampagne)\/[^/?#]+$/;
const TAB_RE = /^[a-z0-9_-]+$/i;

export function isAllowedHerkunft(value) {
  if (typeof value !== 'string') return false;
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  if (value.includes('\\') || value.includes('://')) return false;

  let url;
  try {
    url = new URL(value, ORIGIN);
  } catch {
    return false;
  }
  if (url.origin !== ORIGIN) return false;
  if (!PATH_RE.test(url.pathname)) return false;

  const keys = [...url.searchParams.keys()];
  if (url.pathname.startsWith('/kampagne/')) return keys.length === 0;
  if (keys.length === 0) return true;
  if (keys.length !== 1 || keys[0] !== 'tab') return false;
  return TAB_RE.test(url.searchParams.get('tab') || '');
}

function canonicalHerkunft(value) {
  const url = new URL(value, ORIGIN);
  if (url.pathname.startsWith('/kampagne/')) return url.pathname;
  const tab = url.searchParams.get('tab');
  if (tab && TAB_RE.test(tab)) return `${url.pathname}?tab=${encodeURIComponent(tab)}`;
  return url.pathname;
}

export function readHerkunft(search = (typeof window !== 'undefined' ? window.location.search : '')) {
  const params = new URLSearchParams(search || '');
  for (const key of ['von', 'returnTo']) {
    const raw = params.get(key);
    if (raw && isAllowedHerkunft(raw)) return canonicalHerkunft(raw);
  }
  return null;
}

export function parseProduktionHerkunft(von) {
  if (!von || !isAllowedHerkunft(von)) return null;
  const url = new URL(von, ORIGIN);
  const match = url.pathname.match(/^\/produktion\/([^/]+)$/);
  if (!match) return null;
  const tab = url.searchParams.get('tab');
  return {
    produktionId: match[1],
    tab: tab && TAB_RE.test(tab) ? tab : null
  };
}

export function produktionReturnPath(produktionId, tab) {
  if (!produktionId || /[/?#\\]/.test(String(produktionId))) return null;
  const path = `/produktion/${produktionId}`;
  if (!tab || !TAB_RE.test(tab)) return path;
  return `${path}?tab=${encodeURIComponent(tab)}`;
}

export function captureHerkunft(loc = (typeof window !== 'undefined' ? window.location : { pathname: '', search: '' })) {
  const path = loc.pathname || '';
  const match = path.match(/^\/produktion\/([^/]+)$/);
  if (match) {
    const tab = new URLSearchParams(loc.search || '').get('tab');
    return produktionReturnPath(match[1], tab);
  }
  return readHerkunft(loc.search || '');
}

export function withHerkunft(route, herkunft = captureHerkunft()) {
  if (!herkunft || !isAllowedHerkunft(herkunft)) return route;
  const qIndex = route.indexOf('?');
  const path = qIndex === -1 ? route : route.slice(0, qIndex);
  const params = new URLSearchParams(qIndex === -1 ? '' : route.slice(qIndex + 1));
  params.set('von', canonicalHerkunft(herkunft));
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function withProduktionHerkunft(route, produktionId, tab) {
  if (!produktionId) return route;
  const herkunft = produktionReturnPath(produktionId, tab);
  if (!herkunft) return route;
  return withHerkunft(route, herkunft);
}

export function backTarget(fallback, search) {
  return readHerkunft(search) || fallback;
}

export function produktionCrumbList({
  kampagneId,
  kampagneName,
  produktionId,
  produktionTitle,
  tab = null,
  leafLabel = null
}) {
  const crumbs = [
    { label: 'Kampagnen', url: '/kampagne', clickable: true },
    {
      label: kampagneName || 'Kampagne',
      url: kampagneId ? `/kampagne/${kampagneId}` : '/kampagne',
      clickable: true
    },
    {
      label: produktionTitle || 'Produktion',
      url: produktionReturnPath(produktionId, tab) || '/kampagne',
      clickable: Boolean(leafLabel)
    }
  ];
  if (leafLabel) crumbs.push({ label: leafLabel, clickable: false });
  return crumbs;
}

export async function produktionCrumbs(produktionId, tab, { leafLabel = null } = {}) {
  if (!produktionId || !window.supabase) return null;
  const produktion = await loadProduktion(produktionId);
  if (!produktion?.kampagne_id) return null;

  const { data, error } = await window.supabase
    .from('kampagne')
    .select('id, eigener_name, kampagnenname')
    .eq('id', produktion.kampagne_id)
    .maybeSingle();
  if (error) return null;

  return produktionCrumbList({
    kampagneId: produktion.kampagne_id,
    kampagneName: KampagneUtils.getDisplayName(data),
    produktionId,
    produktionTitle: produktion.briefing?.aktivierung_name || produktion.name || 'Produktion',
    tab,
    leafLabel
  });
}

export async function leafCrumbs(standaloneCrumbs, leafLabel) {
  const parsed = parseProduktionHerkunft(readHerkunft());
  if (!parsed) return standaloneCrumbs;
  try {
    const crumbs = await produktionCrumbs(parsed.produktionId, parsed.tab, { leafLabel });
    return crumbs || standaloneCrumbs;
  } catch {
    return standaloneCrumbs;
  }
}

export async function showProduktionLeaf(leafLabel, editButton = null) {
  const parsed = parseProduktionHerkunft(readHerkunft());
  if (!parsed || !window.breadcrumbSystem?.updateBreadcrumb) return false;
  try {
    const crumbs = await produktionCrumbs(parsed.produktionId, parsed.tab, { leafLabel });
    if (!crumbs) return false;
    window.breadcrumbSystem.updateBreadcrumb(crumbs, editButton, { switcher: null });
    return true;
  } catch {
    return false;
  }
}
