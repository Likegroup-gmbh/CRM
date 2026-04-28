// CreatorAuswahlDetail.js
// Orchestrierungs-Klasse fuer die Creator-Auswahl Detail-Ansicht

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { SourcingDetailColumnVisibilityDrawer } from './SourcingDetailColumnVisibilityDrawer.js';
import { normalizeCreatorTyp, isAllowedCreatorTyp } from './creatorTypeOptions.js';
import {
  renderAddSection, renderItemsTable,
  getTeilbereicheFromListe, isColumnVisibleForCustomer, getVisibleColumnCount
} from './CreatorAuswahlTemplates.js';
import { CreatorAuswahlKategorienDrawer } from './CreatorAuswahlKategorienDrawer.js';
import { CreatorAuswahlAddDrawer } from './CreatorAuswahlAddDrawer.js';

export class CreatorAuswahlDetail {
  constructor() {
    this._boundEventListeners = new Set();
    this.liste = null;
    this.items = [];
    this.isKunde = false;
    this.draggedItem = null;
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.hiddenColumns = [];
    this.columnVisibilityDrawer = null;
    this.kategorienDrawer = new CreatorAuswahlKategorienDrawer(this);
    this.addDrawer = new CreatorAuswahlAddDrawer(this);
  }

  // --- Init & Lifecycle ---

  async init(listeId) {
    this.listeId = listeId;
    this.isKunde = window.isKunde();

    if (this.isKunde) {
      const quickMenuContainer = document.getElementById('quick-menu-container');
      if (quickMenuContainer) quickMenuContainer.style.display = 'none';
    }

    this.loadColumnVisibilitySettings();

    try {
      this.liste = await creatorAuswahlService.getListeById(listeId);
      this.items = await creatorAuswahlService.getItems(listeId);

      if (window.breadcrumbSystem && this.liste) {
        window.breadcrumbSystem.updateDetailLabel(this.liste.name);
      }

      if (this.items.length === 0 && !this.isKunde) {
        await this.addDrawer.createInitialEmptyRow();
      }

      window.setHeadline('');
      await this.render();
      this.bindEvents();
    } catch (error) {
      console.error('Fehler beim Laden:', error);
      window.content.innerHTML = `
        <div class="error-message">
          <p>Fehler beim Laden der Creator-Auswahl</p>
        </div>
      `;
    }
  }

  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    this.addDrawer.remove();
    this.kategorienDrawer.remove();

    if (this.cleanupFloatingScrollbar) {
      this.cleanupFloatingScrollbar();
      this.cleanupFloatingScrollbar = null;
    }

