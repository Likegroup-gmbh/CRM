// StrategieDetailTableEvents.js
// Tabellen-Events, Drag & Drop, Feld-Updates für Strategie-Detail

import { strategieService } from './StrategieService.js';

export function cleanupTableEvents(detail) {
  detail._tableEventListeners.forEach(cleanup => cleanup());
  detail._tableEventListeners.clear();
}

export function bindTableEvents(detail) {
  cleanupTableEvents(detail);

  if (!detail.isKunde) {
    bindDragAndDropEvents(detail);
  }

  document.querySelectorAll('input[data-field], textarea[data-field]').forEach(input => {
    const handler = () => handleFieldUpdate(detail, input);
    input.addEventListener('blur', handler);
    detail._tableEventListeners.add(() => input.removeEventListener('blur', handler));
  });

  document.querySelectorAll('input[type="checkbox"][data-field]').forEach(checkbox => {
    const handler = () => handleFieldUpdate(detail, checkbox);
    checkbox.addEventListener('change', handler);
    detail._tableEventListeners.add(() => checkbox.removeEventListener('change', handler));
  });

  if (!detail.isKunde) {
    const actionHandler = (e) => {
      const actionItem = e.target.closest('[data-action]');
      if (!actionItem) return;

      const action = actionItem.dataset.action;
      const id = actionItem.dataset.id;

      switch (action) {
        case 'edit-item':
          e.preventDefault();
          detail.showEditItemDrawer(id);
          break;
        case 'delete-item':
          e.preventDefault();
          detail.handleDeleteItem(id);
          break;
        case 'add-to-video':
          e.preventDefault();
          detail.handleAddToVideo(id);
          break;
        case 'unlink-from-video':
          e.preventDefault();
          detail.handleUnlinkFromVideo(id, actionItem.dataset.videoId);
          break;
      }
    };
    document.addEventListener('click', actionHandler);
    detail._tableEventListeners.add(() => document.removeEventListener('click', actionHandler));
  }

  bindDragToScroll(detail);
}

export function bindDragToScroll(detail) {
  const container = document.querySelector('.main-wrapper');
  if (!container) return;

  detail._dragScrollAbort?.abort();
  detail._dragScrollAbort = new AbortController();
  const signal = detail._dragScrollAbort.signal;

  detail._dragScrollContainer = container;
  detail._origOverflowX = container.style.overflowX;
  container.style.overflowX = 'auto';
  container.classList.add('drag-scroll-enabled');

  container.addEventListener('mousedown', (e) => {
    if (
      e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' ||
      e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' ||
      e.target.tagName === 'A' || e.target.closest('a') ||
      e.target.closest('.actions-dropdown-container') ||
      e.target.closest('.drag-handle')
    ) return;

    detail._isDragScrolling = true;
    detail._dragStartX = e.pageX - container.offsetLeft;
    detail._dragScrollLeft = container.scrollLeft;
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
    e.preventDefault();
  }, { signal });

  container.addEventListener('mousemove', (e) => {
    if (!detail._isDragScrolling) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    container.scrollLeft = detail._dragScrollLeft - (x - detail._dragStartX) * 1.5;
  }, { signal });

  const stopDragging = () => {
    if (detail._isDragScrolling) {
      detail._isDragScrolling = false;
      container.style.cursor = 'grab';
      container.style.userSelect = '';
    }
  };
  container.addEventListener('mouseup', stopDragging, { signal });
  container.addEventListener('mouseleave', stopDragging, { signal });

  container.style.cursor = 'grab';
}

export function destroyDragToScroll(detail) {
  detail._dragScrollAbort?.abort();
  detail._dragScrollAbort = null;
  if (detail._dragScrollContainer) {
    detail._dragScrollContainer.classList.remove('drag-scroll-enabled');
    detail._dragScrollContainer.style.overflowX = detail._origOverflowX || '';
    detail._dragScrollContainer.style.cursor = '';
    detail._dragScrollContainer.style.userSelect = '';
    detail._dragScrollContainer = null;
  }
}

