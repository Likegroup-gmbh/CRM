// auswertungKampagne.js
// Kampagnenseite: Umschalter „Produktionen | Auswertung“ im Seitenkopf. „Auswertung“ zeigt denselben
// Report wie der Produktions-Tab auf Ebene „Gesamte Kampagne“, ohne Unterreiter: erfasst wird pro
// Produktion, Sprünge dorthin führen in deren Tab. ?sicht=auswertung hält die Wahl in der URL.
// Die Kachel „Live-Performance“ öffnet die Auswertung. Nur fürs Team, wie der Produktions-Tab.

import { bindSegmentSwitches, moveSegmentThumb, renderSegmentSwitch, setSegmentValue } from '../../core/components/SegmentSwitch.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { selectionToSearch } from '../video-browser/videoBrowserSelection.js';
import { FINAL_ID } from '../video-browser/videoBrowserFormat.js';
import { ladeAuswertung } from './auswertungDaten.js';
import { baueModell } from './auswertungModell.js';
import { belebeAnsicht, bindeAnsicht, neuerZustand, renderAnsicht } from './auswertungAnsicht.js';
import { darfKostenSehen, zeigtAuswertung } from './auswertungPane.js';

const SICHT_ATTR = 'data-kampagne-sicht-seg';
const SICHTEN = ['produktionen', 'auswertung'];
const BODY = '.kampagne-detail-body[data-kampagne-sicht]';

export function kampagneSichtAusUrl() {
  if (!zeigtAuswertung()) return 'produktionen';
  const sicht = new URLSearchParams(window.location.search).get('sicht');
  return SICHTEN.includes(sicht) ? sicht : 'produktionen';
}

export function renderKampagneSichtSchalter(sicht) {
  if (!zeigtAuswertung()) return '';
  return renderSegmentSwitch({
    id: 'sicht',
    options: [{ value: 'produktionen', label: 'Produktionen' }, { value: 'auswertung', label: 'Auswertung' }],
    value: sicht,
    attr: SICHT_ATTR
  });
}

function syncUrl(sicht) {
  if (!window.history?.replaceState) return;
  const url = new URL(window.location.href);
  if (sicht === 'auswertung') url.searchParams.set('sicht', sicht);
  else url.searchParams.delete('sicht');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

function produktionFuerErfassen(modell, { postId, einheitId } = {}) {
  const post = postId ? modell.posts.find(p => p.id === postId) : null;
  const einheit = modell.einheitenById.get(post?.einheitId || einheitId)
    || modell.fehlend[0]
    || modell.einheitenById.get(modell.pruefen[0]?.einheitId);
  return einheit?.produktion?.id || null;
}

async function zeigeReport(detail, pane) {
  const s = detail._kampagneAuswertung;
  pane.innerHTML = '<div class="table-loading-container"><div class="table-loading-spinner"></div></div>';
  const token = ++s.token;
  let daten;
  try {
    daten = await ladeAuswertung({ kampagneId: detail.kampagneId, ebene: 'kampagne' });
  } catch (error) {
    console.error('Auswertung der Kampagne nicht geladen', error);
    if (token === s.token && pane.isConnected) {
      pane.innerHTML = renderEmptyState({ icon: 'info', title: 'Fehler beim Laden', text: 'Die Auswertung konnte nicht geladen werden.' });
    }
    return;
  }
  if (token !== s.token || !pane.isConnected) return;

  const modell = baueModell(daten, { ebene: 'kampagne' });
  const zustand = neuerZustand({ ebene: 'kampagne' });
  const kontext = { team: true, zeigeKosten: darfKostenSehen(), unterreiter: false };
  pane.innerHTML = renderAnsicht(modell, zustand, kontext);
  const root = pane.querySelector('[data-auswertung]');
  s.loeseAnsicht = bindeAnsicht(root, {
    modell: () => modell,
    zustand,
    kontext,
    posterCache: s.posterCache,
    onAnsicht: (ansicht, ziel) => {
      const produktionId = ansicht === 'erfassen' ? produktionFuerErfassen(modell, ziel) : null;
      if (produktionId) window.navigateTo(`/produktion/${produktionId}?tab=auswertung&ansicht=erfassen`);
    },
    onVideoTab: (einheit, post) => {
      const sel = { kooperationId: einheit.kooperationId, videoId: einheit.videoId, folderId: FINAL_ID, itemId: post.dateiId };
      window.navigateTo(`/produktion/${einheit.produktion.id}${selectionToSearch('?tab=videos', sel)}`);
    }
  });
  belebeAnsicht(root, modell, { posterCache: s.posterCache });
  s.geladen = true;
}

function zeige(detail, sicht) {
  const body = document.querySelector(BODY);
  const s = detail._kampagneAuswertung;
  if (!body || !s) return;
  body.dataset.kampagneSicht = sicht;
  body.querySelectorAll('[data-kampagne-sicht-pane]').forEach((pane) => {
    pane.hidden = pane.dataset.kampagneSichtPane !== sicht;
  });
  syncUrl(sicht);
  const pane = body.querySelector('[data-kampagne-sicht-pane="auswertung"]');
  if (sicht === 'auswertung' && pane && !s.geladen) void zeigeReport(detail, pane);
}

/** Kachel „Live-Performance“: Umschalter mitziehen und zur Auswertung scrollen. */
function oeffneVonKachel(detail) {
  const gruppe = document.querySelector(`${BODY} [${SICHT_ATTR}]`);
  if (setSegmentValue(gruppe, 'auswertung', { attr: SICHT_ATTR })) moveSegmentThumb(gruppe);
  zeige(detail, 'auswertung');
  document.querySelector(BODY)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Nach dem Rendern der Kampagnenseite binden. Räumt sich mit `signal` (Teardown der Seite) ab.
 * @param {object} detail - KampagneDetail
 * @param {AbortSignal} signal
 */
export function bindKampagnenAuswertung(detail, signal) {
  const body = document.querySelector(BODY);
  if (!zeigtAuswertung() || detail.mode !== 'overview' || !body) return;
  detail._kampagneAuswertung = { token: 0, geladen: false, posterCache: new Map(), loeseAnsicht: null };

  const kopf = body.querySelector('.page-header-right');
  const loeseSchalter = bindSegmentSwitches(kopf, (_id, sicht) => zeige(detail, sicht), { attr: SICHT_ATTR });

  const kachel = (e) => e.target.closest?.('[data-auswertung-oeffnen]');
  document.addEventListener('click', (e) => { if (kachel(e)) oeffneVonKachel(detail); }, { signal });
  document.addEventListener('keydown', (e) => {
    if ((e.key !== 'Enter' && e.key !== ' ') || !kachel(e)) return;
    e.preventDefault();
    oeffneVonKachel(detail);
  }, { signal });

  signal.addEventListener('abort', () => {
    const s = detail._kampagneAuswertung;
    if (s) { s.token += 1; s.loeseAnsicht?.(); }
    loeseSchalter();
    detail._kampagneAuswertung = null;
  }, { once: true });

  if (body.dataset.kampagneSicht === 'auswertung') zeige(detail, 'auswertung');
}
