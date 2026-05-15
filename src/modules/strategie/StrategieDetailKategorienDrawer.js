// StrategieDetailKategorienDrawer.js
// Kategorien-Verwaltung (CRUD, Inline-Edit, Drawer-Lifecycle)

import { strategieService } from './StrategieService.js';

const DRAWER_ID = 'kategorien-drawer';

export function renderKategorienDrawerBody(detail) {
  const teilbereiche = detail.getTeilbereicheFromStrategie();
  
  return `
    <div class="kategorien-list" id="kategorien-list">
      ${teilbereiche.length > 0 ? teilbereiche.map(tb => `
        <div class="kategorie-item" data-kategorie="${tb}">
          <span class="kategorie-name">${tb}</span>
          <button type="button" class="kategorie-delete-btn" data-action="edit-kategorie" data-kategorie="${tb}" title="Kategorie bearbeiten">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 3.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 15.07a4.5 4.5 0 0 1-1.897 1.13L6 17l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931ZM19.5 7.125 16.875 4.5" /></svg>
          </button>
          <button type="button" class="kategorie-delete-btn" data-action="delete-kategorie" data-kategorie="${tb}" title="Kategorie löschen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
      `).join('') : '<p class="no-kategorien">Keine Kategorien vorhanden</p>'}
    </div>
    <div class="kategorie-add-form">
      <input type="text" id="new-kategorie-input" class="form-input" placeholder="Neue Kategorie...">
      <button type="button" class="primary-btn" id="btn-add-kategorie">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Hinzufügen
      </button>
    </div>
  `;
}

export function showKategorienModal(detail) {
  removeKategorienDrawer();
  
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = `${DRAWER_ID}-overlay`;
  
  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'drawer-panel';
  panel.id = DRAWER_ID;

  const header = document.createElement('div');
  header.className = 'drawer-header';
  
  const headerLeft = document.createElement('div');
  const title = document.createElement('span');
  title.className = 'drawer-title';
  title.textContent = 'Kategorien verwalten';
  
  const subtitle = document.createElement('p');
  subtitle.className = 'drawer-subtitle';
  subtitle.textContent = 'Kategorien hinzufügen oder entfernen';
  
  headerLeft.appendChild(title);
  headerLeft.appendChild(subtitle);
  
  const headerRight = document.createElement('div');
  const closeBtn = document.createElement('button');
  closeBtn.className = 'drawer-close-btn';
  closeBtn.setAttribute('type', 'button');
  closeBtn.setAttribute('aria-label', 'Schließen');
  closeBtn.innerHTML = '&times;';
  headerRight.appendChild(closeBtn);
  
  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  const body = document.createElement('div');
  body.className = 'drawer-body';
  body.id = `${DRAWER_ID}-body`;
  body.innerHTML = renderKategorienDrawerBody(detail);

  panel.appendChild(header);
  panel.appendChild(body);

  overlay.addEventListener('click', () => closeKategorienModal());
  closeBtn.addEventListener('click', () => closeKategorienModal());

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  requestAnimationFrame(() => {
    panel.classList.add('show');
  });
  
  bindKategorienDrawerEvents(detail);
}

export function bindKategorienDrawerEvents(detail) {
  const addBtn = document.getElementById('btn-add-kategorie');
  const input = document.getElementById('new-kategorie-input');
  
  const addHandler = () => handleAddKategorie(detail);
  addBtn?.addEventListener('click', addHandler);
  input?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addHandler();
    }
  });
  
  document.querySelectorAll('[data-action="edit-kategorie"]').forEach(btn => {
    btn.addEventListener('click', () => startInlineEdit(detail, btn.dataset.kategorie));
  });

  document.querySelectorAll('[data-action="delete-kategorie"]').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteKategorie(detail, btn.dataset.kategorie));
  });
  
  input?.focus();
}

export function removeKategorienDrawer() {
  document.getElementById(`${DRAWER_ID}-overlay`)?.remove();
  document.getElementById(DRAWER_ID)?.remove();
}

export function closeKategorienModal() {
  const panel = document.getElementById(DRAWER_ID);
  
  if (panel) {
    panel.classList.remove('show');
    setTimeout(() => {
      removeKategorienDrawer();
    }, 300);
  } else {
    removeKategorienDrawer();
  }
}

async function handleAddKategorie(detail) {
  const input = document.getElementById('new-kategorie-input');
  const newKategorie = input?.value?.trim();
  
  if (!newKategorie) {
    window.toastSystem?.show('Bitte Kategorie-Name eingeben', 'warning');
    return;
  }
  
  const existingKategorien = detail.getTeilbereicheFromStrategie();
  if (existingKategorien.includes(newKategorie)) {
    window.toastSystem?.show('Diese Kategorie existiert bereits', 'warning');
    return;
  }
  
  try {
    const updatedKategorien = [...existingKategorien, newKategorie];
    const teilbereichString = updatedKategorien.join(', ');
    
    await strategieService.updateStrategie(detail.strategieId, { teilbereich: teilbereichString });
    
    detail.strategie.teilbereich = teilbereichString;
    
    rerenderKategorienDrawerBody(detail);
    
    window.toastSystem?.show(`Kategorie "${newKategorie}" hinzugefügt`, 'success');
  } catch (error) {
    console.error('Fehler beim Hinzufügen der Kategorie:', error);
    window.toastSystem?.show('Fehler beim Hinzufügen der Kategorie', 'error');
  }
}

