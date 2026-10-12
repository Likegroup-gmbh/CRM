// Favorit: die Markierung eines Creators durch genau eine interne Person.

import { icon } from '../../core/icons/IconSystem.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function currentUserId() {
  return window.currentUser?.auth_user_id || null;
}

export function renderFavorit(creator) {
  const list = Array.isArray(creator?.favoriten) ? creator.favoriten : [];
  const mine = list.some((entry) => entry.user_id === currentUserId());
  const count = list.length;
  const id = esc(creator?.id);
  const starLabel = mine ? 'Favorit entfernen' : 'Als Favorit markieren';
  const countHtml = count > 0
    ? `<button type="button" class="creator-favorit__count" data-action="show-favoriten" data-id="${id}" aria-label="${count} Favoriten">${count}</button>`
    : '';
  return `
    <div class="creator-favorit">
      <button type="button" class="creator-favorit__star${mine ? ' is-on' : ''}" data-action="toggle-favorit" data-id="${id}" aria-pressed="${mine ? 'true' : 'false'}" aria-label="${starLabel}">
        ${icon('star')}
      </button>
      ${countHtml}
    </div>
  `;
}

export function renderFavoritNamen(favoriten) {
  const buttons = (favoriten || []).map((entry) => `
    <button type="button" data-action="filter-favorit" data-user-id="${esc(entry.user_id)}">${esc(entry.name || 'Unbekannt')}</button>
  `).join('');
  return `<div class="creator-favorit__namen" role="list">${buttons}</div>`;
}

export async function ladeFavoritPersonen(supabase) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('benutzer')
    .select('auth_user_id, name, rolle')
    .in('rolle', ['admin', 'mitarbeiter'])
    .order('name');
  if (error) throw error;
  return (data || [])
    .filter((row) => row.auth_user_id && row.name)
    .map((row) => ({ value: row.auth_user_id, label: row.name }));
}

export async function ladeFavoriten(supabase, creatorIds) {
  const map = new Map();
  const ids = [...new Set((creatorIds || []).filter(Boolean))];
  if (!supabase || !ids.length) return map;
  const { data, error } = await supabase
    .from('creator_favoriten')
    .select('creator_id, user_id')
    .in('creator_id', ids);
  if (error) throw error;
  const userIds = [...new Set((data || []).map((row) => row.user_id).filter(Boolean))];
  let names = new Map();
  if (userIds.length) {
    const { data: people, error: nameError } = await supabase
      .from('benutzer')
      .select('auth_user_id, name')
      .in('auth_user_id', userIds);
    if (nameError) throw nameError;
    names = new Map((people || []).map((row) => [row.auth_user_id, row.name]));
  }
  for (const row of data || []) {
    const list = map.get(row.creator_id) || [];
    list.push({ user_id: row.user_id, name: names.get(row.user_id) || 'Unbekannt' });
    map.set(row.creator_id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }
  return map;
}

const FAVORIT_SEITE = 1000;

export async function ladeFavoritenAnzahl(supabase) {
  const counts = new Map();
  for (let from = 0; ; from += FAVORIT_SEITE) {
    const { data, error } = await supabase
      .from('creator_favoriten')
      .select('creator_id')
      .order('creator_id')
      .order('user_id')
      .range(from, from + FAVORIT_SEITE - 1);
    if (error) throw error;
    for (const row of data || []) counts.set(row.creator_id, (counts.get(row.creator_id) || 0) + 1);
    if (!data || data.length < FAVORIT_SEITE) break;
  }
  return counts;
}

export async function toggleFavorit(supabase, creatorId, favoriten) {
  const me = currentUserId();
  if (!me) throw new Error('Nicht angemeldet');
  const list = Array.isArray(favoriten) ? favoriten : [];
  const mine = list.some((entry) => entry.user_id === me);
  if (mine) {
    const { error } = await supabase
      .from('creator_favoriten')
      .delete()
      .eq('creator_id', creatorId)
      .eq('user_id', me);
    if (error) throw error;
    return list.filter((entry) => entry.user_id !== me);
  }
  const { error } = await supabase
    .from('creator_favoriten')
    .insert({ creator_id: creatorId });
  if (error) throw error;
  return [...list, { user_id: me, name: window.currentUser?.name || 'Unbekannt' }]
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
