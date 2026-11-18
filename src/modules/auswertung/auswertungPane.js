// auswertungPane.js
// Tab „Auswertung“ der Produktion. Rendert über den generischen Pane-Lader (renderAuswertungPane),
// bindet danach Ansicht und Ebenen-Umschalter „Produktion | Gesamte Kampagne“ im Slot der Tab-Zeile.
// Ansicht und Ebene stehen in der URL (?ansicht=erfassen, ?ebene=kampagne), Standardwerte fehlen dort.
// Das Team sieht live und erfasst; Kunde und Gast sehen den Platzhalter, bis es die Report-Freigabe gibt.

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { bindSegmentSwitches, renderSegmentSwitch } from '../../core/components/SegmentSwitch.js';
import { clearListenSwitch, effectiveLinie, placeListenSwitch } from '../kampagne/linienScope.js';
import { selectionToSearch } from '../video-browser/videoBrowserSelection.js';
import { FINAL_ID } from '../video-browser/videoBrowserFormat.js';
import { ladeAuswertung, vergiss } from './auswertungDaten.js';
import { baueModell } from './auswertungModell.js';
import { ANSICHTEN, aktualisiereStand, belebeAnsicht, bindeAnsicht, ersetzeInhalt, neuerZustand, renderAnsicht } from './auswertungAnsicht.js';
import { bindeErfassen } from './auswertungErfassen.js';
import { wirdGeloescht } from './auswertungErfassenAktionen.js';
import { mitLivePost } from '../kampagne/kampagneLivePerformance.js';

const EBENEN = ['produktion', 'kampagne'];
const EBENE_ATTR = 'data-auswertung-ebene-seg';
const BODY = '.kampagne-detail-body[data-workflow]';

export const zeigtAuswertung = () => window.isAdmin?.() === true || window.isMitarbeiter?.() === true;
export const darfErfassen = () => zeigtAuswertung() && window.isInvestor?.() !== true;
export const darfKostenSehen = () => window.isGast?.() !== true;

/** Aktionen im Seitenkopf. Bis zur echten Freigabe ohne Funktion. */
export function renderAuswertungChrome() {
  if (!zeigtAuswertung()) return '';
  const knopf = (label, haupt = false) => `<button type="button" class="mdc-btn${haupt ? '' : ' mdc-btn--secondary'}" disabled title="Folgt mit der Report-Freigabe">${label}</button>`;
  return `<div class="kampagne-tab-chrome" data-chrome="auswertung">${knopf('CSV')}${knopf('PDF')}${knopf('Teilen')}${knopf('Für Kunden freigeben', true)}</div>`;
}

function zustandAusUrl() {
  const params = new URLSearchParams(window.location.search);
  const ansicht = params.get('ansicht');
  const ebene = params.get('ebene');
  return neuerZustand({
    ansicht: ANSICHTEN.includes(ansicht) ? ansicht : 'report',
    ebene: EBENEN.includes(ebene) ? ebene : 'produktion'
  });
}

