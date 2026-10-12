// Creator-Tags: eigene Liste, dieselbe Eingabe wie bei der Kooperation.
// Höchstens sieben. Kreuz am Tag löst ihn vom Creator, Kreuz in der Liste löscht ihn.

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml } from '../../core/format.js';

export const MAX_CREATOR_TAGS = 7;

function esc(value) {
  return escapeHtml(String(value ?? ''));
}

export function renderTagZeile(tags) {
  const chips = (tags || []).map((tag) => {
    const name = typeof tag === 'string' ? tag : tag.name;
    return `<span class="tag" data-creator-tag>${esc(name)}</span>`;
  }).join('');
  if (!chips) return '';
  return `
    <div class="creator-tagzeile">
      ${chips}
      <span class="creator-tagzeile__more" data-creator-tag-more hidden></span>
    </div>
  `;
}

export function passeTagZeile(root) {
  if (!root) return;
  const chips = [...root.querySelectorAll('[data-creator-tag]')];
  const more = root.querySelector('[data-creator-tag-more]');
  if (!chips.length || !more) return;
  chips.forEach((chip) => { chip.hidden = false; });
  more.hidden = true;
  if (root.scrollWidth <= root.clientWidth + 1) return;
  let hidden = 0;
  for (let i = chips.length - 1; i >= 0; i -= 1) {
    chips[i].hidden = true;
    hidden += 1;
    more.hidden = false;
    more.textContent = `+${hidden}`;
    if (root.scrollWidth <= root.clientWidth + 1) break;
  }
}

export function passeTagZeilen(container) {
  container?.querySelectorAll('.creator-tagzeile').forEach((row) => passeTagZeile(row));
}

