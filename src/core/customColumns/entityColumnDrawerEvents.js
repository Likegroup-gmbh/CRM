// Klicks, Ziehen und Pflege der Dropdown-Optionen im Entity-Spalten-Drawer.

import {
  bindOptionLists,
  commitSavedOptionOrder,
  draftLabelsFromList,
  renderDraftOptionsHtml,
  renderSavedOptionsHtml
} from './dropdownOptionRows.js';
import { renderEntityEmbed } from './entityColumnEmbed.js';

export function installEntityColumnEvents(proto) {
  Object.assign(proto, {
    _bindInteractions(body) {
      this._bindEvents(body);
    },

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
        if (e.target.closest('#btn-close-entity-custom-columns')) return this.close();
        if (e.target.closest('#btn-add-custom-column')) return this._showAddForm();
        if (e.target.closest('#btn-entity-cancel-add-column')) return this._hideAddForm();
        if (e.target.closest('#btn-entity-confirm-add-column')) return this._handleAddColumn();
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
          const label = delNew.dataset.draftLabel;
          const idx = this._newColumnDropdownOptions.indexOf(label);
          if (idx >= 0) this._newColumnDropdownOptions.splice(idx, 1);
          this._refreshNewOptsList();
        }
        if (e.target.closest('#btn-entity-cc-new-opt-add')) this._handleAddNewColumnOption();
      });

      const typeSelect = body.querySelector('#entity-cc-new-type');
      if (typeSelect) {
        on(typeSelect, 'change', () => this._onNewTypeChange(typeSelect.value));
        this._onNewTypeChange(typeSelect.value);
      }

      const newOptInput = body.querySelector('#entity-cc-new-opt-input');
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
          findColumn: (id) => this.columns.find(col => col.id === id),
          update: (optionId, position) => this.dataLoader.updateDropdownOption(optionId, { position }),
          onChange: () => this.onChange?.()
        }),
        onDraft: (list) => {
          this._newColumnDropdownOptions = draftLabelsFromList(list);
        }
      });
    },

    _refreshNewOptsList() {
      const list = this._interactionRoot()?.querySelector('.cc-new-dd-list')
        || document.querySelector('.cc-new-dd-list');
      if (!list) return;
      list.innerHTML = renderDraftOptionsHtml(this._newColumnDropdownOptions);
      this._bindOptionDrags(this._interactionRoot());
    },

    async _handleAddDropdownOption(columnId) {
      const input = document.querySelector(`.dropdown-opt-new-input[data-column-id="${columnId}"]`);
      const label = input?.value.trim();
      if (!label) { window.toastSystem?.show('Bitte einen Wert eingeben', 'warning'); return; }
      const col = this.columns.find(c => c.id === columnId);
      if (!col) return;
      if ((col._dropdownOptions || []).some(o => o.label === label)) {
        window.toastSystem?.show('Option existiert bereits', 'warning'); return;
      }
      try {
        const newOpt = await this.dataLoader.addDropdownOption(columnId, label);
        (col._dropdownOptions ||= []).push(newOpt);
        this._refreshDropdownPanel(columnId);
        this.onChange?.();
      } catch (error) {
        console.error('❌ Option hinzufügen fehlgeschlagen:', error);
        window.toastSystem?.show('Fehler beim Hinzufügen', 'error');
      }
    },

    async _handleDeleteDropdownOption(optionId, columnId) {
      const col = this.columns.find(c => c.id === columnId);
      if (!col) return;
      try {
        await this.dataLoader.deleteDropdownOption(optionId);
        col._dropdownOptions = (col._dropdownOptions || []).filter(o => o.id !== optionId);
        this._refreshDropdownPanel(columnId);
        this.onChange?.();
      } catch (error) {
        console.error('❌ Option löschen fehlgeschlagen:', error);
        window.toastSystem?.show('Fehler beim Löschen', 'error');
      }
    },

    async _handleRenameDropdownOption(optionId, columnId, newLabel) {
      if (!newLabel) return;
      const col = this.columns.find(c => c.id === columnId);
      if (!col) return;
      const opt = (col._dropdownOptions || []).find(o => o.id === optionId);
      if (!opt || opt.label === newLabel) return;
      try {
        await this.dataLoader.updateDropdownOption(optionId, { label: newLabel });
        opt.label = newLabel;
        this.onChange?.();
      } catch (error) {
        console.error('❌ Option umbenennen fehlgeschlagen:', error);
        window.toastSystem?.show('Fehler beim Umbenennen', 'error');
      }
    },

    _refreshDropdownPanel(columnId) {
      const panel = this._interactionRoot()?.querySelector(`.cc-dropdown-panel[data-column-id="${columnId}"]`)
        || document.querySelector(`.cc-dropdown-panel[data-column-id="${columnId}"]`);
      if (!panel) {
        if (this._embedded) renderEntityEmbed(this);
        else this._refreshContent();
        return;
      }
      const col = this.columns.find(c => c.id === columnId);
      if (col) panel.innerHTML = renderSavedOptionsHtml(col);
      this._bindOptionDrags(this._interactionRoot());
    }
  });
}
