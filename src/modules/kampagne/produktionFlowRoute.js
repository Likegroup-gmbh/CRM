// produktionFlowRoute.js
// Navigation innerhalb der Produktion ohne Neuaufbau (ADR 0079). Der Router fragt die
// Produktion zuerst (handleRouteInPlace): Adressen dieser Produktion mit ?tab= bedient
// sie selbst, Entity-Adressen (/briefing/:id, /produkt/:id, /skripte/:id …) übersetzt
// sie in ihren Tab, wenn der Datensatz zu einer ihrer Linien gehört. Alles andere,
// Gäste und Tabs ohne Recht gehen an den Router.

import { pathOf, replaceRoute } from '../../core/breadcrumbTrail.js';
import { ALLE, tabHatAlleLinien } from './linienScope.js';
import { activateWorkflowTab, getVisibleWorkflowTabs, remountWorkflowPane } from './KampagneDetailWorkflow.js';
import { erkenneZiel, flowUrl, FOKUS_PARAM, hatAbfrage, linieAbfragen, linieSync, TAB_PARAM } from './produktionFlowZiele.js';
import { offeneId, setzeOffen, tabUrl } from './produktionTabDetail.js';
import { fokussiere } from './produktionFlowFokus.js';

function imFlow(detail) {
  return detail.mode === 'workflow' && Boolean(detail._isMounted && detail.produktionId) && !window.guestShare;
}

function tabSichtbar(tab) {
  return getVisibleWorkflowTabs().some(t => t.id === tab);
}

/** Linienwechsel für das Ziel. null = Linie unbekannt, dann übernimmt der Router. */
function linienWechsel(detail, tab, linie) {
  if (!linie) return { noetig: false };
  let wechsel;
  if (linie === ALLE) {
    if (!tabHatAlleLinien(tab)) return null;
    wechsel = { noetig: !detail.linieAlle, wert: ALLE };
  } else {
    if (!(detail.linien || []).some(l => l.id === linie)) return null;
    const alleTab = tabHatAlleLinien(tab);
    // Tabs ohne "Alle Linien": die Kooperationstabelle darf auf Alle bleiben
    wechsel = { noetig: linie !== detail.linieId || (alleTab && detail.linieAlle), wert: linie, alleBehalten: !alleTab };
  }
  if (wechsel.noetig && typeof detail.switchLinie !== 'function') return null;
  return wechsel;
}

/** Tab zeigen und, wo der Tab etwas offen hält, das Ziel öffnen. */
function anzeigen(detail, tab, id) {
  const spec = TAB_PARAM[tab];
  // Ohne id behält eine Auswahl (Konzept, Casting) ihren Stand, eine Ansicht zeigt die Liste
  const merkt = Boolean(spec && (id || spec.ansicht));
  const gleich = !merkt || offeneId(detail, tab) === (id || null);
  if (merkt) setzeOffen(detail, tab, id);
  if (detail.activeWorkflowTab !== tab) {
    void activateWorkflowTab(detail, tab, { syncUrl: false });
  } else if (!gleich) {
    void remountWorkflowPane(detail, tab);
  }
}

function zeige(detail, { tab, id, wechsel, fokus = null }, { push, adresse }) {
  if (push) window.history.pushState({ ...(window.history.state || {}), route: adresse }, '', adresse);
  const zeigen = () => {
    anzeigen(detail, tab, id);
    if (fokus) fokussiere(detail, tab, fokus);
  };
  if (!wechsel.noetig) {
    zeigen();
    return;
  }
  // Der Linienwechsel schließt alles Offene, danach öffnet das Ziel
  void (async () => {
    try {
      await detail.switchLinie(wechsel.wert, { alleBehalten: wechsel.alleBehalten });
    } catch (error) {
      console.error('❌ PRODUKTION: Linienwechsel im Flow fehlgeschlagen:', error);
      return;
    }
    if (detail._isMounted) zeigen();
  })();
}

