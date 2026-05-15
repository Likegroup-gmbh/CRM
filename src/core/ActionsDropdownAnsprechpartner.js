// ActionsDropdownAnsprechpartner.js
// Alle Ansprechpartner-Modal-Methoden

export async function openAddAnsprechpartnerModal(dropdown, markeId) {
  let ansprechpartner = [];
  let excludedAnsprechpartnerIds = [];

  try {
    const { data: existing } = await window.supabase
      .from('ansprechpartner_marke')
      .select('ansprechpartner_id')
      .eq('marke_id', markeId);

    excludedAnsprechpartnerIds = (existing || []).map(r => r.ansprechpartner_id).filter(Boolean);

    let query = window.supabase
      .from('ansprechpartner')
      .select(`id, vorname, nachname, email, unternehmen:unternehmen_id(firmenname), position:position_id(name)`)
      .order('nachname');

    if (excludedAnsprechpartnerIds.length > 0) {
      query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
    }

    const { data } = await query;
    ansprechpartner = data || [];
  } catch (error) {
    console.warn('Fehler beim Laden der Ansprechpartner:', error);
  }

  const modal = document.createElement('div');
  modal.className = 'modal overlay-modal';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>Ansprechpartner zur Marke hinzufügen</h3>
        <button class="modal-close" id="add-ansprechpartner-close">×</button>
      </div>
      <div class="modal-body">
        <label class="form-label">Ansprechpartner wählen</label>
        <input type="text" id="ansprechpartner-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
        <div id="ansprechpartner-dropdown" class="auto-suggest-dropdown"></div>
      </div>
      <div class="modal-footer">
        <button class="mdc-btn mdc-btn--cancel" id="add-ansprechpartner-cancel">
          <span class="mdc-btn__icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          </span>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button class="mdc-btn mdc-btn--create" id="add-ansprechpartner-confirm" disabled>
          <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/></svg>
          </span>
          <span class="mdc-btn__spinner" aria-hidden="true">
            <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16"><circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/></svg>
          </span>
          <span class="mdc-btn__label">Hinzufügen</span>
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  const input = modal.querySelector('#ansprechpartner-search');
  const ddEl = modal.querySelector('#ansprechpartner-dropdown');
  let selectedId = null;

  const hydrateDropdown = (filter = '') => {
    if (!filter || filter.trim().length === 0) {
      ddEl.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
      return;
    }
    const f = filter.toLowerCase();
    const items = ansprechpartner.filter(ap => {
      const fullName = `${ap.vorname} ${ap.nachname}`.toLowerCase();
      const email = (ap.email || '').toLowerCase();
      const unternehmen = (ap.unternehmen?.firmenname || '').toLowerCase();
      return fullName.includes(f) || email.includes(f) || unternehmen.includes(f);
    });

    const s = window.validatorSystem?.sanitizeHtml?.bind(window.validatorSystem) || (x => x);
    ddEl.innerHTML = items.length
      ? items.map(ap => {
          const displayName = `${s(ap.vorname)} ${s(ap.nachname)}`;
          const details = [ap.email ? s(ap.email) : null, ap.unternehmen?.firmenname ? s(ap.unternehmen.firmenname) : null, ap.position?.name ? s(ap.position.name) : null].filter(Boolean).join(' • ');
          return `<div class="dropdown-item" data-id="${ap.id}"><div class="dropdown-item-main">${displayName}</div>${details ? `<div class="dropdown-item-details">${details}</div>` : ''}</div>`;
        }).join('')
      : '<div class="dropdown-item no-results">Keine verfügbaren Ansprechpartner gefunden</div>';
  };

  ddEl.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';

  input.addEventListener('focus', () => { if (input.value.trim().length > 0) ddEl.classList.add('show'); });
  input.addEventListener('blur', () => { setTimeout(() => ddEl.classList.remove('show'), 150); });

  let searchTimeout;
  input.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const term = e.target.value.trim();
      if (term.length < 1) { ddEl.classList.remove('show'); return; }
      try {
        let query = window.supabase
          .from('ansprechpartner')
          .select(`id, vorname, nachname, email, unternehmen:unternehmen_id(firmenname), position:position_id(name)`)
          .or(`vorname.ilike.%${term}%,nachname.ilike.%${term}%,email.ilike.%${term}%`)
          .order('nachname');
        if (excludedAnsprechpartnerIds.length > 0) {
          query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
        }
        const { data } = await query;
        ansprechpartner = data || [];
        hydrateDropdown(term);
        ddEl.classList.add('show');
      } catch (err) {
        console.warn('Ansprechpartner-Suche fehlgeschlagen', err);
      }
    }, 200);
  });

  ddEl.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item || item.classList.contains('no-results')) return;
    selectedId = item.dataset.id;
    const mainText = item.querySelector('.dropdown-item-main')?.textContent || item.textContent;
    input.value = mainText;
    modal.querySelector('#add-ansprechpartner-confirm').disabled = false;
    ddEl.classList.remove('show');
  });

  let handleEsc;
  const close = () => { document.removeEventListener('keydown', handleEsc); modal.remove(); };
  modal.querySelector('#add-ansprechpartner-close').onclick = close;
  modal.querySelector('#add-ansprechpartner-cancel').onclick = close;
  handleEsc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', handleEsc);

  modal.querySelector('#add-ansprechpartner-confirm').onclick = async () => {
    if (!selectedId) return;
    const btn = modal.querySelector('#add-ansprechpartner-confirm');
    btn.disabled = true;
    btn.classList.add('is-loading');
    try {
      const { error } = await window.supabase.from('ansprechpartner_marke').insert({ marke_id: markeId, ansprechpartner_id: selectedId });
      if (error) throw error;
      close();
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'ansprechpartner', action: 'added', markeId } }));
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'marke', action: 'ansprechpartner-added', id: markeId } }));
      alert('Ansprechpartner wurde erfolgreich zur Marke hinzugefügt und wird automatisch angezeigt!');
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Ansprechpartners:', error);
      alert('Fehler beim Hinzufügen: ' + (error.message || 'Unbekannter Fehler'));
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  };
}

