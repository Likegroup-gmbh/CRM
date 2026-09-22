// CastingDetailBulk.js
// Auswahl, Statusfilter im Toolbar-Menue und Bulk-Persona
// (Prototype-Mixin von CreatorAuswahlDetail)

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';
import { bindToolbarMenu as attachToolbarMenu } from '../../core/components/ToolbarMenu.js';
import { icon } from '../../core/icons/IconSystem.js';
import {
  NICHT_UMSETZEN_KATEGORIE,
  NICHT_UMSETZEN_KEY,
  OHNE_PERSONA_KEY,
  personaDisplayLabel,
  updatesForGroupKey
} from './castingPersonaGroups.js';

export function renderBulkBar() {
  let bar = document.getElementById('sourcing-bulk-bar');

  const personaOptions = [
    '<option value="">Persona zuweisen…</option>',
    ...(this.personas || []).map(p => `<option value="${escapeAttr(p.id)}">${escapeAttr(personaDisplayLabel(p))}</option>`),
    '<option value="Ohne Persona">Ohne Persona</option>',
    `<option value="${NICHT_UMSETZEN_KATEGORIE}">${NICHT_UMSETZEN_KATEGORIE}</option>`
  ].join('');

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'sourcing-bulk-bar';
    bar.className = 'sourcing-bulk-bar';
    bar.innerHTML = `
      <span class="bulk-count" id="sourcing-bulk-count">0 ausgewählt</span>
      <div class="bulk-bar-actions">
        <select class="bulk-kategorie-select" id="sourcing-bulk-kategorie">
          ${personaOptions}
        </select>
        <button class="mdc-btn mdc-btn--sm" id="btn-bulk-assign">Zuweisen</button>
        <button class="mdc-btn mdc-btn--secondary mdc-btn--sm" id="btn-bulk-deselect">Auswahl aufheben</button>
      </div>
    `;
    document.body.appendChild(bar);
  } else {
    const select = bar.querySelector('#sourcing-bulk-kategorie');
    if (select) select.innerHTML = personaOptions;
  }

  bar.style.display = 'none';
}

export function bindSelectionEvents() {
  const selectAll = this._q('.sourcing-select-all');
  if (selectAll) {
    const handler = (e) => {
      const checked = e.target.checked;
      this._qq('.sourcing-item-check').forEach(cb => {
        cb.checked = checked;
        if (checked) this.selectedItems.add(cb.dataset.itemId);
        else this.selectedItems.delete(cb.dataset.itemId);
      });
      this._qq('.sourcing-group-select').forEach(cb => cb.checked = checked);
      this.updateBulkBar();
    };
    selectAll.addEventListener('change', handler);
    this._boundEventListeners.add(() => selectAll.removeEventListener('change', handler));
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

  this._qq('.sourcing-item-check').forEach(cb => {
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
    const cb = this._q(`.sourcing-item-check[data-item-id="${id}"]`);
    if (cb) cb.checked = true;
  });
  // Remove stale IDs
  const existingIds = new Set(
    Array.from(this._qq('.sourcing-item-check')).map(cb => cb.dataset.itemId)
  );
  this.selectedItems.forEach(id => { if (!existingIds.has(id)) this.selectedItems.delete(id); });

  this.updateBulkBar();
}

export function updateSelectAllState() {
  const all = this._qq('.sourcing-item-check');
  const checked = this._qq('.sourcing-item-check:checked');
  const selectAll = this._q('.sourcing-select-all');
  if (selectAll) {
    selectAll.checked = all.length > 0 && checked.length === all.length;
    selectAll.indeterminate = checked.length > 0 && checked.length < all.length;
  }
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
  const bar = document.getElementById('sourcing-bulk-bar');
  if (!bar) return;

  const count = this.selectedItems.size;
  bar.style.display = count > 0 ? 'flex' : 'none';

  const countEl = document.getElementById('sourcing-bulk-count');
  if (countEl) countEl.textContent = `${count} Creator ausgewählt`;
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

export function bindBulkBarEvents() {
  const assignBtn = document.getElementById('btn-bulk-assign');
  if (assignBtn) {
  const handler = () => this.handleBulkPersonaAssign();
    assignBtn.addEventListener('click', handler);
    this._boundEventListeners.add(() => assignBtn.removeEventListener('click', handler));
  }

  const deselectBtn = document.getElementById('btn-bulk-deselect');
  if (deselectBtn) {
    const handler = () => {
      this.selectedItems.clear();
      this._qq('.sourcing-item-check').forEach(cb => cb.checked = false);
      this._qq('.sourcing-group-select').forEach(cb => { cb.checked = false; cb.indeterminate = false; });
      const selectAll = this._q('.sourcing-select-all');
      if (selectAll) { selectAll.checked = false; selectAll.indeterminate = false; }
      this.updateBulkBar();
    };
    deselectBtn.addEventListener('click', handler);
    this._boundEventListeners.add(() => deselectBtn.removeEventListener('click', handler));
  }
}

export async function handleBulkPersonaAssign() {
  const select = document.getElementById('sourcing-bulk-kategorie');
  if (!select || !select.value) {
    window.toastSystem?.show('Bitte eine Persona auswählen', 'warning');
    return;
  }

  const itemIds = Array.from(this.selectedItems);
  if (itemIds.length === 0) return;

  const groupKey = select.value === NICHT_UMSETZEN_KATEGORIE
    ? NICHT_UMSETZEN_KEY
    : select.value === 'Ohne Persona'
      ? OHNE_PERSONA_KEY
      : select.value;
  const updates = updatesForGroupKey(groupKey, groupKey === select.value ? select.value : null);

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

export const castingDetailBulkMethods = {
  renderBulkBar,
  bindSelectionEvents,
  updateSelectAllState,
  updateGroupSelectState,
  updateBulkBar,
  bindToolbarMenu,
  _syncStatusFilterSubmenu,
  bindBulkBarEvents,
  handleBulkPersonaAssign
};