/** /produktion/<diese>?tab=…: nur tab, linie, fokus und der Parameter des Tabs, sonst Router. */
function produktionsZiel(detail, url) {
  const tab = url.searchParams.get('tab');
  if (!tab || !tabSichtbar(tab)) return null;
  const param = TAB_PARAM[tab]?.param;
  const erlaubt = new Set(['tab', 'linie', FOKUS_PARAM, param].filter(Boolean));
  if ([...url.searchParams.keys()].some(key => !erlaubt.has(key))) return null;
  const wechsel = linienWechsel(detail, tab, url.searchParams.get('linie'));
  if (!wechsel) return null;
  return { tab, id: param ? url.searchParams.get(param) : null, wechsel, fokus: url.searchParams.get(FOKUS_PARAM) };
}

function zeigeTreffer(detail, treffer, linieId) {
  const wechsel = linienWechsel(detail, treffer.tab, linieId);
  if (!wechsel) return false;
  const { tab, id, fokus } = treffer;
  const adresse = flowUrl({ produktionId: detail.produktionId, tab, linieId, id, fokus });
  zeige(detail, { tab, id, wechsel, fokus }, { push: true, adresse });
  return true;
}

/** Ziel ohne geladene Linie: nachfragen, dann im Flow öffnen oder normal navigieren. */
function uebersetzeNachAbfrage(detail, route, treffer) {
  const lauf = detail._flowLauf;
  const produktionId = detail.produktionId;
  const aktuell = () => detail._isMounted && detail._flowLauf === lauf && detail.produktionId === produktionId;
  void (async () => {
    let linieId = null;
    try {
      linieId = await linieAbfragen(detail, treffer);
    } catch (error) {
      console.warn('⚠️ PRODUKTION: Flow-Ziel nicht ermittelbar, öffne die Seite:', error?.message || error);
    }
    if (!aktuell()) return;
    if (linieId !== null && zeigeTreffer(detail, treffer, linieId)) return;
    window.moduleRegistry?.navigateTo(route, false, { ohneModulRoute: true });
  })();
}

/**
 * Router-Hook der Produktion.
 * push: Klick (neuer History-Eintrag); sonst Zurück/Vor, die URL ist schon das Ziel.
 * @returns {boolean} true = erledigt, der Router macht nichts mehr
 */
export function routeImFlow(detail, route, { push = false } = {}) {
  if (!imFlow(detail)) return false;
  let url;
  try {
    url = new URL(route, window.location.origin);
  } catch {
    return false;
  }
  detail._flowLauf = (detail._flowLauf || 0) + 1;

  if (pathOf(url.pathname) === `/produktion/${detail.produktionId}`) {
    const ziel = produktionsZiel(detail, url);
    if (!ziel) return false;
    zeige(detail, ziel, { push, adresse: `${url.pathname}${url.search}${url.hash}` });
    return true;
  }

  // Zurück/Vor auf eine echte Einzelseite bleibt die Einzelseite
  if (!push) return false;
  const treffer = erkenneZiel(route);
  if (!treffer || !tabSichtbar(treffer.tab)) return false;
  const linieId = linieSync(detail, treffer);
  if (linieId) return zeigeTreffer(detail, treffer, linieId);
  if (!hatAbfrage(treffer)) return false;
  uebersetzeNachAbfrage(detail, route, treffer);
  return true;
}

/** Ansicht im Tab wechseln oder schließen (Wahl, Speichern, Abbrechen), ohne neuen History-Eintrag. */
export function zeigeImTab(detail, tab, id = null) {
  replaceRoute(tabUrl(detail, tab, id));
  anzeigen(detail, tab, id);
}

/** Klick auf den aktiven Tab mit offener Ansicht: zurück zur Liste. */
export function zeigeTabListe(detail, tab) {
  window.navigateTo?.(tabUrl(detail, tab));
}
