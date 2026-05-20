// MitarbeiterDetailModals.js
// Modale Dialoge: Rolle ändern, Unternehmen zuordnen

export async function showChangeRolleModal(detail) {
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

  const modal = document.createElement('div');
  modal.className = 'modal-overlay role-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Mitarbeiter-Rolle ändern</h3>
        <button id="close-modal" class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Rolle / Klasse</label>
          <p class="form-help" style="margin-bottom: 10px;">Definiert die Hauptaufgaben und Zuständigkeiten des Mitarbeiters</p>
          <input id="rolle-search" class="form-input" type="text" placeholder="Rolle suchen..." autocomplete="off" />
          <div id="rolle-dropdown" class="auto-suggest-dropdown" style="display: none;"></div>
        </div>
        <div id="selected-rolle" class="selected-items" style="margin-top: 10px;"></div>
      </div>
      <div class="modal-footer">
        <button id="cancel-rolle" class="mdc-btn mdc-btn--cancel">
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button id="save-rolle" class="mdc-btn mdc-btn--create" disabled>
          <span class="mdc-btn__label">Speichern</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const input = modal.querySelector('#rolle-search');
  const dropdown = modal.querySelector('#rolle-dropdown');
  const selectedContainer = modal.querySelector('#selected-rolle');
  const saveBtn = modal.querySelector('#save-rolle');
  let selectedRolle = null;
  let searchTimeout;
  let allRollen = [];

  try {
    const { data, error } = await window.supabase
      .from('mitarbeiter_klasse')
      .select('id, name, description')
      .order('sort_order')
      .order('name');

    if (error) throw error;
    allRollen = data || [];
  } catch (err) {
    console.error('Fehler beim Laden der Rollen', err);
    modal.remove();
    return;
  }

  const renderSelectedRolle = (rolle) => {
    if (!rolle) {
      selectedContainer.innerHTML = '';
      saveBtn.disabled = true;
      return;
    }

    selectedContainer.innerHTML = `
      <div class="selected-item">
        <span class="item-name">${window.validatorSystem.sanitizeHtml(rolle.name)}</span>
        <button type="button" class="remove-item" aria-label="Auswahl entfernen">&times;</button>
      </div>
    `;
    saveBtn.disabled = false;
  };

  const currentKlasseId = detail.user?.mitarbeiter_klasse_id || detail.user?.mitarbeiter_klasse?.id;
  if (currentKlasseId) {
    const match = allRollen.find(r => r.id === currentKlasseId);
    if (match) {
      selectedRolle = { id: match.id, name: match.name };
      renderSelectedRolle(selectedRolle);
    }
  }

  input.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = e.target.value.trim().toLowerCase();

      if (query.length === 0) {
        displayRollen(allRollen);
      } else if (query.length < 2) {
        dropdown.style.display = 'none';
      } else {
        const filtered = allRollen.filter(r =>
          r.name.toLowerCase().includes(query) ||
          (r.description && r.description.toLowerCase().includes(query))
        );
        displayRollen(filtered);
      }
    }, 150);
  });

  function displayRollen(rollen) {
    if (rollen.length > 0) {
      dropdown.innerHTML = rollen.map(r => `
        <div class="dropdown-item" data-id="${r.id}" data-name="${r.name}">
          <div class="dropdown-item-main">${window.validatorSystem.sanitizeHtml(r.name)}</div>
          ${r.description ? `<div class="dropdown-item-sub">${window.validatorSystem.sanitizeHtml(r.description)}</div>` : ''}
        </div>
      `).join('');
      dropdown.style.display = 'block';
    } else {
      dropdown.innerHTML = '<div class="dropdown-item no-results">Keine Rolle gefunden</div>';
      dropdown.style.display = 'block';
    }
  }

  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item[data-id]');
    if (!item) return;
    selectedRolle = { id: item.dataset.id, name: item.dataset.name };
    renderSelectedRolle(selectedRolle);
    input.value = '';
    dropdown.style.display = 'none';
  });

  selectedContainer.addEventListener('click', (e) => {
    if (e.target.closest('.remove-item') || e.target.closest('.selected-item-remove')) {
      selectedRolle = null;
      renderSelectedRolle(null);
    }
  });

  saveBtn.addEventListener('click', async () => {
    if (!selectedRolle) return;
    try {
      const { error } = await window.supabase
        .from('benutzer')
        .update({ mitarbeiter_klasse_id: selectedRolle.id })
        .eq('id', detail.userId);
      if (error) throw error;
      modal.remove();
      await detail.load();
      await detail.render();
      detail.bind();
    } catch (err) {
      console.error('Rolle ändern fehlgeschlagen', err);
    }
  });

  const closeModal = () => modal.remove();
  modal.querySelector('#close-modal').onclick = closeModal;
  modal.querySelector('#cancel-rolle').onclick = closeModal;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  setTimeout(() => input.focus(), 100);
}

