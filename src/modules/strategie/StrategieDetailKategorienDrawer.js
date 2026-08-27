// StrategieDetailKategorienDrawer.js
// Kategorien-Verwaltung (CRUD, Inline-Edit, Drawer-Lifecycle)

import { strategieService } from './StrategieService.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { icon } from '../../core/icons/IconSystem.js';
import { reorderStrategieItemsByKategorien } from './StrategieDetailRenderer.js';

const DRAWER_ID = 'kategorien-drawer';
let _reorderUnbind = [];
let _draggedKategorieRow = null;

export function renderKategorienDrawerBody(detail) {
  const teilbereiche = detail.getTeilbereicheFromStrategie();
  
  return `
    <div class="kategorien-list" id="kategorien-list">
      ${teilbereiche.length > 0 ? teilbereiche.map(tb => `
        <div class="kategorie-item" data-kategorie="${escapeAttr(tb)}" draggable="false">
          <button type="button" class="kategorie-drag-handle" data-action="drag-kategorie" title="Reihenfolge ändern" aria-label="Reihenfolge ändern">
            ${icon('bars-3', { className: 'icon-16' })}
          </button>
          <span class="kategorie-name">${escapeAttr(tb)}</span>
          <button type="button" class="kategorie-delete-btn" data-action="edit-kategorie" data-kategorie="${escapeAttr(tb)}" title="Kategorie bearbeiten">
            ${icon('pencil-square')}
          </button>
          <button type="button" class="kategorie-delete-btn" data-action="delete-kategorie" data-kategorie="${escapeAttr(tb)}" title="Kategorie löschen">
            ${icon('x-mark')}
          </button>
        </div>
      `).join('') : '<p class="no-kategorien">Keine Kategorien vorhanden</p>'}
    </div>
    <div class="kategorie-add-form">
      <input type="text" id="new-kategorie-input" class="form-input" placeholder="Neue Kategorie...">
      <button type="button" class="mdc-btn" id="btn-add-kategorie">
        ${icon('plus-lg', { className: 'icon-16' })}
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
  subtitle.textContent = 'Kategorien hinzufügen, umbenennen, sortieren oder entfernen';
  
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

  bindReorderEvents(detail);
  
  input?.focus();
}

export function removeKategorienDrawer() {
  unbindReorder();
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

function unbindReorder() {
  _reorderUnbind.forEach(fn => fn());
  _reorderUnbind = [];
  _draggedKategorieRow = null;
}

function bindReorderEvents(detail) {
  unbindReorder();
  const list = document.getElementById('kategorien-list');
  if (!list) return;

  const rows = () => list.querySelectorAll('.kategorie-item');

  list.querySelectorAll('[data-action="drag-kategorie"]').forEach(handle => {
    const onMouseDown = () => {
      handle.closest('.kategorie-item')?.setAttribute('draggable', 'true');
    };
    handle.addEventListener('mousedown', onMouseDown);
    _reorderUnbind.push(() => handle.removeEventListener('mousedown', onMouseDown));
  });

  const onMouseUp = () => {
    rows().forEach(row => row.setAttribute('draggable', 'false'));
  };
  document.addEventListener('mouseup', onMouseUp);
  _reorderUnbind.push(() => document.removeEventListener('mouseup', onMouseUp));

  rows().forEach(row => {
    const onDragStart = (e) => {
      _draggedKategorieRow = row;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', row.dataset.kategorie);
    };
    const onDragEnd = async () => {
      row.classList.remove('is-dragging');
      row.setAttribute('draggable', 'false');
      _draggedKategorieRow = null;
      list.querySelectorAll('.kategorie-item.drag-over').forEach(el => el.classList.remove('drag-over'));
      await applyKategorieOrder(detail, readKategorieOrderFromDom());
    };
    const onDragOver = (e) => {
      e.preventDefault();
      const dragged = _draggedKategorieRow;
      if (!dragged || dragged === row) return;
      const siblings = Array.from(list.children);
      const from = siblings.indexOf(dragged);
      const to = siblings.indexOf(row);
      if (from < 0 || to < 0) return;
      if (from < to) {
        list.insertBefore(dragged, row.nextSibling);
      } else {
        list.insertBefore(dragged, row);
      }
    };
    const onDrop = (e) => {
      e.preventDefault();
    };

    row.addEventListener('dragstart', onDragStart);
    row.addEventListener('dragend', onDragEnd);
    row.addEventListener('dragover', onDragOver);
    row.addEventListener('drop', onDrop);
    _reorderUnbind.push(() => {
      row.removeEventListener('dragstart', onDragStart);
      row.removeEventListener('dragend', onDragEnd);
      row.removeEventListener('dragover', onDragOver);
      row.removeEventListener('drop', onDrop);
    });
  });
}

function readKategorieOrderFromDom() {
  const list = document.getElementById('kategorien-list');
  if (!list) return [];
  return Array.from(list.querySelectorAll('.kategorie-item')).map(row => row.dataset.kategorie);
}

export async function applyKategorieOrder(detail, nextKategorien) {
  const existingKategorien = detail.getTeilbereicheFromStrategie();
  if (nextKategorien.join('\0') === existingKategorien.join('\0')) return false;
  if (nextKategorien.length !== existingKategorien.length) return false;

  const existingSet = new Set(existingKategorien);
  if (nextKategorien.some(k => !existingSet.has(k))) return false;

  const teilbereichString = nextKategorien.join(', ');

  try {
    await strategieService.updateStrategie(detail.strategieId, { teilbereich: teilbereichString });
    detail.strategie.teilbereich = teilbereichString;

    const reorderedItems = reorderStrategieItemsByKategorien(detail.items || [], nextKategorien);
    if (reorderedItems.length > 0) {
      await strategieService.updateItemsSortierungWithTeilbereich(reorderedItems);
      detail.items = reorderedItems;
    }

    rerenderKategorienDrawerBody(detail);
    detail.rerenderItemsTable();
    window.toastSystem?.show('Reihenfolge gespeichert', 'success');
    return true;
  } catch (error) {
    console.error('Fehler beim Sortieren der Kategorien:', error);
    window.toastSystem?.show('Fehler beim Sortieren', 'error');
    rerenderKategorienDrawerBody(detail);
    return false;
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
  const row = document.querySelector(`.kategorie-item[data-kategorie="${CSS.escape(kategorie)}"]`);
  if (!row) return;

  const checkSvg = icon('check-bold', { stroke: 2 });
  const cancelSvg = icon('x-mark', { stroke: 2 });

  row.innerHTML = `
    <input type="text" class="form-input" value="${escapeAttr(kategorie)}" data-edit-kategorie="${escapeAttr(kategorie)}">
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
