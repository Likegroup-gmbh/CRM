// Optional: preloaded = { allTags: [{id,name}...], selectedTags: [{id,name}...] }
// Wenn übergeben, werden die beiden Supabase-Calls übersprungen (Edit-Fast-Path).
export async function setup(form, preloaded = null) {
  const MAX_TAGS = 7;
  const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

  const input = document.getElementById('koop_tag_input');
  const suggestionsDiv = document.getElementById('koop_tag_suggestions');
  const selectedContainer = document.getElementById('selected_koop_tags');
  if (!input || !suggestionsDiv || !selectedContainer) return;

  let allTags = [];
  let selectedTags = [];

  const normId = (id) => typeof id === 'string' ? id.toLowerCase().trim() : String(id);

  if (preloaded?.allTags) {
    allTags = preloaded.allTags.map(t => ({ ...t, id: normId(t.id) }));
  } else {
    try {
      const { data, error } = await window.supabase
        .from('kooperation_tag_typen')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) throw error;
      allTags = (data || []).map(t => ({ ...t, id: normId(t.id) }));
    } catch (err) {
      console.error('Fehler beim Laden der Kooperation-Tags:', err);
    }
  }

  const isEdit = !!form.dataset.entityId;
  if (isEdit) {
    if (preloaded?.selectedTags) {
      selectedTags = preloaded.selectedTags.map(t => ({ id: normId(t.id), name: t.name }));
    } else {
      try {
        const { data: existing, error } = await window.supabase
          .from('kooperation_tags')
          .select('tag_id, kooperation_tag_typen(id, name)')
          .eq('kooperation_id', form.dataset.entityId);
        if (error) {
          console.error('❌ Supabase-Fehler beim Laden bestehender Koop-Tags:', error);
        } else if (existing) {
          selectedTags = existing
            .filter(r => r.kooperation_tag_typen)
            .map(r => ({ id: normId(r.tag_id), name: r.kooperation_tag_typen.name }));
        }
      } catch (err) {
        console.warn('Fehler beim Laden bestehender Tags:', err);
      }
    }
  } else {
    const now = new Date();
    const monthName = MONTHS_DE[now.getMonth()];
    const yearStr = String(now.getFullYear());
    const monthTag = allTags.find(t => t.name === monthName);
    const yearTag = allTags.find(t => t.name === yearStr);
    if (monthTag) selectedTags.push({ id: monthTag.id, name: monthTag.name });
    if (yearTag) selectedTags.push({ id: yearTag.id, name: yearTag.name });
  }

  const renderSelected = () => {
    selectedContainer.innerHTML = selectedTags.map(t => `
      <span class="tag-item" data-id="${t.id}">
        ${t.name}
        <span class="tag-remove" data-id="${t.id}">&times;</span>
      </span>
    `).join('');
    selectedContainer.querySelectorAll('input[name="koop_tag_ids[]"]').forEach(el => el.remove());
    selectedTags.forEach(t => {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'koop_tag_ids[]';
      hidden.value = t.id;
      selectedContainer.appendChild(hidden);
    });
  };

  const showSuggestions = (filter) => {
    if (selectedTags.length >= MAX_TAGS) {
      suggestionsDiv.innerHTML = '<div class="suggestion-hint">Maximum von 7 Tags erreicht</div>';
      suggestionsDiv.style.display = 'block';
      return;
    }
    const lf = filter.toLowerCase();
    const selIds = selectedTags.map(t => t.id);
    const filtered = allTags.filter(t => !selIds.includes(t.id) && t.name.toLowerCase().includes(lf));

    let html = '';
    filtered.slice(0, 8).forEach(t => {
      html += `<div class="suggestion-item" data-id="${t.id}" data-name="${t.name}">${t.name}</div>`;
    });
    if (filter && !allTags.find(t => t.name.toLowerCase() === lf)) {
      html += `<div class="suggestion-item suggestion-item--new" data-name="${filter}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        "${filter}" neu anlegen
      </div>`;
    }
    if (!html) html = '<div class="suggestion-hint">Keine Vorschläge</div>';
    suggestionsDiv.innerHTML = html;
    suggestionsDiv.style.display = 'block';

    const newItem = suggestionsDiv.querySelector('.suggestion-item--new');
    if (newItem) {
      newItem.addEventListener('click', async () => {
        await addTag(filter);
        input.value = '';
        suggestionsDiv.style.display = 'none';
      });
    }
  };

  const addTag = async (name) => {
    if (selectedTags.length >= MAX_TAGS) return;
    const existing = allTags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selectedTags.find(t => t.id === existing.id)) {
        selectedTags.push({ id: existing.id, name: existing.name });
      }
    } else {
      try {
        const { data, error } = await window.supabase
          .from('kooperation_tag_typen')
          .upsert({ name: name.trim() }, { onConflict: 'name', ignoreDuplicates: true })
          .select()
          .single();
        if (error) throw error;
        const norm = { ...data, id: normId(data.id) };
        if (!allTags.find(t => t.id === norm.id)) allTags.push(norm);
        selectedTags.push({ id: norm.id, name: norm.name });
      } catch (err) {
        console.error('Fehler beim Anlegen des Tags:', err);
        return;
      }
    }
    renderSelected();
  };

  input.addEventListener('focus', () => showSuggestions(''));
  input.addEventListener('input', (e) => showSuggestions(e.target.value));
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value.trim();
      if (val && selectedTags.length < MAX_TAGS) {
        await addTag(val);
        input.value = '';
        showSuggestions('');
      }
    } else if (e.key === 'Escape') {
      suggestionsDiv.style.display = 'none';
    }
  });

  suggestionsDiv.addEventListener('click', async (e) => {
    const item = e.target.closest('.suggestion-item:not(.suggestion-item--new)');
    if (item && selectedTags.length < MAX_TAGS) {
      const id = normId(item.dataset.id);
      const name = item.dataset.name;
      if (!selectedTags.find(t => t.id === id)) {
        selectedTags.push({ id, name });
        renderSelected();
      }
      input.value = '';
      suggestionsDiv.style.display = 'none';
    }
  });

  selectedContainer.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.tag-remove');
    if (removeBtn) {
      const id = normId(removeBtn.dataset.id);
      selectedTags = selectedTags.filter(t => t.id !== id);
      renderSelected();
    }
  });

  document.addEventListener('click', (e) => {
    const container = document.getElementById('koop-tag-container');
    if (container && !container.contains(e.target)) {
      suggestionsDiv.style.display = 'none';
    }
  });

  renderSelected();
}
