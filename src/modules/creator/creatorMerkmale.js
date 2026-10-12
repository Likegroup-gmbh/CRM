// Stern und Tags in der Schublade und auf der Creator-Seite.

import { renderFavorit, renderFavoritNamen, ladeFavoriten, toggleFavorit } from './creatorFavorit.js';
import { ladeCreatorTags, mountCreatorTagEditor } from './creatorTags.js';

export async function haengeMerkmaleAn(creators) {
  if (!window.supabase || !creators?.length) return creators;
  const ids = creators.map((creator) => creator.id).filter(Boolean);
  const [favoriten, tags] = await Promise.all([
    ladeFavoriten(window.supabase, ids),
    ladeCreatorTags(window.supabase, ids)
  ]);
  for (const creator of creators) {
    creator.favoriten = favoriten.get(creator.id) || [];
    creator.tags = tags.get(creator.id) || [];
  }
  return creators;
}

function publish(detail) {
  window.dispatchEvent(new CustomEvent('creator-merkmale-changed', { detail }));
}

export function merkmaleHtml(creatorId) {
  const id = String(creatorId ?? '').replace(/"/g, '&quot;');
  return `
    <div class="creator-merkmale detail-card" data-creator-id="${id}">
      <div class="creator-favorit-host"></div>
      <div class="form-field">
        <label>Tags</label>
        <div class="creator-tag-host"></div>
      </div>
    </div>
  `;
}

export async function bindCreatorMerkmale(root) {
  const host = root?.querySelector?.('.creator-merkmale');
  if (!host || host.dataset.bound === '1' || !window.supabase) return;
  host.dataset.bound = '1';
  const creatorId = host.dataset.creatorId;
  if (!creatorId) return;
  const abort = new AbortController();
  const signal = abort.signal;
  host.addEventListener('remove', () => abort.abort(), { once: true });

  const starHost = host.querySelector('.creator-favorit-host');
  let favoriten = [];
  try {
    const map = await ladeFavoriten(window.supabase, [creatorId]);
    favoriten = map.get(creatorId) || [];
  } catch (error) {
    console.warn('Favoriten konnten nicht geladen werden', error);
  }

  const paint = () => {
    if (starHost) starHost.innerHTML = renderFavorit({ id: creatorId, favoriten });
  };
  paint();

  starHost?.addEventListener('click', async (event) => {
    const toggle = event.target.closest('[data-action="toggle-favorit"]');
    const show = event.target.closest('[data-action="show-favoriten"]');
    const filter = event.target.closest('[data-action="filter-favorit"]');
    if (toggle) {
      event.preventDefault();
      try {
        favoriten = await toggleFavorit(window.supabase, creatorId, favoriten);
        paint();
        publish({ id: creatorId, favoriten });
      } catch (error) {
        console.error('Favorit konnte nicht gesetzt werden', error);
        window.toastSystem?.show('Favorit konnte nicht gesetzt werden', 'error');
      }
      return;
    }
    if (show) {
      event.preventDefault();
      const open = starHost.querySelector('.creator-favorit__namen');
      starHost.querySelector('.creator-favorit__namen')?.remove();
      if (!open) starHost.querySelector('.creator-favorit')?.insertAdjacentHTML('beforeend', renderFavoritNamen(favoriten));
      return;
    }
    if (filter) {
      event.preventDefault();
      publish({ id: creatorId, favoritVon: filter.dataset.userId });
    }
  }, { signal });

  mountCreatorTagEditor(host.querySelector('.creator-tag-host'), {
    creatorId,
    signal,
    onChange: (tags) => publish({ id: creatorId, tags })
  });
}
