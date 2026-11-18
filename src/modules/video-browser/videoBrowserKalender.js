// videoBrowserKalender.js
// Kalender im Videos-Tab (dritte Darstellung, siehe CONTEXT.md "Kalender (Videos-Tab)"): jedes
// Kooperationsvideo mit Posting-Datum an seinem Tag. Gitter aus core/components/CalendarGrid.js, im Kopf
// der Umschalter "Umfang" (gewählte Linie bzw. Produktion oder Gesamte Kampagne). Das Team zieht Karten
// zwischen Tagen und zwischen Kalender und Liste (videoBrowserKalenderListe.js), Kunden sehen nur.
// Zustand am Controller (`vb`): kalender ({ umfang, modus, datum }, steht in der URL), kalRows (geladene
// Videos, null bis zum ersten Laden), kalResult ({ events, ohneDatum }), kalSuche.

import { CalendarGrid } from '../../core/components/CalendarGrid.js';
import { formatDateLocal, isInPeriod, parseDateOnly } from '../../core/calendarDates.js';
import { DEFAULT_KALENDER, kalenderFromSearch } from './videoBrowserSelection.js';
import { kalenderEintraege, loadPostingVideos, mitPostingDatum, savePostingDatum } from './videoBrowserKalenderData.js';
import { kalenderListeShellHtml, mountKalenderListe, renderKalenderListe } from './videoBrowserKalenderListe.js';
import { segmentHtml } from './videoBrowserRenderParts.js';
import { setSegment } from './videoBrowserShowcase.js';

const gridView = (modus) => (modus === 'woche' ? 'week' : 'month');

/**
 * Vor dem Gerüst: Einstellungen aus der URL.
 * @returns {boolean} true, wenn die URL den Kalender meint
 */
export function initKalenderState(vb) {
  const fromUrl = kalenderFromSearch(window.location.search);
  vb.kalender = fromUrl || { ...DEFAULT_KALENDER };
  vb.kalRows = null;
  vb.kalResult = { events: [], ohneDatum: [] };
  vb.kalSuche = '';
  vb.kalGen = 0;
  return !!fromUrl;
}

export const kalenderSectionHtml = (vb) => `
  <section class="vb-kalender${vb.team ? ' vb-kalender--liste' : ''}" data-vb-kalender aria-label="Kalender"${vb.view === 'kalender' ? '' : ' hidden'}>
    ${vb.team ? kalenderListeShellHtml() : ''}
    <div class="vb-kalender__grid" data-vb-kal-grid></div>
  </section>`;

/** Ohne Produktion (Kampagne ohne Linien-Kontext) gibt es nichts umzuschalten. */
const hatUmfang = (vb) => !!vb.detail?.produktionId;

function umfangOptions(vb) {
  return [
    { value: 'auswahl', label: vb._linieId() ? 'Linie' : 'Produktion' },
    { value: 'kampagne', label: 'Gesamte Kampagne' }
  ];
}

/** Kopf-Slot im Gitter: bleibt als Element bestehen, CalendarGrid hängt ihn nur um. */
function buildKopf(vb) {
  if (!hatUmfang(vb) && vb.team) return null;
  const el = document.createElement('div');
  el.className = 'vb-kalender__kopf';
  el.innerHTML = [
    hatUmfang(vb) ? segmentHtml({ id: 'umfang', label: 'Umfang', options: umfangOptions(vb), value: vb.kalender.umfang }) : '',
    vb.team ? '' : '<span class="vb-kalender__hinweis" data-vb-kal-hinweis hidden></span>'
  ].join('');
  return el;
}

/** Nach dem Gerüst, nach createMotion. */
export function mountKalender(vb) {
  vb.kalEl = vb.root.querySelector('[data-vb-kalender]');
  vb.kalKopfEl = buildKopf(vb);
  vb.kalUmfangEl = vb.kalKopfEl?.querySelector('[data-vb-seg="umfang"]') || null;
  vb.kalGrid = new CalendarGrid(vb.kalEl.querySelector('[data-vb-kal-grid]'), {
    view: gridView(vb.kalender.modus),
    anchor: vb.kalender.datum || new Date(),
    getEvents: () => vb.kalResult.events,
    headerExtraEl: vb.kalKopfEl,
    onMove: vb.team ? (id, iso) => movePosting(vb, id, iso) : undefined,
    onStateChange: ({ view, anchor }) => onGridState(vb, view, anchor),
    drawerTitle: 'Alle Videos an diesem Tag'
  });
  if (vb.team) mountKalenderListe(vb, { onDrop: (id) => movePosting(vb, id, null) });
  if (vb.view === 'kalender') void showKalender(vb);
}

