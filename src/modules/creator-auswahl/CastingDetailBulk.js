// CastingDetailBulk.js
// Auswahl, Statusfilter im Toolbar-Menue und Bulk-Kategorie
// (Prototype-Mixin von CreatorAuswahlDetail)

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { bindToolbarMenu as attachToolbarMenu } from '../../core/components/ToolbarMenu.js';
import { icon } from '../../core/icons/IconSystem.js';
import { SelectionBar, bindCheckboxSelection } from '../../core/list/SelectionBar.js';
import {
  NICHT_UMSETZEN_KATEGORIE,
  NICHT_UMSETZEN_KEY,
  OHNE_KATEGORIE,
  OHNE_KATEGORIE_KEY,
  updatesForGroupKey
} from './castingKategorien.js';

export function renderBulkBar() {
  if (!this.selectionBar) {
    this.selectionBar = new SelectionBar({
      id: 'sourcing-bulk-bar',
      countLabel: 'Creator ausgewählt',
      onAction: (name) => {
        if (name === 'assign') this.handleBulkKategorieAssign();
        else if (name === 'delete') this.handleBulkDelete();
      },
      onDeselect: () => this.clearSelection()
    });
  }

  const kategorieOptions = [
    '<option value="">Kategorie zuweisen…</option>',
    ...this.getTeilbereiche().map(name => `<option value="${escapeAttr(name)}">${escapeAttr(name)}</option>`),
    `<option value="${OHNE_KATEGORIE_KEY}">${OHNE_KATEGORIE}</option>`,
    `<option value="${NICHT_UMSETZEN_KEY}">${NICHT_UMSETZEN_KATEGORIE}</option>`
  ].join('');

  this.selectionBar.mount(`
    <select class="bulk-kategorie-select" id="sourcing-bulk-kategorie">
      ${kategorieOptions}
    </select>
    <button type="button" class="mdc-btn mdc-btn--sm" data-selection-action="assign">Zuweisen</button>
    ${this._canSourcing('delete')
      ? '<button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm selection-bar-delete" data-selection-action="delete">Löschen</button>'
      : ''}
  `);
  this.updateBulkBar();
}

