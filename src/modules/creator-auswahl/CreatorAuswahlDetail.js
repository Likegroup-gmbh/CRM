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
import { autoResizeTextarea } from '../feedback/FeedbackEventHandler.js';

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
    this.kundenCallActive = false;
    this.columnVisibilityDrawer = null;
    this.kategorienDrawer = new CreatorAuswahlKategorienDrawer(this);
    this.addDrawer = new CreatorAuswahlAddDrawer(this);
    this.selectedItems = new Set();
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
    this.selectedItems.clear();

    const bulkBar = document.getElementById('sourcing-bulk-bar');
    if (bulkBar) bulkBar.remove();
    this.closePillDropdown();

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
    try {
      const callKey = `sourcing_detail_kunden_call_${this.listeId}`;
      this.kundenCallActive = localStorage.getItem(callKey) === 'true';
    } catch (error) {
      this.kundenCallActive = false;
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

  toggleKundenCall() {
    this.kundenCallActive = !this.kundenCallActive;
    try {
      const callKey = `sourcing_detail_kunden_call_${this.listeId}`;
      localStorage.setItem(callKey, this.kundenCallActive ? 'true' : 'false');
    } catch (error) { /* ignore */ }

    const btn = document.getElementById('btn-kunden-call-toggle');
    if (btn) btn.classList.toggle('active', this.kundenCallActive);

    document.querySelectorAll('[data-blur-target]').forEach(el => {
      el.classList.toggle('kunden-call-blur', this.kundenCallActive);
    });
  }

  // --- Rendering ---

  getRenderContext() {
    return {
      items: this.items,
      liste: this.liste,
      isKunde: this.isKunde,
      hiddenColumns: this.hiddenColumns,
      kundenCallActive: this.kundenCallActive,
      teilbereiche: getTeilbereicheFromListe(this.liste)
    };
  }

  async render() {
    const ctx = this.getRenderContext();
    const html = `
      ${!this.isKunde ? renderAddSection(ctx) : ''}
      ${renderItemsTable(ctx)}
    `;
    window.content.innerHTML = html;
    this._updateStickyHeights();

    if (!this.isKunde) {
      this.renderBulkBar();
    }
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

  rerenderTable(movedItemIds = []) {
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
      tableContainer.outerHTML = renderItemsTable(this.getRenderContext());
      this.bindEvents();
      this._updateStickyHeights();

      movedItemIds.forEach(id => {
        const row = document.querySelector(`.item-row[data-item-id="${id}"]`);
        if (row) {
          row.classList.add('kategorie-moving-in');
          row.addEventListener('animationend', () => row.classList.remove('kategorie-moving-in'), { once: true });
        }
      });
    }
  }

  // --- Event-Binding ---

  bindEvents() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();

    // Event-basierte Action-Behandlung (Portal-kompatibel)
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
      const kundenCallBtn = document.getElementById('btn-kunden-call-toggle');
      if (kundenCallBtn) {
        const handler = () => this.toggleKundenCall();
        kundenCallBtn.addEventListener('click', handler);
        this._boundEventListeners.add(() => kundenCallBtn.removeEventListener('click', handler));
      }

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
      this.bindSelectionEvents();
      this.bindPillEvents();
      this.bindBulkBarEvents();
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

    document.querySelectorAll('.cp-col-feedback textarea.auto-resize-textarea').forEach(el => {
      autoResizeTextarea(el);
      const handler = () => autoResizeTextarea(el);
      el.addEventListener('input', handler);
      this._boundEventListeners.add(() => el.removeEventListener('input', handler));
    });
  }

  // --- Drag & Drop ---

  bindDragAndDropEvents() {
    const rows = document.querySelectorAll('.item-row.draggable');
    const kategorieHeaders = document.querySelectorAll('.kategorie-header-row');

    // Drag nur über Handle aktivieren
    const handles = document.querySelectorAll('.drag-handle');
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
    } else if (field === 'preis_ek' || field === 'preis_vk' || field === 'cpm_instagram' || field === 'cpm_tiktok') {
      const numValue = element.value?.trim();
      value = numValue ? parseFloat(numValue) : null;
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

      if (field === 'absage') {
        const updates = { absage: value };
        updates.absage_am = value ? new Date().toISOString() : null;
        await creatorAuswahlService.updateItem(itemId, updates);
        const item = this.items.find(i => i.id === itemId);
        if (item) {
          item.absage = value;
          item.absage_am = updates.absage_am;
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

      this.rerenderTable([itemId]);
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

  // --- Bulk Selection ---

  renderBulkBar() {
    let bar = document.getElementById('sourcing-bulk-bar');

    const teilbereiche = getTeilbereicheFromListe(this.liste);
    const kategorieOptions = [
      '<option value="">Kategorie zuweisen…</option>',
      ...teilbereiche.filter(k => k !== 'Nicht umsetzen').map(k => `<option value="${k}">${k}</option>`),
      '<option value="Ohne Kategorie">Ohne Kategorie</option>',
      '<option value="Nicht umsetzen">Nicht umsetzen</option>'
    ].join('');

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'sourcing-bulk-bar';
      bar.className = 'sourcing-bulk-bar';
      bar.innerHTML = `
        <span class="bulk-count" id="sourcing-bulk-count">0 ausgewählt</span>
        <div class="bulk-bar-actions">
          <select class="bulk-kategorie-select" id="sourcing-bulk-kategorie">
            ${kategorieOptions}
          </select>
          <button class="primary-btn btn-sm" id="btn-bulk-assign">Zuweisen</button>
          <button class="secondary-btn btn-sm" id="btn-bulk-deselect">Auswahl aufheben</button>
        </div>
      `;
      document.body.appendChild(bar);
    } else {
      const select = bar.querySelector('#sourcing-bulk-kategorie');
      if (select) select.innerHTML = kategorieOptions;
    }

    bar.style.display = 'none';
  }

  bindSelectionEvents() {
    const selectAll = document.querySelector('.sourcing-select-all');
    if (selectAll) {
      const handler = (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.sourcing-item-check').forEach(cb => {
          cb.checked = checked;
          if (checked) this.selectedItems.add(cb.dataset.itemId);
          else this.selectedItems.delete(cb.dataset.itemId);
        });
        document.querySelectorAll('.sourcing-group-select').forEach(cb => cb.checked = checked);
        this.updateBulkBar();
      };
      selectAll.addEventListener('change', handler);
      this._boundEventListeners.add(() => selectAll.removeEventListener('change', handler));
    }

    document.querySelectorAll('.sourcing-group-select').forEach(groupCb => {
      const handler = () => {
        const checked = groupCb.checked;
        const headerRow = groupCb.closest('.kategorie-header-row');
        let sibling = headerRow?.nextElementSibling;
        while (sibling && sibling.classList.contains('item-row')) {
          const cb = sibling.querySelector('.sourcing-item-check');
          if (cb) {
            cb.checked = checked;
            if (checked) this.selectedItems.add(cb.dataset.itemId);
            else this.selectedItems.delete(cb.dataset.itemId);
          }
          sibling = sibling.nextElementSibling;
        }
        this.updateSelectAllState();
        this.updateBulkBar();
      };
      groupCb.addEventListener('change', handler);
      this._boundEventListeners.add(() => groupCb.removeEventListener('change', handler));
    });

    document.querySelectorAll('.sourcing-item-check').forEach(cb => {
      const handler = () => {
        if (cb.checked) this.selectedItems.add(cb.dataset.itemId);
        else this.selectedItems.delete(cb.dataset.itemId);
        this.updateGroupSelectState(cb);
        this.updateSelectAllState();
        this.updateBulkBar();
      };
      cb.addEventListener('change', handler);
      this._boundEventListeners.add(() => cb.removeEventListener('change', handler));
    });

    // Restore selection after re-render
    this.selectedItems.forEach(id => {
      const cb = document.querySelector(`.sourcing-item-check[data-item-id="${id}"]`);
      if (cb) cb.checked = true;
    });
    // Remove stale IDs
    const existingIds = new Set(
      Array.from(document.querySelectorAll('.sourcing-item-check')).map(cb => cb.dataset.itemId)
    );
    this.selectedItems.forEach(id => { if (!existingIds.has(id)) this.selectedItems.delete(id); });

    this.updateBulkBar();
  }

  updateSelectAllState() {
    const all = document.querySelectorAll('.sourcing-item-check');
    const checked = document.querySelectorAll('.sourcing-item-check:checked');
    const selectAll = document.querySelector('.sourcing-select-all');
    if (selectAll) {
      selectAll.checked = all.length > 0 && checked.length === all.length;
      selectAll.indeterminate = checked.length > 0 && checked.length < all.length;
    }
  }

  updateGroupSelectState(changedCheckbox) {
    const row = changedCheckbox.closest('.item-row');
    if (!row) return;

    let headerRow = row.previousElementSibling;
    while (headerRow && !headerRow.classList.contains('kategorie-header-row')) {
      headerRow = headerRow.previousElementSibling;
    }
    if (!headerRow) return;

    const groupCb = headerRow.querySelector('.sourcing-group-select');
    if (!groupCb) return;

    let sibling = headerRow.nextElementSibling;
    let total = 0, checkedCount = 0;
    while (sibling && sibling.classList.contains('item-row')) {
      const cb = sibling.querySelector('.sourcing-item-check');
      if (cb) {
        total++;
        if (cb.checked) checkedCount++;
      }
      sibling = sibling.nextElementSibling;
    }

    groupCb.checked = total > 0 && checkedCount === total;
    groupCb.indeterminate = checkedCount > 0 && checkedCount < total;
  }

  updateBulkBar() {
    const bar = document.getElementById('sourcing-bulk-bar');
    if (!bar) return;

    const count = this.selectedItems.size;
    bar.style.display = count > 0 ? 'flex' : 'none';

    const countEl = document.getElementById('sourcing-bulk-count');
    if (countEl) countEl.textContent = `${count} Creator ausgewählt`;
  }

  bindBulkBarEvents() {
    const assignBtn = document.getElementById('btn-bulk-assign');
    if (assignBtn) {
      const handler = () => this.handleBulkKategorieAssign();
      assignBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => assignBtn.removeEventListener('click', handler));
    }

    const deselectBtn = document.getElementById('btn-bulk-deselect');
    if (deselectBtn) {
      const handler = () => {
        this.selectedItems.clear();
        document.querySelectorAll('.sourcing-item-check').forEach(cb => cb.checked = false);
        document.querySelectorAll('.sourcing-group-select').forEach(cb => { cb.checked = false; cb.indeterminate = false; });
        const selectAll = document.querySelector('.sourcing-select-all');
        if (selectAll) { selectAll.checked = false; selectAll.indeterminate = false; }
        this.updateBulkBar();
      };
      deselectBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => deselectBtn.removeEventListener('click', handler));
    }
  }

  async handleBulkKategorieAssign() {
    const select = document.getElementById('sourcing-bulk-kategorie');
    if (!select || !select.value) {
      window.toastSystem?.show('Bitte eine Kategorie auswählen', 'warning');
      return;
    }

    const newKategorie = select.value === 'Ohne Kategorie' ? null : select.value;
    const itemIds = Array.from(this.selectedItems);
    if (itemIds.length === 0) return;

    try {
      if (select.value === 'Nicht umsetzen') {
        const existingKategorien = getTeilbereicheFromListe(this.liste);
        if (!existingKategorien.includes('Nicht umsetzen')) {
          const updatedKategorien = [...existingKategorien, 'Nicht umsetzen'];
          await creatorAuswahlService.updateListe(this.listeId, { teilbereich: updatedKategorien.join(', ') });
          this.liste.teilbereich = updatedKategorien.join(', ');
        }
      }

      itemIds.forEach(id => {
        const row = document.querySelector(`.item-row[data-item-id="${id}"]`);
        if (row) row.classList.add('kategorie-moving-out');
      });

      await creatorAuswahlService.updateItemsKategorie(itemIds, newKategorie);

      this.items.forEach(item => {
        if (itemIds.includes(item.id)) {
          item.kategorie = newKategorie;
          if (select.value === 'Nicht umsetzen') item.nicht_umsetzen = true;
        }
      });

      await new Promise(r => setTimeout(r, 300));

      this.selectedItems.clear();
      select.value = '';
      this.renderBulkBar();
      this.rerenderTable(itemIds);

      window.toastSystem?.show(`${itemIds.length} Creator verschoben`, 'success');
    } catch (error) {
      console.error('Fehler beim Bulk-Zuweisen:', error);
      window.toastSystem?.show('Fehler beim Zuweisen', 'error');
    }
  }

  // --- Kategorie-Pill ---

  bindPillEvents() {
    document.querySelectorAll('.kategorie-pill').forEach(pill => {
      const handler = (e) => {
        e.stopPropagation();
        this.openPillDropdown(pill.dataset.itemId, pill);
      };
      pill.addEventListener('click', handler);
      this._boundEventListeners.add(() => pill.removeEventListener('click', handler));
    });

    const closeHandler = (e) => {
      if (!e.target.closest('.kategorie-pill-dropdown') && !e.target.closest('.kategorie-pill')) {
        this.closePillDropdown();
      }
    };
    document.addEventListener('click', closeHandler);
    this._boundEventListeners.add(() => document.removeEventListener('click', closeHandler));
  }

  openPillDropdown(itemId, pillElement) {
    this.closePillDropdown();

    const teilbereiche = getTeilbereicheFromListe(this.liste);
    const categories = [...teilbereiche.filter(k => k !== 'Nicht umsetzen'), 'Ohne Kategorie'];
    const currentItem = this.items.find(i => i.id === itemId);
    const currentKat = currentItem?.kategorie || 'Ohne Kategorie';

    const dropdown = document.createElement('div');
    dropdown.className = 'kategorie-pill-dropdown';
    dropdown.innerHTML = categories.map(k =>
      `<div class="kategorie-pill-option${k === currentKat ? ' active' : ''}" data-kategorie="${k}">${k}</div>`
    ).join('');

    const rect = pillElement.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.zIndex = '9999';

    document.body.appendChild(dropdown);

    dropdown.querySelectorAll('.kategorie-pill-option').forEach(opt => {
      opt.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newKat = opt.dataset.kategorie;
        if (newKat === currentKat) {
          this.closePillDropdown();
          return;
        }
        this.closePillDropdown();

        const row = document.querySelector(`.item-row[data-item-id="${itemId}"]`);
        if (row) row.classList.add('kategorie-moving-out');
        await new Promise(r => setTimeout(r, 300));

        await this.handleCategoryChange(itemId, newKat);
      });
    });
  }

  closePillDropdown() {
    const existing = document.querySelector('.kategorie-pill-dropdown');
    if (existing) existing.remove();
  }
}

export const creatorAuswahlDetail = new CreatorAuswahlDetail();