function syncUrl(zustand) {
  if (!window.history?.replaceState) return;
  const url = new URL(window.location.href);
  if (zustand && zustand.ansicht !== 'report') url.searchParams.set('ansicht', zustand.ansicht);
  else url.searchParams.delete('ansicht');
  if (zustand && zustand.ebene !== 'produktion') url.searchParams.set('ebene', zustand.ebene);
  else url.searchParams.delete('ebene');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function sitzung(detail) {
  if (!detail._auswertung) detail._auswertung = { zustand: zustandAusUrl(), posterCache: new Map(), token: 0 };
  return detail._auswertung;
}

const produktionVon = (detail) => ({ id: detail.produktionId, name: detail.produktion?.name || '', linien: detail.linien || [] });

function rechne(detail) {
  const s = detail._auswertung;
  const linieId = effectiveLinie(detail, 'auswertung');
  // Ein verworfener Post bleibt weg, auch wenn ein Neuladen ihn vor dem Löschen noch liefert
  const daten = { ...s.daten, posts: (s.daten.posts || []).filter(p => !wirdGeloescht(p.id)) };
  s.modell = baueModell(daten, { ebene: s.zustand.ebene, produktionId: detail.produktionId, linieId });
  // Dasselbe Objekt behalten: bindeAnsicht hält es über Ebenenwechsel hinweg
  s.kontext = Object.assign(s.kontext || {}, {
    team: true,
    zeigeKosten: darfKostenSehen(),
    unterreiter: true,
    offenProduktion: baueModell(daten, { ebene: 'produktion', produktionId: detail.produktionId }).fortschritt.offen
  });
}

/**
 * Einen Post tauschen, anlegen oder (weg) entfernen, ohne neu zu laden: Modell, Lead und Zähler
 * am Unterreiter ziehen nach, die Stände der Kampagne im Cache verfallen.
 * @returns {boolean} false, wenn die Pane nicht mehr hängt
 */
function aenderePost(detail, post, { weg = false } = {}) {
  detail?.store?.setLivePosts?.(mitLivePost(detail.store.livePosts, post, { weg }));
  const s = detail?._auswertung;
  if (!s?.daten || !s.root?.isConnected) return false;
  const posts = s.daten.posts || [];
  const index = posts.findIndex(p => p.id === post.id);
  let neu;
  if (weg) neu = posts.filter(p => p.id !== post.id);
  else if (index >= 0) neu = posts.map(p => (p.id === post.id ? post : p));
  else neu = [...posts, post];
  s.daten = { ...s.daten, posts: neu };
  vergiss(detail.kampagneId);
  rechne(detail);
  aktualisiereStand(s.root, s.modell, s.zustand, s.kontext);
  return true;
}

/** Erfassen hängt seine Listener nur, solange die Ansicht zu sehen ist. */
function bindeErfassenNeu(detail) {
  const s = detail._auswertung;
  s.loeseErfassen?.();
  s.loeseErfassen = null;
  if (!s.root || s.zustand.ansicht !== 'erfassen') return;
  s.loeseErfassen = bindeErfassen(s.root, {
    modell: () => s.modell,
    zustand: s.zustand,
    posterCache: s.posterCache,
    aendere: {
      post: (post) => aenderePost(detail, post),
      weg: (postId) => aenderePost(detail, { id: postId }, { weg: true })
    }
  });
}

function laden(detail) {
  const s = detail._auswertung;
  return ladeAuswertung({ kampagneId: detail.kampagneId, produktion: produktionVon(detail), ebene: s.zustand.ebene });
}

export async function renderAuswertungPane(detail) {
  if (!zeigtAuswertung()) {
    return renderEmptyState({ icon: 'info', title: 'Auswertung folgt', text: 'Für diese Produktion liegt noch keine Auswertung vor.' });
  }
  const s = sitzung(detail);
  if (s.zustand.ansicht === 'erfassen') s.zustand.ebene = 'produktion';
  s.daten = await laden(detail);
  rechne(detail);
  return renderAnsicht(s.modell, s.zustand, s.kontext);
}

/** Bei Kampagne blendet CSS den Linien-Wechsler aus, er filtert dort nichts. */
function markiereEbene(detail) {
  const body = document.querySelector(BODY);
  if (body) body.dataset.auswertungEbene = detail._auswertung?.zustand.ebene || '';
}

function setzeEbenenSchalter(detail) {
  const s = detail._auswertung;
  s.loeseEbene?.();
  s.loeseEbene = null;
  if (s.zustand.ansicht !== 'report') { clearListenSwitch(); return; }
  const html = renderSegmentSwitch({
    id: 'ebene',
    options: [{ value: 'produktion', label: 'Produktion' }, { value: 'kampagne', label: 'Gesamte Kampagne' }],
    value: s.zustand.ebene,
    attr: EBENE_ATTR
  });
  const { slot } = placeListenSwitch(html, 'auswertung-ebene');
  if (slot) s.loeseEbene = bindSegmentSwitches(slot, (_id, ebene) => { void setze(detail, { ebene }); }, { attr: EBENE_ATTR });
}

/** Produktion eines Ziels (Post oder Einheit) im aktuellen Modell, null wenn unbekannt. */
function produktionDesZiels(modell, ziel) {
  const post = ziel?.postId && modell?.posts.find(p => p.id === ziel.postId);
  const einheit = modell?.einheitenById.get(post?.einheitId || ziel?.einheitId);
  return einheit?.produktion?.id || null;
}

/**
 * Ansicht oder Ebene wechseln. Erfasst wird immer pro Produktion; ein Ziel aus einer anderen
 * Produktion (Ebene Kampagne) öffnet deren Erfassen.
 */
async function setze(detail, teil) {
  const s = detail._auswertung;
  if (!s?.root) return;
  const fremd = teil.ziel && produktionDesZiels(s.modell, teil.ziel);
  if (teil.ansicht === 'erfassen' && fremd && fremd !== detail.produktionId) {
    window.navigateTo(`/produktion/${fremd}?tab=auswertung&ansicht=erfassen`);
    return;
  }
  const vorher = { ...s.zustand };
  Object.assign(s.zustand, teil);
  if (s.zustand.ansicht === 'erfassen') s.zustand.ebene = 'produktion';
  if (vorher.ansicht === s.zustand.ansicht && vorher.ebene === s.zustand.ebene) {
    if (teil.ziel && s.zustand.ansicht === 'erfassen') {
      ersetzeInhalt(s.root, s.modell, s.zustand, s.kontext, { posterCache: s.posterCache });
      bindeErfassenNeu(detail);
    }
    return;
  }
  syncUrl(s.zustand);
  markiereEbene(detail);
  if (vorher.ansicht !== s.zustand.ansicht) setzeEbenenSchalter(detail);

  const token = ++s.token;
  if (vorher.ebene !== s.zustand.ebene) {
    s.root.setAttribute('aria-busy', 'true');
    try {
      s.daten = await laden(detail);
    } catch (error) {
      console.error('Auswertung: Ebene nicht geladen', error);
      window.toastSystem?.show('Die Auswertung konnte nicht geladen werden.', 'error');
      if (token === s.token) { Object.assign(s.zustand, vorher); syncUrl(s.zustand); markiereEbene(detail); setzeEbenenSchalter(detail); }
      return;
    } finally {
      if (token === s.token) s.root?.removeAttribute('aria-busy');
    }
  }
  if (token !== s.token || !s.root?.isConnected) return;
  rechne(detail);
  ersetzeInhalt(s.root, s.modell, s.zustand, s.kontext, { posterCache: s.posterCache });
  bindeErfassenNeu(detail);
}

function zumVideoTab(detail, einheit, post) {
  const sel = { kooperationId: einheit.kooperationId, videoId: einheit.videoId, folderId: FINAL_ID, itemId: post.dateiId };
  if (einheit.produktion?.id !== detail.produktionId) {
    window.navigateTo(`/produktion/${einheit.produktion.id}${selectionToSearch('?tab=videos', sel)}`);
    return;
  }
  const search = selectionToSearch(window.location.search, sel);
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`);
  detail.switchWorkflowTab('videos');
}

export function mountAuswertungPane(detail, pane) {
  const s = detail._auswertung;
  const root = pane?.querySelector('[data-auswertung]');
  if (!s || !root) return;
  s.root = root;
  markiereEbene(detail);
  setzeEbenenSchalter(detail);
  s.loeseAnsicht = bindeAnsicht(root, {
    modell: () => s.modell,
    zustand: s.zustand,
    kontext: s.kontext,
    posterCache: s.posterCache,
    onAnsicht: (ansicht, ziel) => { void setze(detail, { ansicht, ziel: ziel?.postId || ziel?.einheitId ? ziel : null }); },
    onVideoTab: (einheit, post) => zumVideoTab(detail, einheit, post)
  });
  belebeAnsicht(root, s.modell, { vorher: s.zaehler, posterCache: s.posterCache });
  bindeErfassenNeu(detail);
  s.zaehler = null;
  syncUrl(s.zustand);
}

/**
 * Listener und Slot abbauen. Beim Verlassen des Tabs auch Zustand und URL-Parameter weg; sonst
 * (Linienwechsel, Neu-Rendern) bleibt der Zustand und die Zahlen zählen vom alten Stand weiter.
 */
export function unmountAuswertungPane(detail, { verlassen = false } = {}) {
  const s = detail?._auswertung;
  if (!s) return;
  s.token += 1;
  s.loeseAnsicht?.();
  s.loeseEbene?.();
  s.loeseErfassen?.();
  s.loeseAnsicht = null;
  s.loeseEbene = null;
  s.loeseErfassen = null;
  if (s.root?.isConnected && !verlassen) {
    s.zaehler = new Map([...s.root.querySelectorAll('[data-count]')].map(el => [el.dataset.count, parseFloat(el.dataset.countValue)]));
  }
  s.root = null;
  clearListenSwitch();
  const body = document.querySelector(BODY);
  if (body) delete body.dataset.auswertungEbene;
  if (verlassen) {
    syncUrl(null);
    detail._auswertung = null;
  }
}