export async function openAddAnsprechpartnerToUnternehmenModal(dropdown, unternehmenId) {
  let ansprechpartner = [];
  let excludedAnsprechpartnerIds = [];

  try {
    const { data: existing } = await window.supabase
      .from('ansprechpartner_unternehmen')
      .select('ansprechpartner_id')
      .eq('unternehmen_id', unternehmenId);
    excludedAnsprechpartnerIds = (existing || []).map(r => r.ansprechpartner_id).filter(Boolean);

    let query = window.supabase
      .from('ansprechpartner')
      .select(`id, vorname, nachname, email, unternehmen:unternehmen_id(firmenname), position:position_id(name)`)
      .order('nachname');
    if (excludedAnsprechpartnerIds.length > 0) {
      query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
    }
    const { data } = await query;
    ansprechpartner = data || [];
  } catch (error) {
    console.warn('Fehler beim Laden der Ansprechpartner:', error);
  }

  const modal = document.createElement('div');
  modal.className = 'modal overlay-modal';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>Ansprechpartner zum Unternehmen hinzufügen</h3>
        <button class="modal-close" id="add-ansprechpartner-unternehmen-close">×</button>
      </div>
      <div class="modal-body">
        <label class="form-label">Ansprechpartner wählen</label>
        <input type="text" id="ansprechpartner-unternehmen-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
        <div id="ansprechpartner-unternehmen-dropdown" class="auto-suggest-dropdown"></div>
      </div>
      <div class="modal-footer">
        <button class="mdc-btn mdc-btn--cancel" id="add-ansprechpartner-unternehmen-cancel">
          <span class="mdc-btn__icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          </span>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button class="mdc-btn mdc-btn--create" id="add-ansprechpartner-unternehmen-confirm" disabled>
          <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/></svg>
          </span>
          <span class="mdc-btn__spinner" aria-hidden="true">
            <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16"><circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/></svg>
          </span>
          <span class="mdc-btn__label">Hinzufügen</span>
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const input = modal.querySelector('#ansprechpartner-unternehmen-search');
  const ddEl = modal.querySelector('#ansprechpartner-unternehmen-dropdown');
  let selectedId = null;

  const hydrateDropdown = (filter = '') => {
    if (!filter || filter.trim().length === 0) {
      ddEl.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
      return;
    }
    const f = filter.toLowerCase();
    const items = ansprechpartner.filter(ap => {
      const fullName = `${ap.vorname} ${ap.nachname}`.toLowerCase();
      const email = (ap.email || '').toLowerCase();
      const unternehmen = (ap.unternehmen?.firmenname || '').toLowerCase();
      return fullName.includes(f) || email.includes(f) || unternehmen.includes(f);
    });
    const s = window.validatorSystem?.sanitizeHtml?.bind(window.validatorSystem) || (x => x);
    ddEl.innerHTML = items.length
      ? items.map(ap => {
          const displayName = `${s(ap.vorname)} ${s(ap.nachname)}`;
          const details = [ap.email ? s(ap.email) : null, ap.unternehmen?.firmenname ? s(ap.unternehmen.firmenname) : null, ap.position?.name ? s(ap.position.name) : null].filter(Boolean).join(' • ');
          return `<div class="dropdown-item" data-id="${ap.id}"><div class="dropdown-item-main">${displayName}</div>${details ? `<div class="dropdown-item-details">${details}</div>` : ''}</div>`;
        }).join('')
      : '<div class="dropdown-item no-results">Keine verfügbaren Ansprechpartner gefunden</div>';
  };

  ddEl.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
  input.addEventListener('focus', () => { if (input.value.trim().length > 0) ddEl.classList.add('show'); });
  input.addEventListener('blur', () => { setTimeout(() => ddEl.classList.remove('show'), 150); });

  let searchTimeout;
  input.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const term = e.target.value.trim();
      if (term.length < 1) { ddEl.classList.remove('show'); return; }
      try {
        let query = window.supabase
          .from('ansprechpartner')
          .select(`id, vorname, nachname, email, unternehmen:unternehmen_id(firmenname), position:position_id(name)`)
          .or(`vorname.ilike.%${term}%,nachname.ilike.%${term}%,email.ilike.%${term}%`)
          .order('nachname');
        if (excludedAnsprechpartnerIds.length > 0) {
          query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
        }
        const { data } = await query;
        ansprechpartner = data || [];
        hydrateDropdown(term);
        ddEl.classList.add('show');
      } catch (err) {
        console.warn('Ansprechpartner-Suche fehlgeschlagen', err);
      }
    }, 200);
  });

  ddEl.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item || item.classList.contains('no-results')) return;
    selectedId = item.dataset.id;
    const mainText = item.querySelector('.dropdown-item-main')?.textContent || item.textContent;
    input.value = mainText;
    modal.querySelector('#add-ansprechpartner-unternehmen-confirm').disabled = false;
    ddEl.classList.remove('show');
  });

  const handleEsc = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', handleEsc); document.body.removeChild(modal); };

  document.addEventListener('keydown', handleEsc);
  modal.querySelector('#add-ansprechpartner-unternehmen-close').onclick = close;
  modal.querySelector('#add-ansprechpartner-unternehmen-cancel').onclick = close;

  modal.querySelector('#add-ansprechpartner-unternehmen-confirm').onclick = async () => {
    if (!selectedId) return;
    const btn = modal.querySelector('#add-ansprechpartner-unternehmen-confirm');
    btn.disabled = true;
    btn.classList.add('is-loading');
    try {
      const { error } = await window.supabase.from('ansprechpartner_unternehmen').insert([{ ansprechpartner_id: selectedId, unternehmen_id: unternehmenId }]);
      if (error) throw error;
      close();
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'ansprechpartner', action: 'added', unternehmenId } }));
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'unternehmen', action: 'ansprechpartner-added', id: unternehmenId } }));
      alert('Ansprechpartner wurde erfolgreich zum Unternehmen hinzugefügt und wird automatisch angezeigt!');
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Ansprechpartners:', error);
      alert('Fehler beim Hinzufügen: ' + (error.message || 'Unbekannter Fehler'));
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  };
}

