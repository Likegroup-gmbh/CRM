// videoBrowserKalenderListe.js
// Liste links im Kalender des Videos-Tabs, nur fürs Team: Videos ohne Posting-Datum im gewählten Umfang.
// Eine Karte auf einen Tag gezogen setzt das Posting-Datum (Drop im CalendarGrid), eine Kalenderkarte
// auf die Liste gezogen entfernt es. Die Suche baut nur die Karten neu, das Feld behält Fokus und Cursor.

import { escapeHtml as esc } from '../../core/format.js';
import { icon } from '../../core/icons/IconSystem.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { getDragId, hasDragId, setDragId } from '../../core/components/calendarGridDnd.js';
import { filterListe } from './videoBrowserKalenderData.js';

// Zweiter Typ an Karten aus der Liste: im dragover sind nur Typen lesbar, nicht die ID
const LISTE_DRAG_TYPE = 'application/x-vb-kal-liste';

export const kalenderListeShellHtml = () => `
  <aside class="vb-kal-liste" data-vb-kal-liste aria-label="Videos ohne Posting-Datum">
    <div class="vb-kal-liste__kopf">
      <label class="vb-kal-liste__suche">
        ${icon('search')}
        <input type="search" class="vb-kal-liste__input" placeholder="Creator, Titel, Thema" aria-label="Videos ohne Posting-Datum durchsuchen" autocomplete="off" data-vb-kal-suche>
      </label>
    </div>
    <h3 class="vb-kal-liste__titel">Ohne Posting-Datum <span class="vb-kal-liste__count" data-vb-kal-count>0</span></h3>
    <div class="vb-kal-liste__body" data-vb-kal-cards></div>
  </aside>`;

/** Zeile wie in der Skript-Sidebar: Bubble + Creator, rechts das Video, darunter Videoname und Linie. */
function cardHtml(item) {
  const bubble = avatarBubbles.renderBubbles([{ name: item.creator, type: 'person', profile_image_url: item.creatorBild }], { maxVisible: 1 });
  return `
    <div class="vb-kal-card" draggable="true" data-vb-kal-card="${esc(item.id)}"${item.titel ? ` title="${esc(item.titel)}"` : ''}>
      <span class="vb-kal-card__top">
        <span class="vb-kal-card__creator">
          <span class="vb-kal-card__bubble">${bubble}</span>
          <span class="vb-kal-card__name">${esc(item.creator)}</span>
        </span>
        <span class="vb-kal-card__video">${esc(item.label)}</span>
      </span>
      ${item.titel ? `<span class="vb-kal-card__titel">${esc(item.titel)}</span>` : ''}
      <span class="vb-kal-card__linie">
        <span class="vb-kal-card__dot" style="background:${esc(item.linie.farbe)}" aria-hidden="true"></span>
        <span class="vb-kal-card__linie-name">${esc(item.linie.name)}</span>
      </span>
    </div>`;
}

function bodyHtml(vb, alle, treffer) {
  if (vb.kalRows === null) return '<p class="vb-kal-liste__laedt">Lädt …</p>';
  if (!alle.length) return renderEmptyState({ icon: 'calendar', title: 'Alle Videos haben ein Posting-Datum', size: 'small' });
  if (!treffer.length) return renderEmptyState({ icon: 'search', title: 'Keine Treffer', size: 'small' });
  return treffer.map(cardHtml).join('');
}

export function renderKalenderListe(vb) {
  const el = vb.kalListeEl;
  if (!el) return;
  const alle = vb.kalResult?.ohneDatum || [];
  const treffer = filterListe(alle, vb.kalSuche);
  el.querySelector('[data-vb-kal-count]').textContent = String(alle.length);
  el.querySelector('[data-vb-kal-cards]').innerHTML = bodyHtml(vb, alle, treffer);
}

/**
 * Listener an der Liste. `onDrop(videoId)` kommt, wenn eine Kalenderkarte auf der Liste landet.
 * @param {{ onDrop: (videoId: string) => (void|Promise<void>) }} handlers
 */
export function mountKalenderListe(vb, { onDrop }) {
  const el = vb.kalEl?.querySelector('[data-vb-kal-liste]') || null;
  vb.kalListeEl = el;
  if (!el) return;
  const on = (type, fn) => {
    el.addEventListener(type, fn);
    vb.cleanups.push(() => el.removeEventListener(type, fn));
  };
  const fromListe = (e) => Array.from(e.dataTransfer?.types || []).includes(LISTE_DRAG_TYPE);

  on('input', (e) => {
    if (!e.target.closest?.('[data-vb-kal-suche]')) return;
    vb.kalSuche = e.target.value;
    renderKalenderListe(vb);
  });
  on('dragstart', (e) => {
    const card = e.target.closest?.('[data-vb-kal-card]');
    if (!card) return;
    setDragId(e, card.dataset.vbKalCard);
    e.dataTransfer?.setData(LISTE_DRAG_TYPE, '1');
    card.classList.add('is-dragging');
  });
  on('dragend', (e) => {
    e.target.closest?.('[data-vb-kal-card]')?.classList.remove('is-dragging');
    el.classList.remove('is-drop');
  });
  on('dragover', (e) => {
    if (!hasDragId(e) || fromListe(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    el.classList.add('is-drop');
  });
  on('dragleave', (e) => {
    if (!el.contains(e.relatedTarget)) el.classList.remove('is-drop');
  });
  on('drop', (e) => {
    el.classList.remove('is-drop');
    if (fromListe(e)) return;
    const id = getDragId(e);
    if (!id) return;
    e.preventDefault();
    void onDrop(id);
  });
}