/** Einblenden (videoBrowserView.setView hat `vb.view` schon gesetzt). Lädt jedes Mal frisch nach. */
export async function showKalender(vb) {
  vb.kalEl.hidden = false;
  renderKalender(vb);
  vb.motion?.tabIndicator(vb.kalUmfangEl, { animate: false });
  await reloadKalender(vb);
}

export function hideKalender(vb) {
  vb.kalEl.hidden = true;
}

export function renderKalender(vb) {
  if (!vb.kalGrid) return;
  vb.kalResult = kalenderEintraege(vb.kalRows || [], {
    umfang: hatUmfang(vb) ? vb.kalender.umfang : 'kampagne',
    produktionId: vb.detail.produktionId || null,
    linieId: vb._linieId()
  });
  vb.kalGrid.render();
  renderHinweis(vb);
  if (vb.team) renderKalenderListe(vb);
}

function renderHinweis(vb) {
  const el = vb.kalKopfEl?.querySelector('[data-vb-kal-hinweis]');
  if (!el) return;
  const n = vb.kalRows === null ? 0 : vb.kalResult.ohneDatum.length;
  el.hidden = !n;
  el.textContent = `${n === 1 ? '1 Video' : `${n} Videos`} ohne Posting-Datum`;
}

/** Neu laden (Ansicht geöffnet, Live-Update). Ältere Antworten und Antworten nach einem Verschieben verfallen. */
export async function reloadKalender(vb) {
  const gen = ++vb.kalGen;
  let rows;
  try {
    rows = await loadPostingVideos(vb.detail.kampagneId);
  } catch (err) {
    if (vb.destroyed || gen !== vb.kalGen) return;
    console.error('VideoBrowser: Kalender konnte nicht geladen werden', err);
    vb.toast('error', 'Kalender konnte nicht geladen werden.');
    rows = vb.kalRows || [];
  }
  if (vb.destroyed || gen !== vb.kalGen) return;
  vb.kalRows = rows;
  if (vb.view === 'kalender') renderKalender(vb);
}

export function destroyKalender(vb) {
  vb.kalGen += 1;
  vb.kalGrid?.destroy();
  vb.kalGrid = null;
}

function onGridState(vb, view, anchor) {
  const today = parseDateOnly(new Date());
  vb.kalender = {
    ...vb.kalender,
    modus: view === 'week' ? 'woche' : 'monat',
    // Zeitraum mit heute: kein Datum in der URL, der Link zeigt dann immer den laufenden Zeitraum
    datum: isInPeriod(today, anchor, view) ? null : formatDateLocal(anchor)
  };
  vb._syncUrl();
}

/** Klicks im Kalender (Umschalter Umfang). Alles in der Section gehört dem Kalender. */
export function onKalenderClick(vb, e) {
  if (!vb.kalEl?.contains(e.target)) return false;
  const opt = e.target.closest('[data-vb-seg="umfang"] [data-vb-seg-opt]');
  if (opt && opt.dataset.value !== vb.kalender.umfang) {
    vb.kalender = { ...vb.kalender, umfang: opt.dataset.value };
    setSegment(vb, vb.kalUmfangEl, vb.kalender.umfang, { animate: true });
    renderKalender(vb);
    vb._syncUrl();
  }
  return true;
}

/**
 * Posting-Datum setzen (`iso`) oder entfernen (`null`), optimistisch mit Rücksprung bei Fehler.
 * Nur fürs Team: Kunden bekommen kein onMove und keine Liste.
 */
export async function movePosting(vb, videoId, iso) {
  const row = (vb.kalRows || []).find(r => r.id === videoId);
  if (!row) return;
  const before = row.posting_datum ?? null;
  const day = parseDateOnly(before);
  if ((day ? formatDateLocal(day) : null) === (iso || null)) return;
  vb.kalGen += 1;
  vb.kalRows = mitPostingDatum(vb.kalRows, videoId, iso);
  renderKalender(vb);
  try {
    await savePostingDatum(videoId, iso);
  } catch (err) {
    console.error('VideoBrowser: Posting-Datum konnte nicht gespeichert werden', err);
    if (vb.destroyed) return;
    vb.kalRows = mitPostingDatum(vb.kalRows, videoId, before);
    renderKalender(vb);
    vb.toast('error', 'Posting-Datum konnte nicht gespeichert werden.');
  }
}
