// Events der Creator-Kacheln: Favorit, Favoriten-Namen, Akte, Casting, Retry.

import { playBurst } from '../../core/animation/burst.js';
import { openCastingPicker } from './creatorCasting.js';
import { istMeinFavorit, patchFavorit, renderFavoritNamen, toggleFavorit } from './creatorFavorit.js';

async function toggleFavoritAufKarte(view, id, button) {
  const creator = view._byId?.get(id);
  if (!creator || !window.supabase) return;
  if (button?.dataset.busy === '1') return;
  const before = creator.favoriten || [];
  const wasMine = istMeinFavorit(before);
  const host = button?.closest('.creator-favorit');
  if (button) {
    button.dataset.busy = '1';
    playBurst(button, !wasMine);
  }
  try {
    creator.favoriten = await toggleFavorit(window.supabase, id, before);
    if (host?.isConnected) patchFavorit(host, creator.favoriten, id);
    else view._replaceCard(creator);
  } catch (error) {
    if (button?.isConnected) playBurst(button, wasMine);
    console.error('Favorit konnte nicht gesetzt werden', error);
    window.toastSystem?.show('Favorit konnte nicht gesetzt werden', 'error');
  } finally {
    if (button) delete button.dataset.busy;
  }
}

function toggleNamen(view, id) {
  const card = view._findCard(view.getContainer(), id);
  const creator = view._byId?.get(id);
  if (!card || !creator) return;
  const host = card.querySelector('.creator-favorit');
  const open = host?.querySelector('.creator-favorit__namen');
  document.querySelectorAll('.creator-favorit__namen').forEach((node) => node.remove());
  if (!open && host) host.insertAdjacentHTML('beforeend', renderFavoritNamen(creator.favoriten));
}

export function bindGridEvents(view, signal) {
  document.addEventListener('click', async (e) => {
    const favorit = e.target.closest('[data-action="toggle-favorit"]');
    if (favorit && view._ownsNode(favorit)) {
      e.preventDefault();
      e.stopPropagation();
      await toggleFavoritAufKarte(view, favorit.dataset.id, favorit);
      return;
    }
    const show = e.target.closest('[data-action="show-favoriten"]');
    if (show && view._ownsNode(show)) {
      e.preventDefault();
      e.stopPropagation();
      toggleNamen(view, show.dataset.id);
      return;
    }
    const person = e.target.closest('[data-action="filter-favorit"]');
    if (person && view._ownsNode(person)) {
      e.preventDefault();
      e.stopPropagation();
      view.list.setFavoritVon?.(person.dataset.userId);
      return;
    }
    const open = e.target.closest('.creator-card__link');
    if (open && view._ownsNode(open)) {
      e.preventDefault();
      e.stopPropagation();
      view.openKontakt(open.dataset.id);
      return;
    }
    // Auch aus der Kontakt-Schublade heraus
    const casting = e.target.closest('.creator-card__casting');
    if (casting && (view._ownsNode(casting) || casting.closest('.drawer-panel'))) {
      e.preventDefault();
      e.stopPropagation();
      const creator = view._byId?.get(casting.dataset.id);
      if (creator) openCastingPicker(creator);
      return;
    }

    // Retry nach Fehler
    const retry = e.target.closest('.creator-grid-retry');
    if (retry && retry.closest(`#${view.statusId}`)) {
      e.preventDefault();
      view.reload();
    }
  }, { signal });

  window.addEventListener('creator-merkmale-changed', (event) => {
    const detail = event.detail || {};
    const creator = view._byId?.get(detail.id);
    if (!creator) {
      if (detail.favoritVon) view.list.setFavoritVon?.(detail.favoritVon);
      return;
    }
    if (detail.favoriten) creator.favoriten = detail.favoriten;
    if (detail.tags) creator.tags = detail.tags;
    if (detail.favoritVon) view.list.setFavoritVon?.(detail.favoritVon);
    else view._replaceCard(creator);
  }, { signal });
}
