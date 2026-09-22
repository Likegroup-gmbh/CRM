// CastingDetailTableUx.js
// Drag-and-drop, Sortierung und horizontaler Scroll (Prototype-Mixin von CreatorAuswahlDetail)

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { applyGroupToItem } from './castingPersonaGroups.js';

export function bindDragAndDropEvents() {
  const rows = this._qq('.item-row.draggable');
  const kategorieHeaders = this._qq('.kategorie-header-row');

  // Drag nur über Handle aktivieren
  const handles = this._qq('.drag-handle');
  handles.forEach(handle => {
    const mousedownHandler = () => {
      const row = handle.closest('.item-row');
      if (row) row.draggable = true;
    };
    handle.addEventListener('mousedown', mousedownHandler);
    this._boundEventListeners.add(() => handle.removeEventListener('mousedown', mousedownHandler));
  });

  const globalMouseup = () => {
    rows.forEach(row => { row.draggable = false; });
  };
  document.addEventListener('mouseup', globalMouseup);
  this._boundEventListeners.add(() => document.removeEventListener('mouseup', globalMouseup));

  rows.forEach(row => {
    const dragstartHandler = (e) => {
      this.draggedItem = row;
      this.draggedItemId = row.dataset.itemId;
      row.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', row.dataset.itemId);
    };
    row.addEventListener('dragstart', dragstartHandler);
    this._boundEventListeners.add(() => row.removeEventListener('dragstart', dragstartHandler));

    const dragendHandler = () => {
      row.style.opacity = '1';
      row.draggable = false;
      this.draggedItem = null;
      this.draggedItemId = null;
      this._qq('.kategorie-header-row.drag-over').forEach(h => h.classList.remove('drag-over'));
    };
    row.addEventListener('dragend', dragendHandler);
    this._boundEventListeners.add(() => row.removeEventListener('dragend', dragendHandler));

    const dragoverHandler = (e) => {
      e.preventDefault();
      if (row === this.draggedItem) return;

      const tbody = row.parentNode;
      const draggingIndex = Array.from(tbody.children).indexOf(this.draggedItem);
      const targetIndex = Array.from(tbody.children).indexOf(row);

      if (draggingIndex < targetIndex) {
        row.parentNode.insertBefore(this.draggedItem, row.nextSibling);
      } else {
        row.parentNode.insertBefore(this.draggedItem, row);
      }
    };
    row.addEventListener('dragover', dragoverHandler);
    this._boundEventListeners.add(() => row.removeEventListener('dragover', dragoverHandler));

    const dropHandler = () => this.handleSortUpdate();
    row.addEventListener('drop', dropHandler);
    this._boundEventListeners.add(() => row.removeEventListener('drop', dropHandler));
  });

  kategorieHeaders.forEach(header => {
    const dragoverHandler = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      header.classList.add('drag-over');
    };
    header.addEventListener('dragover', dragoverHandler);
    this._boundEventListeners.add(() => header.removeEventListener('dragover', dragoverHandler));

    const dragleaveHandler = () => header.classList.remove('drag-over');
    header.addEventListener('dragleave', dragleaveHandler);
    this._boundEventListeners.add(() => header.removeEventListener('dragleave', dragleaveHandler));

    const dropHandler = async (e) => {
      e.preventDefault();
      header.classList.remove('drag-over');

      const itemId = this.draggedItemId;
      const groupKey = header.dataset.groupKey;
      if (itemId && groupKey) {
        await this.handlePersonaChange(itemId, groupKey, header.dataset.personaId || null);
      }
    };
    header.addEventListener('drop', dropHandler);
    this._boundEventListeners.add(() => header.removeEventListener('drop', dropHandler));
  });
}

export async function handleSortUpdate() {
  const table = this._q('.creator-pool-table');
  if (!table) return;
  const rows = Array.from(table.querySelectorAll('.item-row'));
  const hatGruppen = this._q('.kategorie-header-row');

  // Sichtbare (im aktiven Reiter gefilterte) Zeilen mit neuer Reihenfolge/Gruppe aus dem DOM
  const visibleItems = rows.map((row) => {
    const itemId = row.dataset.itemId;
    const item = this.items.find(i => i.id === itemId);
    if (!item) return null;

    if (!hatGruppen) return { ...item };

    let currentHeader = row.previousElementSibling;
    while (currentHeader && !currentHeader.classList.contains('kategorie-header-row')) {
      currentHeader = currentHeader.previousElementSibling;
    }
    if (!currentHeader?.dataset.groupKey) return { ...item };
    return applyGroupToItem(item, currentHeader.dataset.groupKey, currentHeader.dataset.personaId || null);
  }).filter(Boolean);

  // Nicht sichtbare Items (andere Reiter) behalten ihre Position:
  // Gesamtreihenfolge = bisherige Reihenfolge, sichtbare Items in neuer DOM-Reihenfolge eingesetzt
  const visibleIds = new Set(visibleItems.map(i => i.id));
  const sortedAll = [...this.items].sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0));
  let visibleIndex = 0;
  const updatedItems = sortedAll
    .map(item => (visibleIds.has(item.id) ? visibleItems[visibleIndex++] : item))
    .map((item, index) => ({ ...item, sortierung: index }));

  try {
    await creatorAuswahlService.updateItemsSortierungWithKategorie(updatedItems);
    this.items = updatedItems;
    window.toastSystem?.show('Sortierung gespeichert', 'success');
  } catch (error) {
    console.error('Fehler beim Speichern der Sortierung:', error);
    window.toastSystem?.show('Fehler beim Speichern der Sortierung', 'error');
  }
}