function startInlineEdit(detail, kategorie) {
  const row = document.querySelector(`.kategorie-item[data-kategorie="${kategorie}"]`);
  if (!row) return;

  const checkSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>';
  const cancelSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>';

  row.innerHTML = `
    <input type="text" class="form-input" value="${kategorie}" data-edit-kategorie="${kategorie}">
    <button type="button" class="kategorie-delete-btn" data-action="save-kategorie" title="Speichern">${checkSvg}</button>
    <button type="button" class="kategorie-delete-btn" data-action="cancel-edit" title="Abbrechen">${cancelSvg}</button>
  `;

  const input = row.querySelector('input');
  input.focus();
  input.select();

  let saving = false;

  const save = async () => {
    if (saving) return;
    saving = true;
    await handleRenameKategorie(detail, kategorie, input.value);
  };

  const cancel = () => {
    rerenderKategorienDrawerBody(detail);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });

  row.querySelector('[data-action="save-kategorie"]').addEventListener('click', save);
  row.querySelector('[data-action="cancel-edit"]').addEventListener('click', cancel);
}

async function handleRenameKategorie(detail, oldKategorie, newKategorieInput) {
  const newKategorie = newKategorieInput?.trim();

  if (!newKategorie) {
    window.toastSystem?.show('Bitte Kategorie-Name eingeben', 'warning');
    return;
  }

  if (newKategorie.includes(',')) {
    window.toastSystem?.show('Kommas sind im Kategorienamen nicht erlaubt', 'warning');
    return;
  }

  const oldKategorieNormalized = oldKategorie?.trim().toLowerCase();
  const newKategorieNormalized = newKategorie.toLowerCase();
  const existingKategorien = detail.getTeilbereicheFromStrategie();

  const hasDuplicate = existingKategorien.some(k => (
    k.trim().toLowerCase() === newKategorieNormalized &&
    k.trim().toLowerCase() !== oldKategorieNormalized
  ));

  if (hasDuplicate) {
    window.toastSystem?.show('Diese Kategorie existiert bereits', 'warning');
    return;
  }

  const unchangedName = newKategorieNormalized === oldKategorieNormalized;
  if (unchangedName) return;

  try {
    const updatedKategorien = existingKategorien.map(k => (k === oldKategorie ? newKategorie : k));
    const teilbereichString = updatedKategorien.length > 0 ? updatedKategorien.join(', ') : null;

    await strategieService.updateStrategie(detail.strategieId, { teilbereich: teilbereichString });

    const itemsToUpdate = detail.items.filter(item => item.teilbereich === oldKategorie);
    await Promise.all(itemsToUpdate.map(item => (
      strategieService.updateStrategieItem(item.id, { teilbereich: newKategorie })
    )));

    itemsToUpdate.forEach(item => {
      item.teilbereich = newKategorie;
    });

    detail.strategie.teilbereich = teilbereichString;
    rerenderKategorienDrawerBody(detail);
    detail.rerenderItemsTable();

    window.toastSystem?.show(`Kategorie "${oldKategorie}" wurde umbenannt`, 'success');
  } catch (error) {
    console.error('Fehler beim Umbenennen der Kategorie:', error);
    window.toastSystem?.show('Fehler beim Umbenennen der Kategorie', 'error');
  }
}

async function handleDeleteKategorie(detail, kategorie) {
  const result = await window.confirmationModal?.open({
    title: 'Kategorie löschen?',
    message: `Möchten Sie die Kategorie "${kategorie}" wirklich löschen? Videos in dieser Kategorie werden zu "Ohne Kategorie" verschoben.`,
    confirmText: 'Löschen',
    cancelText: 'Abbrechen',
    danger: true
  });

  if (!result?.confirmed) return;
  
  try {
    const existingKategorien = detail.getTeilbereicheFromStrategie();
    const updatedKategorien = existingKategorien.filter(k => k !== kategorie);
    const teilbereichString = updatedKategorien.length > 0 ? updatedKategorien.join(', ') : null;
    
    await strategieService.updateStrategie(detail.strategieId, { teilbereich: teilbereichString });
    
    const itemsToUpdate = detail.items.filter(item => item.teilbereich === kategorie);
    for (const item of itemsToUpdate) {
      await strategieService.updateStrategieItem(item.id, { teilbereich: null });
      item.teilbereich = null;
    }
    
    detail.strategie.teilbereich = teilbereichString;
    
    rerenderKategorienDrawerBody(detail);
    detail.rerenderItemsTable();
    
    window.toastSystem?.show(`Kategorie "${kategorie}" gelöscht`, 'success');
  } catch (error) {
    console.error('Fehler beim Löschen der Kategorie:', error);
    window.toastSystem?.show('Fehler beim Löschen der Kategorie', 'error');
  }
}

function rerenderKategorienDrawerBody(detail) {
  const body = document.getElementById(`${DRAWER_ID}-body`);
  if (body) {
    body.innerHTML = renderKategorienDrawerBody(detail);
    bindKategorienDrawerEvents(detail);
  }
}