export function bindSelectionEvents() {
  // Item-Checkboxen und Select-All laufen über die gemeinsame Auswahl-Bindung.
  // Sie hängt am stabilen Root und wird bei jedem Rebind neu aufgebaut.
  const root = this._getRoot();
  if (root) {
    this._selectionAbort?.abort();
    this._selectionAbort = new AbortController();
    if (!this._selectionAbortRegistered) {
      this._selectionAbortRegistered = true;
      this._boundEventListeners.add(() => this._selectionAbort?.abort());
    }

    this.selection = bindCheckboxSelection({
      root,
      signal: this._selectionAbort.signal,
      selected: this.selectedItems,
      itemSelector: '.sourcing-item-check',
      selectAllSelector: '.sourcing-select-all',
      keyOf: (cb) => cb.dataset.itemId,
      onChange: ({ source, checkbox, checked }) => {
        if (source === 'all') {
          this._qq('.sourcing-group-select').forEach(cb => {
            cb.checked = checked;
            cb.indeterminate = false;
          });
        } else {
          this.updateGroupSelectState(checkbox);
        }
        this.updateBulkBar();
      }
    });
  }

  this._qq('.sourcing-group-select').forEach(groupCb => {
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

  // Nach dem Render: Häkchen wiederherstellen, verschwundene IDs verwerfen
  this.selection?.restore({ prune: true });

  this.updateBulkBar();
}

export function updateSelectAllState() {
  this.selection?.syncSelectAll();
}

export function updateGroupSelectState(changedCheckbox) {
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

export function updateBulkBar() {
  this.selectionBar?.update(this.selectedItems.size);
}

/** Auswahl komplett aufheben (Items, Gruppen, Select-All, Leiste). */
export function clearSelection() {
  if (this.selection) this.selection.clear();
  else this.selectedItems.clear();
  this._qq('.sourcing-group-select').forEach(cb => { cb.checked = false; cb.indeterminate = false; });
  this.updateBulkBar();
}

export function bindToolbarMenu() {
  const menu = this._q('.toolbar-menu');
  const dropdown = menu?.querySelector('.toolbar-menu-dropdown');
  if (!menu || !dropdown) return;

  this._boundEventListeners.add(attachToolbarMenu(menu));

  const statusFilterHandler = (e) => {
    const reset = e.target.closest('[data-status-filter-reset]');
    if (reset) {
      e.preventDefault();
      e.stopPropagation();
      this.statusFilter = [];
      this._syncStatusFilterSubmenu();
      this.rerenderTable();
      return;
    }

    const item = e.target.closest('.submenu-item[data-status-tag]');
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();

    const tag = item.dataset.statusTag;
    if (!tag) return;

    if (this.statusFilter.includes(tag)) {
      this.statusFilter = this.statusFilter.filter(t => t !== tag);
    } else {
      this.statusFilter = [...this.statusFilter, tag];
    }
    this._syncStatusFilterSubmenu();
    this.rerenderTable();
  };
  dropdown.addEventListener('click', statusFilterHandler);
  this._boundEventListeners.add(() => dropdown.removeEventListener('click', statusFilterHandler));
}

export function _syncStatusFilterSubmenu() {
  const submenu = this._q('.sourcing-status-filter-submenu');
  if (!submenu) return;

  const trigger = submenu.querySelector('.action-item.has-submenu');
  if (trigger) trigger.classList.toggle('active', this.statusFilter.length > 0);

  const panel = submenu.querySelector('.submenu');
  if (!panel) return;

  let resetBtn = panel.querySelector('[data-status-filter-reset]');
  if (this.statusFilter.length > 0) {
    if (!resetBtn) {
      resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'submenu-item sourcing-status-filter-reset';
      resetBtn.setAttribute('data-status-filter-reset', '');
      resetBtn.setAttribute('role', 'menuitem');
      resetBtn.textContent = 'Alle zurücksetzen';
      panel.prepend(resetBtn);
    }
  } else if (resetBtn) {
    resetBtn.remove();
  }

  const checkHtml = `
    ${icon('check-bold')}`;

  panel.querySelectorAll('.submenu-item[data-status-tag]').forEach(item => {
    const tag = item.dataset.statusTag;
    const isActive = this.statusFilter.includes(tag);
    item.setAttribute('aria-checked', isActive ? 'true' : 'false');
    let check = item.querySelector('.submenu-check');
    if (isActive && !check) {
      check = document.createElement('span');
      check.className = 'submenu-check';
      check.innerHTML = checkHtml;
      item.appendChild(check);
    } else if (!isActive && check) {
      check.remove();
    }
  });
}

export async function handleBulkKategorieAssign() {
  const select = document.getElementById('sourcing-bulk-kategorie');
  if (!select || !select.value) {
    window.toastSystem?.show('Bitte eine Kategorie auswählen', 'warning');
    return;
  }

  const itemIds = Array.from(this.selectedItems);
  if (itemIds.length === 0) return;

  const updates = updatesForGroupKey(select.value);

  try {
    itemIds.forEach(id => {
      const row = this._q(`.item-row[data-item-id="${id}"]`);
      if (row) row.classList.add('kategorie-moving-out');
    });

    await creatorAuswahlService.updateItemsGroup(itemIds, updates);

    this.items.forEach(item => {
      if (itemIds.includes(item.id)) Object.assign(item, updates);
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

/** Alle markierten Creator entfernen (gleiche Absicherung wie das Einzel-Löschen). */
export async function handleBulkDelete() {
  if (!this._canSourcing('delete')) return;

  const itemIds = Array.from(this.selectedItems);
  if (itemIds.length === 0) return;

  const anzahl = itemIds.length;
  const result = await window.confirmationModal?.open({
    title: anzahl === 1 ? 'Creator entfernen?' : `${anzahl} Creator entfernen?`,
    message: anzahl === 1
      ? 'Möchten Sie diesen Creator wirklich aus der Liste entfernen?'
      : `Möchten Sie diese ${anzahl} Creator wirklich aus der Liste entfernen?`,
    confirmText: 'Entfernen',
    cancelText: 'Abbrechen',
    danger: true
  });

  if (!result?.confirmed) return;

  const geloescht = [];
  let ersterFehler = null;

  // Nacheinander: deleteItem löst Videoidee-Zuordnungen und blockt bei vorhandenem Skript.
  for (const id of itemIds) {
    try {
      await creatorAuswahlService.deleteItem(id);
      geloescht.push(id);
    } catch (error) {
      console.error('Fehler beim Bulk-Löschen:', error);
      ersterFehler = ersterFehler || error;
    }
  }

  if (geloescht.length > 0) {
    this.items = this.items.filter(item => !geloescht.includes(item.id));
    geloescht.forEach(id => this.selectedItems.delete(id));
    this.rerenderTable();
    this.updateBulkBar();
  }

  const gesamt = geloescht.length === 1 ? '1 Creator entfernt' : `${geloescht.length} Creator entfernt`;
  const fehlerText = ersterFehler?.message || 'Fehler beim Löschen';
  if (!ersterFehler) {
    window.toastSystem?.show(gesamt, 'success');
  } else if (geloescht.length > 0) {
    window.toastSystem?.show(`${gesamt}, ${itemIds.length - geloescht.length} nicht: ${fehlerText}`, 'warning');
  } else {
    window.toastSystem?.show(fehlerText, 'error');
  }
}

export const castingDetailBulkMethods = {
  renderBulkBar,
  bindSelectionEvents,
  updateSelectAllState,
  updateGroupSelectState,
  updateBulkBar,
  clearSelection,
  bindToolbarMenu,
  _syncStatusFilterSubmenu,
  handleBulkKategorieAssign,
  handleBulkDelete
};