export function initFloatingScrollbar() {
  if (this.cleanupFloatingScrollbar) {
    this.cleanupFloatingScrollbar();
    this.cleanupFloatingScrollbar = null;
  }

  const tableWrapper = this._q('.table-container');
  if (!tableWrapper) return;

  const scrollTarget = this._getHScrollTarget(tableWrapper);

  const floatingScrollbar = document.createElement('div');
  floatingScrollbar.id = 'floating-scrollbar-creator-auswahl';
  floatingScrollbar.className = 'floating-scrollbar-kampagne';

  const scrollbarInner = document.createElement('div');
  scrollbarInner.className = 'floating-scrollbar-inner';
  floatingScrollbar.appendChild(scrollbarInner);

  document.body.appendChild(floatingScrollbar);

  const updateScrollbarSize = () => {
    const table = tableWrapper.querySelector('table');
    if (table) scrollbarInner.style.width = table.scrollWidth + 'px';
    const wrapperRect = scrollTarget.getBoundingClientRect();
    floatingScrollbar.style.left = wrapperRect.left + 'px';
    floatingScrollbar.style.width = wrapperRect.width + 'px';
  };

  updateScrollbarSize();

  const handleFloatingScroll = () => {
    if (this._isScrollingFromTable) return;
    this._isScrollingFromFloating = true;
    scrollTarget.scrollLeft = floatingScrollbar.scrollLeft;
    requestAnimationFrame(() => { this._isScrollingFromFloating = false; });
  };

  floatingScrollbar.addEventListener('scroll', handleFloatingScroll);

  const handleTableScroll = () => {
    if (this._isScrollingFromFloating) return;
    this._isScrollingFromTable = true;
    floatingScrollbar.scrollLeft = scrollTarget.scrollLeft;
    requestAnimationFrame(() => { this._isScrollingFromTable = false; });
  };

  scrollTarget.addEventListener('scroll', handleTableScroll);

  const toggleFloatingScrollbar = () => {
    const wrapperRect = tableWrapper.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const isTableVisible = wrapperRect.top < viewportHeight && wrapperRect.bottom > 0;
    const table = tableWrapper.querySelector('table');
    const needsScroll = table && table.scrollWidth > scrollTarget.clientWidth;

    if (isTableVisible && needsScroll && wrapperRect.bottom > viewportHeight) {
      floatingScrollbar.classList.add('visible');
      updateScrollbarSize();
    } else {
      floatingScrollbar.classList.remove('visible');
    }
  };

  toggleFloatingScrollbar();
  window.addEventListener('scroll', toggleFloatingScrollbar);
  const resizeHandler = () => {
    updateScrollbarSize();
    toggleFloatingScrollbar();
  };
  window.addEventListener('resize', resizeHandler);

  this.cleanupFloatingScrollbar = () => {
    floatingScrollbar.classList.remove('visible');
    window.removeEventListener('scroll', toggleFloatingScrollbar);
    window.removeEventListener('resize', resizeHandler);
    floatingScrollbar.removeEventListener('scroll', handleFloatingScroll);
    scrollTarget.removeEventListener('scroll', handleTableScroll);
    if (floatingScrollbar.parentNode) floatingScrollbar.parentNode.removeChild(floatingScrollbar);
  };
}

export function bindDragToScroll() {
  const container = this._q('.table-container');
  if (!container) return;

  const scrollTarget = this._getHScrollTarget(container);

  if (this._dragMouseDown) {
    container.removeEventListener('mousedown', this._dragMouseDown);
    document.removeEventListener('mousemove', this._dragMouseMove);
    document.removeEventListener('mouseup', this._dragMouseUp);
  }

  this._dragMouseDown = (e) => {
    if (
      e.target.tagName === 'TEXTAREA' ||
      e.target.tagName === 'SELECT' ||
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'BUTTON' ||
      e.target.tagName === 'A' ||
      e.target.closest('a') ||
      e.target.closest('.actions-dropdown-container') ||
      e.target.closest('.drag-handle') ||
      // Hand-Griff eigener Spalten: sonst blockiert preventDefault den HTML5-Drag
      e.target.closest('.entity-custom-col-grip')
    ) {
      return;
    }

    this.isDragging = true;
    this.startX = e.pageX - scrollTarget.offsetLeft;
    this.scrollLeft = scrollTarget.scrollLeft;

    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
    e.preventDefault();
  };

  this._dragMouseMove = (e) => {
    if (!this.isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollTarget.offsetLeft;
    const walk = (x - this.startX) * 1.5;
    scrollTarget.scrollLeft = this.scrollLeft - walk;
  };

  this._dragMouseUp = () => {
    if (this.isDragging) {
      this.isDragging = false;
      container.style.cursor = 'grab';
      container.style.userSelect = '';
    }
  };

  container.addEventListener('mousedown', this._dragMouseDown);
  document.addEventListener('mousemove', this._dragMouseMove);
  document.addEventListener('mouseup', this._dragMouseUp);

  container.classList.add('drag-scroll-enabled');
  container.style.cursor = 'grab';
}

export const castingDetailTableUxMethods = {
  bindDragAndDropEvents,
  handleSortUpdate,
  initFloatingScrollbar,
  bindDragToScroll
};
