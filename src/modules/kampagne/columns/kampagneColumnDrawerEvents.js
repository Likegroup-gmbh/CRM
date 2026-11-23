// Klicks und Ziehen der Dropdown-Optionen im Kampagnen-Spalten-Drawer.

import { CustomColumnDataLoader } from './CustomColumnDataLoader.js';
import {
  bindOptionLists,
  commitSavedOptionOrder,
  draftLabelsFromList
} from '../../../core/customColumns/dropdownOptionRows.js';

export function installKampagneColumnEvents(proto) {
  Object.assign(proto, {
    _bindEvents(body) {
      this._unbindInteractions?.();
      const cleanups = [];
      const on = (target, type, fn, options) => {
        target.addEventListener(type, fn, options);
        cleanups.push(() => target.removeEventListener(type, fn, options));
      };

      on(body, 'click', (e) => {
        if (e.target.closest('[data-action="spalten-pflege-zurueck"]')) {
          e.preventDefault();
          this._leaveEmbed?.();
          return;
        }
        if (e.target.closest('#btn-close-custom-columns')) return this.close();
        if (e.target.closest('#btn-add-custom-column')) return this._showForm();
        if (e.target.closest('#btn-cancel-add-column')) return this._hideAddForm();
        if (e.target.closest('#btn-confirm-add-column')) {
          return this._editingColumnId ? this._handleUpdateColumn() : this._handleAddColumn();
        }
        if (e.target.closest('#btn-cc-new-opt-add')) return this._handleAddNewColumnOption();

        const edit = e.target.closest('.custom-col-edit-btn');
        if (edit) {
          const col = this.store.customColumns.find(c => c.id === edit.dataset.columnId);
          if (col) this._showForm(col);
          return;
        }

        const del = e.target.closest('.custom-col-delete-btn');
        if (del) return this._handleDeleteColumn(del.dataset.columnId, del.dataset.columnName);

        const toggle = e.target.closest('.cc-dropdown-toggle');
        if (toggle) return this._toggleDropdownOptions(toggle.dataset.columnId);

        const addOpt = e.target.closest('.dropdown-opt-add-btn');
        if (addOpt) return this._handleAddDropdownOption(addOpt.dataset.columnId);

        const delOpt = e.target.closest('.dropdown-opt-delete');
        if (delOpt) return this._handleDeleteDropdownOption(delOpt.dataset.optionId, delOpt.dataset.columnId);

        const delNew = e.target.closest('.cc-new-opt-delete');
        if (delNew) {
          const idx = this._newColumnDropdownOptions.indexOf(delNew.dataset.draftLabel);
          if (idx >= 0) this._newColumnDropdownOptions.splice(idx, 1);
          this._refreshNewOptsList();
        }
      });

      const typeSelect = body.querySelector('#cc-new-type');
      if (typeSelect) {
        on(typeSelect, 'change', () => this._onNewTypeChange(typeSelect.value));
        this._onNewTypeChange(typeSelect.value);
      }

      const kundeVisible = body.querySelector('#cc-new-kunde-visible');
      if (kundeVisible) on(kundeVisible, 'change', () => this._syncNewKundeEditRow());

      const newOptInput = body.querySelector('#cc-new-opt-input');
      if (newOptInput) {
        on(newOptInput, 'keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); this._handleAddNewColumnOption(); }
        });
      }

      on(body, 'blur', (e) => {
        if (e.target.classList.contains('custom-col-name-input'))
          this._handleRename(e.target.dataset.columnId, e.target.value.trim());
        if (e.target.classList.contains('dropdown-opt-label'))
          this._handleRenameDropdownOption(e.target.dataset.optionId, e.target.dataset.columnId, e.target.value.trim());
      }, true);

      on(body, 'change', (e) => {
        if (e.target.classList.contains('custom-col-kunde-toggle'))
          this._handleKundeToggle(e.target.dataset.columnId, e.target.checked);
        if (e.target.classList.contains('custom-col-kunde-edit-toggle'))
          this._handleKundeEditToggle(e.target.dataset.columnId, e.target.checked);
      });

      on(body, 'keydown', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('dropdown-opt-new-input')) {
          e.preventDefault();
          this._handleAddDropdownOption(e.target.dataset.columnId);
        }
      });

      this._unbindInteractions = () => {
        cleanups.forEach(fn => fn());
        this._unbindOptionDrags?.();
        this._unbindOptionDrags = null;
        this._unbindInteractions = null;
      };
      this._bindOptionDrags(body);
    },

    _interactionRoot() {
      return this._host || document.getElementById(`${this.drawerId}-body`);
    },

    _bindOptionDrags(root) {
      const scope = root || this._interactionRoot();
      if (!scope) return;
      this._unbindOptionDrags?.();
      this._unbindOptionDrags = bindOptionLists(scope, {
        onSaved: (list) => commitSavedOptionOrder(list, {
          findColumn: (id) => this.store.customColumns.find(col => col.id === id),
          update: (optionId, position) => CustomColumnDataLoader.updateDropdownOption(optionId, { position }),
          onChange: () => this.onRefilter?.()
        }),
        onDraft: (list) => {
          this._newColumnDropdownOptions = draftLabelsFromList(list);
        }
      });
    }
  });
}