export async function ladeCreatorTags(supabase, creatorIds) {
  const map = new Map();
  const ids = [...new Set((creatorIds || []).filter(Boolean))];
  if (!supabase || !ids.length) return map;
  const { data: links, error } = await supabase
    .from('creator_tags')
    .select('creator_id, tag_id')
    .in('creator_id', ids);
  if (error) throw error;
  const tagIds = [...new Set((links || []).map((row) => row.tag_id).filter(Boolean))];
  let names = new Map();
  if (tagIds.length) {
    const { data: typen, error: typError } = await supabase
      .from('creator_tag_typen')
      .select('id, name')
      .in('id', tagIds);
    if (typError) throw typError;
    names = new Map((typen || []).map((row) => [row.id, row.name]));
  }
  for (const row of links || []) {
    const name = names.get(row.tag_id);
    if (!name) continue;
    const list = map.get(row.creator_id) || [];
    list.push({ id: row.tag_id, name });
    map.set(row.creator_id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }
  return map;
}

export function mountCreatorTagEditor(host, { creatorId, onChange, signal } = {}) {
  if (!host || !creatorId || !window.supabase) return;
  host.innerHTML = `
    <div class="tag-based-select">
      <div class="creator-tag-selected"></div>
      <input type="text" class="tag-input" placeholder="Tag suchen oder anlegen..." autocomplete="off">
      <div class="tag-suggestions creator-tag-suggestions" style="display:none"></div>
    </div>
  `;
  const selectedContainer = host.querySelector('.creator-tag-selected');
  const input = host.querySelector('.tag-input');
  const suggestionsDiv = host.querySelector('.creator-tag-suggestions');
  let allTags = [];
  let selectedTags = [];
  let deleting = false;

  const notify = () => onChange?.(selectedTags.map((tag) => ({ ...tag })));

  const renderSelected = () => {
    selectedContainer.innerHTML = selectedTags.map((tag) => `
      <span class="tag-item" data-id="${esc(tag.id)}">
        ${esc(tag.name)}
        <button type="button" class="tag-remove" data-id="${esc(tag.id)}" aria-label="Tag ${esc(tag.name)} entfernen">&times;</button>
      </span>
    `).join('');
  };

  const showSuggestions = (filter) => {
    if (selectedTags.length >= MAX_CREATOR_TAGS) {
      suggestionsDiv.innerHTML = '<div class="suggestion-hint">Maximum von 7 Tags erreicht</div>';
      suggestionsDiv.style.display = 'block';
      return;
    }
    const term = String(filter || '').trim().toLowerCase();
    const selectedIds = new Set(selectedTags.map((tag) => tag.id));
    const matches = allTags.filter((tag) => !selectedIds.has(tag.id) && tag.name.toLowerCase().includes(term));
    let html = matches.map((tag) => `
      <div class="suggestion-item" data-id="${esc(tag.id)}" data-name="${esc(tag.name)}">
        <span class="suggestion-item-name">${esc(tag.name)}</span>
        <button type="button" class="suggestion-item-remove" data-id="${esc(tag.id)}" aria-label="Tag ${esc(tag.name)} löschen">&times;</button>
      </div>
    `).join('');
    if (term && !allTags.some((tag) => tag.name.toLowerCase() === term)) {
      html += `<div class="suggestion-item suggestion-item--new" data-name="${esc(filter.trim())}">${icon('plus-lg')}"${esc(filter.trim())}" neu anlegen</div>`;
    }
    if (!html) html = '<div class="suggestion-hint">Keine Vorschläge</div>';
    suggestionsDiv.innerHTML = html;
    suggestionsDiv.style.display = 'block';
  };

  const persistAdd = async (name) => {
    if (selectedTags.length >= MAX_CREATOR_TAGS) return;
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    const existing = allTags.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());
    let tag = existing;
    if (!tag) {
      const { data, error } = await window.supabase
        .from('creator_tag_typen')
        .insert({ name: trimmed })
        .select('id, name')
        .single();
      if (error) throw error;
      tag = data;
      allTags.push(tag);
      allTags.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }
    if (selectedTags.some((entry) => entry.id === tag.id)) return;
    const { error } = await window.supabase
      .from('creator_tags')
      .insert({ creator_id: creatorId, tag_id: tag.id });
    if (error) throw error;
    selectedTags.push({ id: tag.id, name: tag.name });
    selectedTags.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    renderSelected();
    notify();
  };

  const persistRemove = async (tagId) => {
    const { error } = await window.supabase
      .from('creator_tags')
      .delete()
      .eq('creator_id', creatorId)
      .eq('tag_id', tagId);
    if (error) throw error;
    selectedTags = selectedTags.filter((tag) => tag.id !== tagId);
    renderSelected();
    notify();
  };

  const deleteCatalog = async (tagId) => {
    if (deleting) return;
    const tag = allTags.find((entry) => entry.id === tagId);
    if (!tag) return;
    deleting = true;
    try {
      const { count, error: countError } = await window.supabase
        .from('creator_tags')
        .select('creator_id', { count: 'exact', head: true })
        .eq('tag_id', tagId);
      if (countError) throw countError;
      const usedBy = count || 0;
      if (usedBy > 0) {
        const result = await window.confirmationModal?.open({
          title: 'Tag löschen',
          message: `„${tag.name}“ wird von ${usedBy === 1 ? '1 Creator' : `${usedBy} Creatoren`} genutzt. Der Tag wird dort entfernt und gelöscht.`,
          confirmText: 'Trotzdem löschen',
          cancelText: 'Abbrechen',
          danger: true
        });
        if (!result?.confirmed) {
          showSuggestions(input.value.trim());
          return;
        }
      }
      const { error } = await window.supabase.from('creator_tag_typen').delete().eq('id', tagId);
      if (error) throw error;
      allTags = allTags.filter((entry) => entry.id !== tagId);
      selectedTags = selectedTags.filter((entry) => entry.id !== tagId);
      renderSelected();
      notify();
      showSuggestions(input.value.trim());
    } finally {
      deleting = false;
    }
  };

  input.addEventListener('focus', () => showSuggestions(input.value.trim()), { signal });
  input.addEventListener('input', () => showSuggestions(input.value.trim()), { signal });
  input.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') {
      if (event.key === 'Escape') suggestionsDiv.style.display = 'none';
      return;
    }
    event.preventDefault();
    try {
      await persistAdd(input.value);
      input.value = '';
      suggestionsDiv.style.display = 'none';
    } catch (error) {
      console.error('Creator-Tag konnte nicht angelegt werden', error);
      window.toastSystem?.show('Tag konnte nicht angelegt werden', 'error');
    }
  }, { signal });

  suggestionsDiv.addEventListener('click', async (event) => {
    const removeBtn = event.target.closest('.suggestion-item-remove');
    if (removeBtn) {
      event.preventDefault();
      event.stopPropagation();
      try {
        await deleteCatalog(removeBtn.dataset.id);
      } catch (error) {
        console.error('Creator-Tag konnte nicht gelöscht werden', error);
        window.toastSystem?.show('Tag konnte nicht gelöscht werden', 'error');
      }
      return;
    }
    const neu = event.target.closest('.suggestion-item--new');
    const item = event.target.closest('.suggestion-item');
    if (!item) return;
    try {
      await persistAdd(neu ? neu.dataset.name : item.dataset.name);
      input.value = '';
      suggestionsDiv.style.display = 'none';
    } catch (error) {
      console.error('Creator-Tag konnte nicht gesetzt werden', error);
      window.toastSystem?.show('Tag konnte nicht gesetzt werden', 'error');
    }
  }, { signal });

  selectedContainer.addEventListener('click', async (event) => {
    const removeBtn = event.target.closest('.tag-remove');
    if (!removeBtn) return;
    try {
      await persistRemove(removeBtn.dataset.id);
    } catch (error) {
      console.error('Creator-Tag konnte nicht entfernt werden', error);
      window.toastSystem?.show('Tag konnte nicht entfernt werden', 'error');
    }
  }, { signal });

  host.addEventListener('focusout', (event) => {
    if (!host.contains(event.relatedTarget)) suggestionsDiv.style.display = 'none';
  }, { signal });

  (async () => {
    try {
      const [{ data: typen, error: typError }, tags] = await Promise.all([
        window.supabase.from('creator_tag_typen').select('id, name').order('name'),
        ladeCreatorTags(window.supabase, [creatorId])
      ]);
      if (typError) throw typError;
      allTags = typen || [];
      selectedTags = tags.get(creatorId) || [];
      renderSelected();
    } catch (error) {
      console.warn('Creator-Tags konnten nicht geladen werden', error);
    }
  })();
}
