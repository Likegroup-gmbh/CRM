// CreatorAuswahlKategorienDrawer.js
// Drawer zum Verwalten von Kategorien (Teilbereichen) einer Creator-Auswahl-Liste

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { getTeilbereicheFromListe, resolveSourcingKategorie, reorderSourcingItemsByKategorien } from './CreatorAuswahlTemplates.js';
import { icon } from '../../core/icons/IconSystem.js';
import { escapeAttr } from '../../core/VideoUploadUtils.js';

export const NICHT_UMSETZEN_KATEGORIE = 'Nicht umsetzen';

/**
 * Validiert Add/Rename eines Kategorienamens (CSV-Speicher, Duplikate, Reserviert).
 * @returns {{ error?: string, unchanged?: boolean, name?: string }}
 */
export function validateSourcingKategorieName(newKategorieInput, { existing = [], oldName = null } = {}) {
  const name = newKategorieInput?.trim();
  if (!name) return { error: 'Bitte einen Namen eingeben' };
  if (name.includes(',')) return { error: 'Kommas sind im Kategorienamen nicht erlaubt' };

  const oldNormalized = oldName?.trim().toLowerCase() ?? null;
  const newNormalized = name.toLowerCase();

  if (oldNormalized === NICHT_UMSETZEN_KATEGORIE.toLowerCase() && newNormalized !== oldNormalized) {
    return { error: '"Nicht umsetzen" kann nicht umbenannt werden' };
  }

  const hasDuplicate = existing.some(k => {
    const kn = k.trim().toLowerCase();
    return kn === newNormalized && kn !== oldNormalized;
  });
  if (hasDuplicate) return { error: 'Diese Kategorie existiert bereits' };

  if (oldNormalized !== null && newNormalized === oldNormalized) {
    return { unchanged: true, name };
  }

  return { name };
}

export class CreatorAuswahlKategorienDrawer {
  constructor(detail) {
    this.detail = detail;
    this._reorderUnbind = [];
  }

  renderBody() {
    const teilbereiche = getTeilbereicheFromListe(this.detail.liste);

    return `
      <div class="kategorien-list" id="kategorien-list">
        ${teilbereiche.length > 0 ? teilbereiche.map(tb => `
          <div class="kategorie-item" data-kategorie="${escapeAttr(tb)}" draggable="false">
            <button type="button" class="kategorie-drag-handle" data-action="drag-kategorie" title="Reihenfolge ändern" aria-label="Reihenfolge ändern">
              ${icon('bars-3', { className: 'icon-16' })}
            </button>
            <button type="button" class="kategorie-name" data-action="edit-kategorie" data-kategorie="${escapeAttr(tb)}" title="Kategorie umbenennen">${escapeAttr(tb)}</button>
            <button type="button" class="kategorie-delete-btn" data-action="edit-kategorie" data-kategorie="${escapeAttr(tb)}" title="Kategorie umbenennen">
              ${icon('pencil-square', { className: 'icon-16' })}
            </button>
            <button type="button" class="kategorie-delete-btn" data-action="delete-kategorie" data-kategorie="${escapeAttr(tb)}" title="Kategorie löschen">
              ${icon('x-mark', { className: 'icon-16' })}
            </button>
          </div>
        `).join('') : '<p class="u-text-center u-text-secondary">Noch keine Kategorien definiert</p>'}
      </div>
      <div class="kategorien-add-form">
        <input type="text" id="new-kategorie-input" class="form-input flex-1" placeholder="Neue Kategorie...">
        <button type="button" id="btn-add-kategorie" class="mdc-btn">Hinzufügen</button>
      </div>
    `;
  }

  async handleAdd() {
    const input = document.getElementById('new-kategorie-input');
    const existingKategorien = getTeilbereicheFromListe(this.detail.liste);
    const result = validateSourcingKategorieName(input?.value, { existing: existingKategorien });

    if (result.error) {
      window.toastSystem?.show(result.error, 'warning');
      return;
    }

    try {
      const updatedKategorien = [...existingKategorien, result.name];
      const teilbereichString = updatedKategorien.join(', ');

      await creatorAuswahlService.updateListe(this.detail.listeId, { teilbereich: teilbereichString });
      this.detail.liste.teilbereich = teilbereichString;

      this.rerenderBody();
      this.detail.rerenderTable();

      window.toastSystem?.show('Kategorie hinzugefügt', 'success');
    } catch (error) {
      console.error('Fehler beim Hinzufügen der Kategorie:', error);
      window.toastSystem?.show('Fehler beim Hinzufügen', 'error');
    }
  }