export async function showAddUnternehmenModal(detail) {
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h3>Unternehmen zuordnen</h3>
        <button id="close-modal" class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Unternehmen suchen</label>
          <input id="unternehmen-search" class="form-input" type="text" placeholder="Firmenname eingeben..." autocomplete="off" />
          <div id="unternehmen-dropdown" class="auto-suggest-dropdown" style="display: none;"></div>
        </div>
        <div id="selected-unternehmen" class="selected-items" style="margin-top: 10px;"></div>
        
        <div class="form-group" style="margin-top: 16px;">
          <label class="form-label">Rolle</label>
          <select id="role-select" class="form-select">
            <option value="mitarbeiter">Mitarbeiter</option>
            <option value="lead_mitarbeiter">Lead Mitarbeiter</option>
            <option value="management">Management</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button id="cancel-zuordnung" class="mdc-btn mdc-btn--cancel">
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button id="save-zuordnung" class="mdc-btn mdc-btn--create" disabled>
          <span class="mdc-btn__label">Zuordnen</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const input = modal.querySelector('#unternehmen-search');
  const dropdown = modal.querySelector('#unternehmen-dropdown');
  const selectedContainer = modal.querySelector('#selected-unternehmen');
  const saveBtn = modal.querySelector('#save-zuordnung');
  let selectedUnternehmen = null;
  let searchTimeout;

  input.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const query = e.target.value.trim();
      if (query.length < 2) {
        dropdown.style.display = 'none';
        return;
      }
      try {
        const { data, error } = await window.supabase
          .from('unternehmen')
          .select('id, firmenname')
          .ilike('firmenname', `%${query}%`)
          .order('firmenname')
          .limit(10);
        if (error) throw error;
        if (data && data.length > 0) {
          dropdown.innerHTML = data.map(u => `
            <div class="dropdown-item" data-id="${u.id}" data-name="${u.firmenname}">
              <div class="dropdown-item-main">${window.validatorSystem.sanitizeHtml(u.firmenname)}</div>
            </div>
          `).join('');
          dropdown.style.display = 'block';
        } else {
          dropdown.innerHTML = '<div class="dropdown-item no-results">Keine Unternehmen gefunden</div>';
          dropdown.style.display = 'block';
        }
      } catch (err) {
        console.error('Unternehmen-Suche fehlgeschlagen', err);
        dropdown.innerHTML = '<div class="dropdown-item no-results">Fehler bei der Suche</div>';
        dropdown.style.display = 'block';
      }
    }, 300);
  });

  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item[data-id]');
    if (!item) return;
    selectedUnternehmen = { id: item.dataset.id, name: item.dataset.name };
    selectedContainer.innerHTML = `
      <div class="tag">
        <span>${window.validatorSystem.sanitizeHtml(selectedUnternehmen.name)}</span>
        <span class="tag-remove">\u00d7</span>
      </div>
    `;
    input.value = '';
    dropdown.style.display = 'none';
    saveBtn.disabled = false;
  });

  selectedContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('tag-remove')) {
      selectedUnternehmen = null;
      selectedContainer.innerHTML = '';
      saveBtn.disabled = true;
    }
  });

  saveBtn.addEventListener('click', async () => {
    if (!selectedUnternehmen) return;
    const selectedRole = modal.querySelector('#role-select').value;
    try {
      const { error } = await window.supabase
        .from('mitarbeiter_unternehmen')
        .insert({
          mitarbeiter_id: detail.userId,
          unternehmen_id: selectedUnternehmen.id,
          role: selectedRole
        });
      if (error) {
        if (error.code === '23505') { modal.remove(); return; }
        throw error;
      }
      modal.remove();
      await detail.load();
      await detail.render();
      detail.bind();
    } catch (err) {
      console.error('Zuordnung fehlgeschlagen', err);
    }
  });

  const closeModal = () => modal.remove();
  modal.querySelector('#close-modal').onclick = closeModal;
  modal.querySelector('#cancel-zuordnung').onclick = closeModal;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  setTimeout(() => input.focus(), 100);
}