export function bindDragAndDropEvents(detail) {
  const rows = document.querySelectorAll('.item-row.draggable');
  const categoryHeaders = document.querySelectorAll('.category-header-row');
  
  rows.forEach(row => {
    const dragstartHandler = (e) => {
      detail.draggedItem = row;
      detail.draggedItemId = row.dataset.itemId;
      row.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', row.dataset.itemId);
    };
    row.addEventListener('dragstart', dragstartHandler);
    detail._tableEventListeners.add(() => row.removeEventListener('dragstart', dragstartHandler));

    const dragendHandler = () => {
      row.style.opacity = '1';
      detail.draggedItem = null;
      detail.draggedItemId = null;
      document.querySelectorAll('.category-header-row').forEach(h => {
        h.classList.remove('drag-over');
      });
    };
    row.addEventListener('dragend', dragendHandler);
    detail._tableEventListeners.add(() => row.removeEventListener('dragend', dragendHandler));

    const dragoverHandler = (e) => {
      e.preventDefault();
      if (row === detail.draggedItem) return;
      
      const tbody = row.parentNode;
      const draggingIndex = Array.from(tbody.children).indexOf(detail.draggedItem);
      const targetIndex = Array.from(tbody.children).indexOf(row);
      
      if (draggingIndex < targetIndex) {
        row.parentNode.insertBefore(detail.draggedItem, row.nextSibling);
      } else {
        row.parentNode.insertBefore(detail.draggedItem, row);
      }
    };
    row.addEventListener('dragover', dragoverHandler);
    detail._tableEventListeners.add(() => row.removeEventListener('dragover', dragoverHandler));

    const dropHandler = (e) => {
      e.stopPropagation();
      handleSortUpdate(detail);
    };
    row.addEventListener('drop', dropHandler);
    detail._tableEventListeners.add(() => row.removeEventListener('drop', dropHandler));
  });

  categoryHeaders.forEach(header => {
    const kategorie = header.dataset.kategorie;
    
    const dragoverHandler = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      header.classList.add('drag-over');
    };
    header.addEventListener('dragover', dragoverHandler);
    detail._tableEventListeners.add(() => header.removeEventListener('dragover', dragoverHandler));

    const dragleaveHandler = () => {
      header.classList.remove('drag-over');
    };
    header.addEventListener('dragleave', dragleaveHandler);
    detail._tableEventListeners.add(() => header.removeEventListener('dragleave', dragleaveHandler));

    const dropHandler = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      header.classList.remove('drag-over');
      
      if (!detail.draggedItemId || !kategorie) return;
      
      await handleCategoryChange(detail, detail.draggedItemId, kategorie);
    };
    header.addEventListener('drop', dropHandler);
    detail._tableEventListeners.add(() => header.removeEventListener('drop', dropHandler));
  });
}

export async function handleCategoryChange(detail, itemId, newKategorie) {
  try {
    const teilbereich = newKategorie === 'Ohne Kategorie' ? null : newKategorie;
    
    await strategieService.updateStrategieItem(itemId, { teilbereich });
    
    const item = detail.items.find(i => i.id === itemId);
    if (item) {
      item.teilbereich = teilbereich;
    }
    
    detail.rerenderItemsTable();
    
    window.toastSystem?.show(`Video in "${newKategorie}" verschoben`, 'success');
  } catch (error) {
    console.error('Fehler beim Ändern der Kategorie:', error);
    window.toastSystem?.show('Fehler beim Verschieben', 'error');
  }
}

export async function handleFieldUpdate(detail, element) {
  const itemId = element.dataset.itemId;
  const field = element.dataset.field;
  let value = element.type === 'checkbox' ? element.checked : element.value;

  const item = detail.items.find(i => i.id === itemId);

  if (field === 'video_umgesetzt' && value && item?.nicht_umsetzen) {
    element.checked = false;
    window.toastSystem?.show('Zuerst „Nicht umsetzen" deaktivieren', 'warning');
    return;
  }

  if (field === 'nicht_umsetzen' && value && item?.video_umgesetzt) {
    element.checked = false;
    window.toastSystem?.show('Zuerst „Umgesetzt" deaktivieren', 'warning');
    return;
  }

  await updateItemField(detail, itemId, field, value);

  if (field === 'video_umgesetzt' || field === 'nicht_umsetzen') {
    const row = element.closest('tr.item-row');
    if (row) {
      row.classList.toggle('strategie-item-umgesetzt', field === 'video_umgesetzt' ? value : !!item?.video_umgesetzt);
      row.classList.toggle('item-nicht-umsetzen', field === 'nicht_umsetzen' ? value : !!item?.nicht_umsetzen);
    }
  }
}

export async function updateItemField(detail, itemId, field, value) {
  try {
    await strategieService.updateStrategieItem(itemId, { [field]: value });
    
    const item = detail.items.find(i => i.id === itemId);
    if (item) {
      item[field] = value;
    }
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Items:', error);
    window.toastSystem?.show('Fehler beim Speichern', 'error');
  }
}

export async function handleSortUpdate(detail) {
  const tbody = document.getElementById('items-table-body');
  const allRows = Array.from(tbody.querySelectorAll('tr'));
  
  let currentKategorie = null;
  const updatedItems = [];
  
  allRows.forEach(row => {
    if (row.classList.contains('category-header-row')) {
      const kategorieFromData = row.dataset.kategorie;
      currentKategorie = kategorieFromData === 'Ohne Kategorie' ? null : kategorieFromData;
    } else if (row.classList.contains('item-row')) {
      const itemId = row.dataset.itemId;
      const item = detail.items.find(i => i.id === itemId);
      if (item) {
        updatedItems.push({
          ...item,
          teilbereich: currentKategorie
        });
      }
    }
  });

  try {
    await strategieService.updateItemsSortierungWithTeilbereich(updatedItems);
    detail.items = updatedItems;
    
    detail.rerenderItemsTable();
    
    window.toastSystem?.show('Sortierung gespeichert', 'success');
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Sortierung:', error);
    window.toastSystem?.show('Fehler beim Speichern der Sortierung', 'error');
  }
}
