// produktionTabDetail.js
// Was in einem Tab der Produktion offen ist (ADR 0079): Skript, Produkt, Persona oder
// die gewählte Konzept- bzw. Casting-Liste. Der Zustand liegt am Detail (detail.offen)
// und bleibt beim Tab-Wechsel erhalten; die URL trägt ihn nur im aktiven Tab.
// Solange eine Ansicht die Liste ersetzt, steht am Body data-detail-offen="<tab>".

import { replaceRoute } from '../../core/breadcrumbTrail.js';
import { effectiveLinie } from './linienScope.js';
import { flowUrl, TAB_PARAM } from './produktionFlowZiele.js';

export function offeneId(detail, tab) {
  return detail?.offen?.[tab] || null;
}

/** Der Tab zeigt gerade eine Ansicht (Skript, Produkt, Persona) statt der Liste. */
export function detailOffen(detail, tab = detail?.activeWorkflowTab) {
  return Boolean(TAB_PARAM[tab]?.ansicht && detail?.activeWorkflowTab === tab && offeneId(detail, tab));
}

/** Parameter des Tabs setzen (nur im aktiven Tab der URL) oder entfernen. */
export function syncDetailParam(tab, id) {
  const param = TAB_PARAM[tab]?.param;
  if (!param || typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (id && url.searchParams.get('tab') !== tab) return;
  if ((url.searchParams.get(param) || null) === (id || null)) return;
  if (id) url.searchParams.set(param, id);
  else url.searchParams.delete(param);
  replaceRoute(`${url.pathname}${url.search}${url.hash}`);
}

export function setzeOffen(detail, tab, id, { url = true } = {}) {
  if (!TAB_PARAM[tab]) return;
  detail.offen = { ...(detail.offen || {}), [tab]: id || null };
  if (url) syncDetailParam(tab, id);
}

/** Linie gewechselt: alles schließen, die Tabs zeigen die Listen der neuen Linie. */
export function vergissAlle(detail) {
  const offen = detail.offen || {};
  detail.offen = {};
  for (const tab of Object.keys(offen)) {
    if (offen[tab]) syncDetailParam(tab, null);
  }
}

/** Startzustand aus der URL (Deep-Link, Reload). */
export function offenAusUrl(search = (typeof window !== 'undefined' ? window.location.search : '')) {
  const params = new URLSearchParams(search);
  const offen = {};
  for (const [tab, { param }] of Object.entries(TAB_PARAM)) {
    const id = params.get(param);
    if (id) offen[tab] = id;
  }
  return offen;
}

/** Adresse eines Tabs dieser Produktion in seiner Linie; ohne id die Liste. */
export function tabUrl(detail, tab, id = null) {
  return flowUrl({ produktionId: detail.produktionId, tab, linieId: effectiveLinie(detail, tab), id });
}

export function markiereAnsicht(tab, offen) {
  const body = typeof document !== 'undefined' && document.querySelector('.kampagne-detail-body[data-workflow]');
  if (!body) return;
  if (offen) body.dataset.detailOffen = tab;
  else if (body.dataset.detailOffen === tab) delete body.dataset.detailOffen;
}