  startInlineEdit(row, kategorie) {
    const checkSvg = icon('check-bold', { stroke: 2 });
    const cancelSvg = icon('x-mark', { stroke: 2 });

    row.innerHTML = `
      <input type="text" class="form-input" value="${escapeAttr(kategorie)}">
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
      const didSave = await this.handleRename(kategorie, input.value);
      if (!didSave) saving = false;
    };

    const cancel = () => {
      this.rerenderBody();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });

    row.querySelector('[data-action="save-kategorie"]').addEventListener('click', save);
    row.querySelector('[data-action="cancel-edit"]').addEventListener('click', cancel);
  }

  async handleRename(oldKategorie, newKategorieInput) {
    const existingKategorien = getTeilbereicheFromListe(this.detail.liste);
    const result = validateSourcingKategorieName(newKategorieInput, {
      existing: existingKategorien,
      oldName: oldKategorie
    });

    if (result.error) {
      window.toastSystem?.show(result.error, 'warning');
      return false;
    }

    if (result.unchanged) {
      this.rerenderBody();
      return true;
    }

    const newKategorie = result.name;

    try {
      const updatedKategorien = existingKategorien.map(k => (k === oldKategorie ? newKategorie : k));
      const teilbereichString = updatedKategorien.length > 0 ? updatedKategorien.join(', ') : null;

      await creatorAuswahlService.updateListe(this.detail.listeId, { teilbereich: teilbereichString });

      const itemsToUpdate = (this.detail.items || []).filter(
        item => resolveSourcingKategorie(item.kategorie, existingKategorien) === oldKategorie
      );

      if (itemsToUpdate.length > 0) {
        await creatorAuswahlService.updateItemsKategorie(
          itemsToUpdate.map(item => item.id),
          newKategorie
        );
        itemsToUpdate.forEach(item => {
          item.kategorie = newKategorie;
        });
      }

      this.detail.liste.teilbereich = teilbereichString;

      this.rerenderBody();
      this.detail.rerenderTable();

      window.toastSystem?.show(`Kategorie "${oldKategorie}" wurde umbenannt`, 'success');
      return true;
    } catch (error) {
      console.error('Fehler beim Umbenennen der Kategorie:', error);
      window.toastSystem?.show('Fehler beim Umbenennen', 'error');
      return false;
    }
  }

  async applyKategorieOrder(nextKategorien) {
    const existingKategorien = getTeilbereicheFromListe(this.detail.liste);
    if (nextKategorien.join('\0') === existingKategorien.join('\0')) return false;
    if (nextKategorien.length !== existingKategorien.length) return false;

    const existingSet = new Set(existingKategorien);
    if (nextKategorien.some(k => !existingSet.has(k))) return false;

    const teilbereichString = nextKategorien.join(', ');

    try {
      await creatorAuswahlService.updateListe(this.detail.listeId, { teilbereich: teilbereichString });
      this.detail.liste.teilbereich = teilbereichString;

      const reorderedItems = reorderSourcingItemsByKategorien(this.detail.items || [], nextKategorien);
      if (reorderedItems.length > 0) {
        await creatorAuswahlService.updateItemsSortierungWithKategorie(reorderedItems);
        this.detail.items = reorderedItems;
      }

      this.rerenderBody();
      this.detail.rerenderTable();
      window.toastSystem?.show('Reihenfolge gespeichert', 'success');
      return true;
    } catch (error) {
      console.error('Fehler beim Sortieren der Kategorien:', error);
      window.toastSystem?.show('Fehler beim Sortieren', 'error');
      this.rerenderBody();
      return false;
    }
  }

  async handleReorderFromDom() {
    const list = document.getElementById('kategorien-list');
    if (!list) return;
    const next = Array.from(list.querySelectorAll('.kategorie-item')).map(row => row.dataset.kategorie);
    await this.applyKategorieOrder(next);
  }

  unbindReorder() {
    this._reorderUnbind.forEach(fn => fn());
    this._reorderUnbind = [];
  }

  bindReorderEvents() {
    this.unbindReorder();
    const list = document.getElementById('kategorien-list');
    if (!list) return;

    const rows = () => list.querySelectorAll('.kategorie-item');

    list.querySelectorAll('[data-action="drag-kategorie"]').forEach(handle => {
      const onMouseDown = () => {
        handle.closest('.kategorie-item')?.setAttribute('draggable', 'true');
      };
      handle.addEventListener('mousedown', onMouseDown);
      this._reorderUnbind.push(() => handle.removeEventListener('mousedown', onMouseDown));
    });

    const onMouseUp = () => {
      rows().forEach(row => row.setAttribute('draggable', 'false'));
    };
    document.addEventListener('mouseup', onMouseUp);
    this._reorderUnbind.push(() => document.removeEventListener('mouseup', onMouseUp));

    rows().forEach(row => {
      const onDragStart = (e) => {
        this._draggedKategorieRow = row;
        row.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.kategorie);
      };
      const onDragEnd = async () => {
        row.classList.remove('is-dragging');
        row.setAttribute('draggable', 'false');
        this._draggedKategorieRow = null;
        list.querySelectorAll('.kategorie-item.drag-over').forEach(el => el.classList.remove('drag-over'));
        await this.handleReorderFromDom();
      };
      const onDragOver = (e) => {
        e.preventDefault();
        const dragged = this._draggedKategorieRow;
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
      this._reorderUnbind.push(() => {
        row.removeEventListener('dragstart', onDragStart);
        row.removeEventListener('dragend', onDragEnd);
        row.removeEventListener('dragover', onDragOver);
        row.removeEventListener('drop', onDrop);
      });
    });
  }

  async handleDelete(kategorie) {
    const result = await window.confirmationModal?.open({
      title: 'Kategorie löschen?',
      message: `Möchten Sie die Kategorie "${kategorie}" wirklich löschen? Items in dieser Kategorie werden zu "Ohne Kategorie" verschoben.`,
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;

    try {
      const existingKategorien = getTeilbereicheFromListe(this.detail.liste);
      const updatedKategorien = existingKategorien.filter(k => k !== kategorie);
      const teilbereichString = updatedKategorien.length > 0 ? updatedKategorien.join(', ') : null;

      await creatorAuswahlService.updateListe(this.detail.listeId, { teilbereich: teilbereichString });

      const itemsToUpdate = this.detail.items.filter(item => item.kategorie === kategorie);
      for (const item of itemsToUpdate) {
        await creatorAuswahlService.updateItem(item.id, { kategorie: null });
        item.kategorie = null;
      }

      this.detail.liste.teilbereich = teilbereichString;

      this.rerenderBody();
      this.detail.rerenderTable();

      window.toastSystem?.show('Kategorie gelöscht', 'success');
    } catch (error) {
      console.error('Fehler beim Löschen der Kategorie:', error);
      window.toastSystem?.show('Fehler beim Löschen', 'error');
    }
  }

  rerenderBody() {
    this.unbindReorder();
    const drawerBody = document.getElementById('kategorien-drawer-body');
    if (drawerBody) {
      drawerBody.innerHTML = this.renderBody();
      this.bindEvents();
    }
  }

  bindEvents() {
    const addBtn = document.getElementById('btn-add-kategorie');
    const input = document.getElementById('new-kategorie-input');

    if (addBtn) {
      addBtn.addEventListener('click', () => this.handleAdd());
    }

    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleAdd();
        }
      });
    }

    document.querySelectorAll('[data-action="edit-kategorie"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const row = btn.closest('.kategorie-item');
        if (!row) return;
        this.startInlineEdit(row, btn.dataset.kategorie);
      });
    });

    document.querySelectorAll('[data-action="delete-kategorie"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleDelete(btn.dataset.kategorie);
      });
    });

    this.bindReorderEvents();
  }

  open() {
    this.remove();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'kategorien-drawer-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'kategorien-drawer';

    const header = document.createElement('div');
    header.className = 'drawer-header';
    header.innerHTML = `
      <div>
        <span class="drawer-title">Kategorien verwalten</span>
        <p class="drawer-subtitle">Kategorien hinzufügen, umbenennen, sortieren oder entfernen</p>
      </div>
      <div>
        <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = 'kategorien-drawer-body';
    body.innerHTML = this.renderBody();

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.close());
    header.querySelector('.drawer-close-btn').addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    this.bindEvents();
  }

  remove() {
    this.unbindReorder();
    ['kategorien-drawer-overlay', 'kategorien-drawer'].forEach(id => {
      document.getElementById(id)?.remove();
    });
  }

  close() {
    document.getElementById('kategorien-drawer-overlay')?.classList.remove('active');
    document.getElementById('kategorien-drawer')?.classList.remove('show');
    setTimeout(() => this.remove(), 300);
  }
}
