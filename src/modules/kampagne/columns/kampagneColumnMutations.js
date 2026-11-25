// Anlegen, Speichern und Dropdown-Optionen der Kampagnen-Spalten.

import { CustomColumnDataLoader } from './CustomColumnDataLoader.js';
import { buildColumnOrderWithNewCustom, removeFromColumnOrder } from './ColumnRegistry.js';
import { renderDraftOptionsHtml, renderSavedOptionsHtml } from '../../../core/customColumns/dropdownOptionRows.js';

export function installKampagneColumnMutations(proto) {
  Object.assign(proto, {
    _handleAddNewColumnOption() {
      const input = document.getElementById('cc-new-opt-input');
      const label = input?.value.trim();
      if (!label) return;
      if (this._newColumnDropdownOptions.includes(label)) {
        window.toastSystem?.show('Option existiert bereits', 'warning');
        return;
      }
      this._newColumnDropdownOptions.push(label);
      input.value = '';
      this._refreshNewOptsList();
      input.focus();
    },

    _refreshNewOptsList() {
      const list = this._interactionRoot()?.querySelector('.cc-new-dd-list')
        || document.querySelector('.cc-new-dd-list');
      if (!list) return;
      list.innerHTML = renderDraftOptionsHtml(this._newColumnDropdownOptions);
      this._bindOptionDrags(this._interactionRoot());
    },

    async _handleUpdateColumn() {
      const col = this.store.customColumns.find(c => c.id === this._editingColumnId);
      if (!col) { this._hideAddForm(); return; }

      const name = document.getElementById('cc-new-name')?.value.trim();
      const fieldType = document.getElementById('cc-new-type')?.value;
      const visible = document.getElementById('cc-new-kunde-visible')?.checked || false;
      const editable = visible && fieldType !== 'upload'
        && (document.getElementById('cc-new-kunde-editable')?.checked || false);

      if (!name) { window.toastSystem?.show('Bitte einen Namen eingeben', 'warning'); return; }

      const patch = {
        name,
        field_type: fieldType,
        visible_for_kunden: visible,
        editable_by_kunden: editable
      };

      try {
        await CustomColumnDataLoader.updateColumn(col.id, patch);
        this.store.updateCustomColumn(col.id, patch);
        this._hideAddForm();
        this._refreshContent();
        this.onRefilter?.();
        window.toastSystem?.show(`Spalte „${name}" gespeichert`, 'success');
      } catch (error) {
        console.error('❌ Spalte speichern fehlgeschlagen:', error);
        window.toastSystem?.show('Fehler beim Speichern der Spalte', 'error');
      }
    },

    async _handleAddColumn() {
      const name = document.getElementById('cc-new-name')?.value.trim();
      const fieldType = document.getElementById('cc-new-type')?.value;
      const entityType = document.getElementById('cc-new-entity')?.value;
      const visibleForKunden = document.getElementById('cc-new-kunde-visible')?.checked || false;
      const editableByKunden = visibleForKunden && fieldType !== 'upload'
        && (document.getElementById('cc-new-kunde-editable')?.checked || false);

      if (!name) { window.toastSystem?.show('Bitte einen Namen eingeben', 'warning'); return; }

      try {
        const col = await CustomColumnDataLoader.createColumn(this.kampagneId, {
          name, field_type: fieldType, entity_type: entityType,
          visible_for_kunden: visibleForKunden, editable_by_kunden: editableByKunden
        });

        if (fieldType === 'dropdown' && this._newColumnDropdownOptions.length > 0) {
          const created = [];
          for (const lbl of this._newColumnDropdownOptions) {
            try { created.push(await CustomColumnDataLoader.addDropdownOption(col.id, lbl)); }
            catch (e) { console.warn('⚠️ Option nicht angelegt:', lbl, e); }
          }
          col._dropdownOptions = created;
        }

        this.store.addCustomColumn(col);
        const newOrder = buildColumnOrderWithNewCustom(this.store.columnOrder, col.id);
        await CustomColumnDataLoader.saveColumnOrder(this.kampagneId, newOrder);
        this.store.setColumnOrder(newOrder);

        this._hideAddForm();
        this._refreshContent();
        this.onRefilter?.();
        window.toastSystem?.show(`Spalte „${name}" angelegt`, 'success');
      } catch (error) {
        console.error('❌ Spalte anlegen fehlgeschlagen:', error);
        window.toastSystem?.show('Fehler beim Anlegen der Spalte', 'error');
      }
    },

    async _handleDeleteColumn(columnId, columnName) {
      const { confirmed } = await window.confirmationModal.open({
        title: 'Spalte löschen',
        message: `Spalte „${columnName}" wirklich löschen? Alle eingegebenen Werte gehen verloren.`,
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      if (!confirmed) return;
      try {
        await CustomColumnDataLoader.deleteColumn(columnId);
        this.store.removeCustomColumn(columnId);
        const newOrder = removeFromColumnOrder(this.store.columnOrder, columnId);
        if (newOrder) {
          await CustomColumnDataLoader.saveColumnOrder(this.kampagneId, newOrder);
          this.store.setColumnOrder(newOrder);
        }
        this._refreshContent();
        this.onRefilter?.();
        window.toastSystem?.show(`Spalte „${columnName}" gelöscht`, 'success');
      } catch (error) {
        console.error('❌ Spalte löschen fehlgeschlagen:', error);
        window.toastSystem?.show('Fehler beim Löschen', 'error');
      }
    },

    async _handleRename(columnId, newName) {
      if (!newName) return;
      const col = this.store.customColumns.find(c => c.id === columnId);
      if (!col || col.name === newName) return;
      try {
        await CustomColumnDataLoader.updateColumn(columnId, { name: newName });
        this.store.updateCustomColumn(columnId, { name: newName });
        this.onRefilter?.();
      } catch (error) {
        console.error('❌ Umbenennen fehlgeschlagen:', error);
        window.toastSystem?.show('Fehler beim Umbenennen', 'error');
      }
    },

    async _handleKundeToggle(columnId, visible) {
      try {
        const patch = visible
          ? { visible_for_kunden: true }
          : { visible_for_kunden: false, editable_by_kunden: false };
        await CustomColumnDataLoader.updateColumn(columnId, patch);
        this.store.updateCustomColumn(columnId, patch);
        this._refreshContent();
        this.onRefilter?.();
      } catch (error) {
        console.error('❌ Kunden-Sichtbarkeit fehlgeschlagen:', error);
        window.toastSystem?.show('Fehler beim Ändern', 'error');
      }
    },

    async _handleKundeEditToggle(columnId, editable) {
      try {
        await CustomColumnDataLoader.updateColumn(columnId, { editable_by_kunden: editable });
        this.store.updateCustomColumn(columnId, { editable_by_kunden: editable });
        this.onRefilter?.();
      } catch (error) {
        console.error('❌ Kunden-Bearbeitbarkeit fehlgeschlagen:', error);
        window.toastSystem?.show('Fehler beim Ändern', 'error');
      }
    },

    _toggleDropdownOptions(columnId) {
      this._expandedDropdownColId = this._expandedDropdownColId === columnId ? null : columnId;
      this._refreshContent();
    },

    async _handleAddDropdownOption(columnId) {
      const input = document.querySelector(`.dropdown-opt-new-input[data-column-id="${columnId}"]`);
      const label = input?.value.trim();
      if (!label) { window.toastSystem?.show('Bitte einen Wert eingeben', 'warning'); return; }
      const col = this.store.customColumns.find(c => c.id === columnId);
      if (!col) return;
      if ((col._dropdownOptions || []).some(o => o.label === label)) {
        window.toastSystem?.show('Option existiert bereits', 'warning'); return;
      }
      try {
        const newOpt = await CustomColumnDataLoader.addDropdownOption(columnId, label);
        if (!col._dropdownOptions) col._dropdownOptions = [];
        col._dropdownOptions.push(newOpt);
        this._refreshDropdownPanel(columnId);
        this.onRefilter?.();
      } catch (error) {
        console.error('❌ Option hinzufügen fehlgeschlagen:', error);
        window.toastSystem?.show('Fehler beim Hinzufügen', 'error');
      }
    },

    async _handleDeleteDropdownOption(optionId, columnId) {
      const col = this.store.customColumns.find(c => c.id === columnId);
      if (!col) return;
      try {
        await CustomColumnDataLoader.deleteDropdownOption(optionId);
        col._dropdownOptions = (col._dropdownOptions || []).filter(o => o.id !== optionId);
        this._refreshDropdownPanel(columnId);
        this.onRefilter?.();
      } catch (error) {
        console.error('❌ Option löschen fehlgeschlagen:', error);
        window.toastSystem?.show('Fehler beim Löschen', 'error');
      }
    },

    async _handleRenameDropdownOption(optionId, columnId, newLabel) {
      if (!newLabel) return;
      const col = this.store.customColumns.find(c => c.id === columnId);
      if (!col) return;
      const opt = (col._dropdownOptions || []).find(o => o.id === optionId);
      if (!opt || opt.label === newLabel) return;
      try {
        await CustomColumnDataLoader.updateDropdownOption(optionId, { label: newLabel });
        opt.label = newLabel;
        this.onRefilter?.();
      } catch (error) {
        console.error('❌ Option umbenennen fehlgeschlagen:', error);
        window.toastSystem?.show('Fehler beim Umbenennen', 'error');
      }
    },

    _refreshDropdownPanel(columnId) {
      const root = this._interactionRoot();
      const panel = root?.querySelector(`.cc-dropdown-panel[data-column-id="${columnId}"]`)
        || document.querySelector(`.cc-dropdown-panel[data-column-id="${columnId}"]`);
      if (!panel) { this._refreshContent(); return; }
      const col = this.store.customColumns.find(c => c.id === columnId);
      if (col) panel.innerHTML = renderSavedOptionsHtml(col);
      this._bindOptionDrags(root);
    }
  });
}