export async function openRemoveAnsprechpartnerFromUnternehmenModal(dropdown, unternehmenId) {
  let ansprechpartner = [];

  try {
    const { data } = await window.supabase
      .from('ansprechpartner_unternehmen')
      .select(`ansprechpartner_id, ansprechpartner:ansprechpartner_id (id, vorname, nachname, email, telefonnummer, position:position_id(name), unternehmen:unternehmen_id(firmenname))`)
      .eq('unternehmen_id', unternehmenId);
    ansprechpartner = (data || []).filter(r => r.ansprechpartner).map(r => r.ansprechpartner);
  } catch (error) {
    console.warn('Fehler beim Laden der Ansprechpartner:', error);
  }

  if (ansprechpartner.length === 0) {
    alert('Diesem Unternehmen sind noch keine Ansprechpartner zugeordnet.');
    return;
  }

  const s = window.validatorSystem?.sanitizeHtml?.bind(window.validatorSystem) || (x => x);
  const tableRows = ansprechpartner.map(ap => `
    <tr>
      <td><input type="checkbox" class="ansprechpartner-remove-check" data-id="${ap.id}" /></td>
      <td>
        <a href="#" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${ap.id}')" class="table-link">
          ${s(ap.vorname)} ${s(ap.nachname)}
        </a>
      </td>
      <td>${s(ap.email || '-')}</td>
      <td>${s(ap.telefonnummer || '-')}</td>
      <td>${s(ap.position?.name || '-')}</td>
      <td>
        <button class="btn-remove-single danger-btn" data-id="${ap.id}" title="Einzeln entfernen">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </td>
    </tr>`).join('');

  const modal = document.createElement('div');
  modal.className = 'modal overlay-modal modal-large';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>Ansprechpartner vom Unternehmen entfernen</h3>
        <button class="modal-close" id="remove-ansprechpartner-unternehmen-close">×</button>
      </div>
      <div class="modal-body">
        <p class="modal-description">Wählen Sie die Ansprechpartner aus, die Sie vom Unternehmen entfernen möchten:</p>
        <div class="bulk-actions">
          <button id="select-all-ansprechpartner" class="secondary-btn">Alle auswählen</button>
          <button id="deselect-all-ansprechpartner" class="secondary-btn">Auswahl aufheben</button>
          <span class="selected-count">0 ausgewählt</span>
        </div>
        <div class="data-table-container">
          <table class="data-table">
            <thead><tr>
              <th width="40"><input type="checkbox" id="select-all-header" /></th>
              <th>Name</th><th>E-Mail</th><th>Telefon</th><th>Position</th><th width="80">Aktion</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="mdc-btn mdc-btn--cancel" id="remove-ansprechpartner-unternehmen-cancel">
          <span class="mdc-btn__icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          </span>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button class="danger-btn" id="remove-selected-ansprechpartner" disabled>Ausgewählte entfernen</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const checkboxes = modal.querySelectorAll('.ansprechpartner-remove-check');
  const selectAllHeader = modal.querySelector('#select-all-header');
  const selectAllBtn = modal.querySelector('#select-all-ansprechpartner');
  const deselectAllBtn = modal.querySelector('#deselect-all-ansprechpartner');
  const selectedCountSpan = modal.querySelector('.selected-count');
  const removeSelectedBtn = modal.querySelector('#remove-selected-ansprechpartner');

  const updateSelection = () => {
    const selected = modal.querySelectorAll('.ansprechpartner-remove-check:checked');
    const count = selected.length;
    selectedCountSpan.textContent = `${count} ausgewählt`;
    removeSelectedBtn.disabled = count === 0;
    if (count === 0) { selectAllHeader.checked = false; selectAllHeader.indeterminate = false; }
    else if (count === checkboxes.length) { selectAllHeader.checked = true; selectAllHeader.indeterminate = false; }
    else { selectAllHeader.checked = false; selectAllHeader.indeterminate = true; }
  };

  checkboxes.forEach(cb => cb.addEventListener('change', updateSelection));
  selectAllHeader.addEventListener('change', () => { checkboxes.forEach(cb => { cb.checked = selectAllHeader.checked; }); updateSelection(); });
  selectAllBtn.addEventListener('click', () => { checkboxes.forEach(cb => { cb.checked = true; }); updateSelection(); });
  deselectAllBtn.addEventListener('click', () => { checkboxes.forEach(cb => { cb.checked = false; }); updateSelection(); });

  modal.querySelectorAll('.btn-remove-single').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const apId = e.target.closest('.btn-remove-single').dataset.id;
      const ap = ansprechpartner.find(a => a.id === apId);
      const name = ap ? `${ap.vorname} ${ap.nachname}` : 'Ansprechpartner';
      let proceed = false;
      const msg = `Möchten Sie ${name} wirklich vom Unternehmen entfernen?`;
      if (window.confirmationModal) {
        const res = await window.confirmationModal.open({ title: 'Entfernen bestätigen', message: msg, confirmText: 'Entfernen', cancelText: 'Abbrechen', danger: true });
        proceed = !!res?.confirmed;
      } else {
        proceed = confirm(msg);
      }
      if (!proceed) return;
      await removeAnsprechpartnerFromUnternehmen(apId, unternehmenId);
      e.target.closest('tr').remove();
      updateSelection();
      if (modal.querySelectorAll('tbody tr').length === 0) close();
    });
  });

  removeSelectedBtn.addEventListener('click', async () => {
    const selectedIds = Array.from(modal.querySelectorAll('.ansprechpartner-remove-check:checked')).map(cb => cb.dataset.id);
    if (selectedIds.length === 0) return;

    let proceed = false;
    const msg = `Möchten Sie wirklich ${selectedIds.length} Ansprechpartner vom Unternehmen entfernen?`;
    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({ title: 'Entfernen bestätigen', message: msg, confirmText: 'Entfernen', cancelText: 'Abbrechen', danger: true });
      proceed = !!res?.confirmed;
    } else {
      proceed = confirm(msg);
    }
    if (!proceed) return;

    let successCount = 0;
    let errorCount = 0;
    for (const apId of selectedIds) {
      try {
        await removeAnsprechpartnerFromUnternehmen(apId, unternehmenId);
        successCount++;
        const checkbox = modal.querySelector(`.ansprechpartner-remove-check[data-id="${apId}"]`);
        if (checkbox) checkbox.closest('tr').remove();
      } catch {
        errorCount++;
      }
    }

    let message = '';
    if (successCount > 0) message += `${successCount} Ansprechpartner erfolgreich entfernt.`;
    if (errorCount > 0) message += `\n${errorCount} Ansprechpartner konnten nicht entfernt werden.`;
    alert(message);
    updateSelection();
    if (modal.querySelectorAll('tbody tr').length === 0) close();
  });

  const handleEsc = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', handleEsc); document.body.removeChild(modal); };
  document.addEventListener('keydown', handleEsc);
  modal.querySelector('#remove-ansprechpartner-unternehmen-close').onclick = close;
  modal.querySelector('#remove-ansprechpartner-unternehmen-cancel').onclick = close;
  updateSelection();
}

export async function removeAnsprechpartnerFromUnternehmen(ansprechpartnerId, unternehmenId) {
  const { error } = await window.supabase
    .from('ansprechpartner_unternehmen')
    .delete()
    .eq('ansprechpartner_id', ansprechpartnerId)
    .eq('unternehmen_id', unternehmenId);

  if (error) throw error;

  window.dispatchEvent(new CustomEvent('entityUpdated', {
    detail: { entity: 'ansprechpartner', action: 'removed', unternehmenId }
  }));
  return true;
}