    const container = document.querySelector('.table-container');
    if (container && this._dragMouseDown) {
      container.removeEventListener('mousedown', this._dragMouseDown);
      document.removeEventListener('mousemove', this._dragMouseMove);
      document.removeEventListener('mouseup', this._dragMouseUp);
    }
  }

  // --- Spalten-Sichtbarkeit ---

  loadColumnVisibilitySettings() {
    try {
      const key = `sourcing_detail_hidden_columns_${this.listeId}`;
      const stored = localStorage.getItem(key);
      this.hiddenColumns = stored ? JSON.parse(stored) : [];
    } catch (error) {
      this.hiddenColumns = [];
    }
  }

  saveColumnVisibilitySettings() {
    try {
      const key = `sourcing_detail_hidden_columns_${this.listeId}`;
      localStorage.setItem(key, JSON.stringify(this.hiddenColumns));
    } catch (error) {
      console.error('Fehler beim Speichern der Spalten-Sichtbarkeit:', error);
    }
  }

  showColumnVisibilityDrawer() {
    if (!this.columnVisibilityDrawer) {
      this.columnVisibilityDrawer = new SourcingDetailColumnVisibilityDrawer(
        this.hiddenColumns,
        (newHiddenColumns) => {
          this.hiddenColumns = newHiddenColumns;
          this.saveColumnVisibilitySettings();
          this.rerenderTable();
        }
      );
    } else {
      this.columnVisibilityDrawer.hiddenColumns = this.hiddenColumns;
    }
    this.columnVisibilityDrawer.open();
  }

  // --- Rendering ---

  getRenderContext() {
    return {
      items: this.items,
      liste: this.liste,
      isKunde: this.isKunde,
      hiddenColumns: this.hiddenColumns
    };
  }

  async render() {
    const html = `
      ${!this.isKunde ? renderAddSection() : ''}
      ${renderItemsTable(this.getRenderContext())}
    `;
    window.content.innerHTML = html;
    this._updateStickyHeights();
  }

  _updateStickyHeights() {
    const addSection = window.content.querySelector('.add-item-section--compact');
    const h = addSection ? addSection.offsetHeight : 0;
    window.content.style.setProperty('--sticky-add-section-height', h + 'px');

    const thead = window.content.querySelector('.creator-pool-table thead');
    if (thead) {
      window.content.style.setProperty('--sticky-thead-height', thead.offsetHeight + 'px');
    }
  }

  rerenderTable() {
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
      tableContainer.outerHTML = renderItemsTable(this.getRenderContext());
      this.bindEvents();
      this._updateStickyHeights();
    }
  }

  // --- Event-Binding ---

  bindEvents() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();

    // Event-basierte Action-Behandlung (Portal-kompatibel via ActionRegistry)
    const actionHandler = (event) => {
      const { action, entityType, entityId } = event.detail;
      if (entityType !== 'creator_auswahl_item') return;

      switch (action) {
        case 'delete-item': this.handleDeleteItem(entityId); break;
        case 'transfer-to-crm': this.handleTransferToCRM(entityId); break;
        case 'view-crm-creator': window.navigateTo(`/creator/${entityId}`); break;
      }
    };
    document.addEventListener('actionRequested', actionHandler);
    this._boundEventListeners.add(() => document.removeEventListener('actionRequested', actionHandler));

    if (!this.isKunde) {
      const visibilityBtn = document.getElementById('btn-sourcing-detail-column-visibility');
      if (visibilityBtn) {
        const handler = () => this.showColumnVisibilityDrawer();
        visibilityBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => visibilityBtn.removeEventListener('click', handler));
      }

      const kategorienBtn = document.getElementById('btn-manage-kategorien');
      if (kategorienBtn) {
        const handler = () => this.kategorienDrawer.open();
        kategorienBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => kategorienBtn.removeEventListener('click', handler));
      }

      const addBtn = document.getElementById('btn-open-add-drawer');
      if (addBtn) {
        const handler = () => this.addDrawer.open();
        addBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => addBtn.removeEventListener('click', handler));
      }

      const addEmptyRowBtn = document.getElementById('btn-add-empty-row');
      if (addEmptyRowBtn) {
        const handler = () => this.addDrawer.addEmptyRow();
        addEmptyRowBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => addEmptyRowBtn.removeEventListener('click', handler));
      }

      this.bindDragAndDropEvents();
    }

    this.initFloatingScrollbar();
    this.bindDragToScroll();

    // Feld-Updates (Input/Textarea/Select)
    document.querySelectorAll('input[data-field], textarea[data-field], select[data-field]').forEach(el => {
      const handler = () => this.handleFieldUpdate(el);
      if (el.type === 'checkbox') {
        el.addEventListener('change', handler);
        this._boundEventListeners.add(() => el.removeEventListener('change', handler));
      } else {
        el.addEventListener('blur', handler);
        el.addEventListener('change', handler);
        this._boundEventListeners.add(() => {
          el.removeEventListener('blur', handler);
          el.removeEventListener('change', handler);
        });
      }
    });

    if (window.ActionsDropdown) {
      window.ActionsDropdown.init();
    }
  }

  // --- Drag & Drop ---

  bindDragAndDropEvents() {
    const rows = document.querySelectorAll('.item-row.draggable');
    const kategorieHeaders = document.querySelectorAll('.kategorie-header-row');

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
        this.draggedItem = null;
        this.draggedItemId = null;
        document.querySelectorAll('.kategorie-header-row.drag-over').forEach(h => h.classList.remove('drag-over'));
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
        const newKategorie = header.dataset.kategorie;
        if (itemId && newKategorie) {
          await this.handleCategoryChange(itemId, newKategorie);
        }
      };
      header.addEventListener('drop', dropHandler);
      this._boundEventListeners.add(() => header.removeEventListener('drop', dropHandler));
    });
  }

  // --- CRUD-Handler ---

  async handleSortUpdate() {
    const tbody = document.getElementById('items-table-body');
    const rows = Array.from(tbody.querySelectorAll('.item-row'));
    const hatKategorien = getTeilbereicheFromListe(this.liste).length > 0;

    const updatedItems = rows.map((row, index) => {
      const itemId = row.dataset.itemId;
      const item = this.items.find(i => i.id === itemId);

      let kategorie = item.kategorie;

      if (hatKategorien) {
        let currentHeader = row.previousElementSibling;
        while (currentHeader && !currentHeader.classList.contains('kategorie-header-row')) {
          currentHeader = currentHeader.previousElementSibling;
        }
        if (currentHeader) {
          const headerKategorie = currentHeader.dataset.kategorie;
          kategorie = headerKategorie === 'Ohne Kategorie' ? null : headerKategorie;
        }
      }

      return { ...item, sortierung: index, kategorie };
    });

    try {
      await creatorAuswahlService.updateItemsSortierungWithKategorie(updatedItems);
      this.items = updatedItems;
      window.toastSystem?.show('Sortierung gespeichert', 'success');
    } catch (error) {
      console.error('Fehler beim Speichern der Sortierung:', error);
      window.toastSystem?.show('Fehler beim Speichern der Sortierung', 'error');
    }
  }

  async handleFieldUpdate(element) {
    const itemId = element.dataset.itemId;
    const field = element.dataset.field;
    let value;

    if (element.type === 'checkbox') {
      value = element.checked;
    } else if (field === 'typ') {
      value = normalizeCreatorTyp(element.value);
      if (!isAllowedCreatorTyp(value)) {
        const currentItem = this.items.find(i => i.id === itemId);
        element.value = currentItem?.typ || '';
        window.toastSystem?.show('Ungültige Creator Art. Bitte einen gültigen Wert auswählen.', 'error');
        return;
      }
    } else if (field === 'follower_instagram' || field === 'follower_tiktok') {
      const numValue = element.value?.trim();
      value = numValue ? parseInt(numValue.replace(/[^\d]/g, ''), 10) : null;
    } else {
      value = element.value?.trim() || null;
    }

    try {
      if (field === 'angefragt') {
        const updates = { angefragt: value };
        if (value) updates.angefragt_am = new Date().toISOString();
        await creatorAuswahlService.updateItem(itemId, updates);
        const item = this.items.find(i => i.id === itemId);
        if (item) {
          item.angefragt = value;
          if (value) item.angefragt_am = updates.angefragt_am;
        }
        this.rerenderTable();
        return;
      }

      if (field === 'nicht_umsetzen') {
        await this.handleNichtUmsetzenChange(itemId, value);
        return;
      }

      await creatorAuswahlService.updateItem(itemId, { [field]: value });

      const item = this.items.find(i => i.id === itemId);
      if (item) item[field] = value;

      if (field === 'prio_1' && value === true) {
        const reorderedItems = this.promoteBookedItemWithinCategory(itemId);
        await creatorAuswahlService.updateItemsSortierungWithKategorie(reorderedItems);
        this.items = reorderedItems.map((entry, index) => ({ ...entry, sortierung: index }));
        this.rerenderTable();
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren:', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
    }
  }

  promoteBookedItemWithinCategory(itemId) {
    const item = this.items.find(entry => entry.id === itemId);
    if (!item) return this.items;

    const getKey = (entry) => entry.kategorie || '__OHNE_KATEGORIE__';
    const targetKey = getKey(item);

    const categoryIndexes = [];
    const categoryItems = [];

    this.items.forEach((entry, index) => {
      if (getKey(entry) === targetKey) {
        categoryIndexes.push(index);
        categoryItems.push(entry);
      }
    });

    if (categoryItems.length <= 1) {
      return this.items.map((entry, index) => ({ ...entry, sortierung: index }));
    }

    const targetItem = categoryItems.find(entry => entry.id === itemId);
    const remaining = categoryItems.filter(entry => entry.id !== itemId);
    const booked = remaining.filter(entry => entry.prio_1);
    const nonBooked = remaining.filter(entry => !entry.prio_1);
    const reordered = [targetItem, ...booked, ...nonBooked];

    const result = [...this.items];
    categoryIndexes.forEach((index, slot) => {
      result[index] = reordered[slot];
    });

    return result.map((entry, index) => ({ ...entry, sortierung: index }));
  }

  async handleNichtUmsetzenChange(itemId, isNichtUmsetzen) {
    const NICHT_UMSETZEN_KATEGORIE = 'Nicht umsetzen';

    try {
      if (isNichtUmsetzen) {
        const existingKategorien = getTeilbereicheFromListe(this.liste);
        if (!existingKategorien.includes(NICHT_UMSETZEN_KATEGORIE)) {
          const updatedKategorien = [...existingKategorien, NICHT_UMSETZEN_KATEGORIE];
          const teilbereichString = updatedKategorien.join(', ');
          await creatorAuswahlService.updateListe(this.listeId, { teilbereich: teilbereichString });
          this.liste.teilbereich = teilbereichString;
        }

        await creatorAuswahlService.updateItem(itemId, {
          nicht_umsetzen: true,
          kategorie: NICHT_UMSETZEN_KATEGORIE
        });

        const item = this.items.find(i => i.id === itemId);
        if (item) {
          item.nicht_umsetzen = true;
          item.kategorie = NICHT_UMSETZEN_KATEGORIE;
        }

        window.toastSystem?.show('Creator als "Nicht umsetzen" markiert', 'info');
      } else {
        await creatorAuswahlService.updateItem(itemId, {
          nicht_umsetzen: false,
          kategorie: null
        });

        const item = this.items.find(i => i.id === itemId);
        if (item) {
          item.nicht_umsetzen = false;
          item.kategorie = null;
        }

        window.toastSystem?.show('Creator wieder aktiv', 'success');
      }

      this.rerenderTable();
    } catch (error) {
      console.error('Fehler beim Ändern von "Nicht umsetzen":', error);
      window.toastSystem?.show('Fehler beim Speichern', 'error');
    }
  }

  async handleCategoryChange(itemId, newKategorie) {
    try {
      const kategorie = newKategorie === 'Ohne Kategorie' ? null : newKategorie;
      await creatorAuswahlService.updateItem(itemId, { kategorie });

      const item = this.items.find(i => i.id === itemId);
      if (item) item.kategorie = kategorie;

      this.rerenderTable();
      window.toastSystem?.show('Kategorie aktualisiert', 'success');
    } catch (error) {
      console.error('Fehler beim Ändern der Kategorie:', error);
      window.toastSystem?.show('Fehler beim Ändern der Kategorie', 'error');
    }
  }

  async handleDeleteItem(itemId) {
    const result = await window.confirmationModal?.open({
      title: 'Creator entfernen?',
      message: 'Möchten Sie diesen Creator wirklich aus der Liste entfernen?',
      confirmText: 'Entfernen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;

    try {
      await creatorAuswahlService.deleteItem(itemId);
      this.items = this.items.filter(i => i.id !== itemId);
      window.toastSystem?.show('Creator entfernt', 'success');
      this.rerenderTable();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      window.toastSystem?.show('Fehler beim Löschen', 'error');
    }
  }

  async handleTransferToCRM(itemId) {
    const result = await window.confirmationModal?.open({
      title: 'Ins CRM übernehmen?',
      message: 'Möchten Sie diesen Creator als neuen Eintrag ins CRM übernehmen?',
      confirmText: 'Übernehmen',
      cancelText: 'Abbrechen'
    });

    if (!result?.confirmed) return;

    try {
      const creator = await creatorAuswahlService.transferToCRM(itemId);

      const item = this.items.find(i => i.id === itemId);
      if (item) item.creator_id = creator.id;

      window.toastSystem?.show('Creator erfolgreich ins CRM übernommen', 'success');
      this.rerenderTable();
    } catch (error) {
      console.error('Fehler bei CRM-Übernahme:', error);
      window.toastSystem?.show('Fehler bei der CRM-Übernahme', 'error');
    }
  }

  // --- Scroll & Table UX ---

  initFloatingScrollbar() {
    const existingScrollbar = document.getElementById('floating-scrollbar-creator-auswahl');
    if (existingScrollbar) existingScrollbar.remove();

    const tableWrapper = document.querySelector('.table-container');
    if (!tableWrapper) return;

    const scrollTarget = document.querySelector('.main-wrapper') || tableWrapper;

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

  bindDragToScroll() {
    const container = document.querySelector('.table-container');
    if (!container) return;

    const scrollTarget = document.querySelector('.main-wrapper') || container;

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
        e.target.closest('.drag-handle')
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
}

export const creatorAuswahlDetail = new CreatorAuswahlDetail();
