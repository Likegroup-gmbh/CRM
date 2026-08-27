// CreatorAuswahlKategorienDrawer.js
// Drawer zum Verwalten von Kategorien (Teilbereichen) einer Creator-Auswahl-Liste

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { getTeilbereicheFromListe, resolveSourcingKategorie } from './CreatorAuswahlTemplates.js';
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
  }

  renderBody() {
    const teilbereiche = getTeilbereicheFromListe(this.detail.liste);

    return `
      <div class="kategorien-list" id="kategorien-list">
        ${teilbereiche.length > 0 ? teilbereiche.map(tb => `
          <div class="kategorie-item" data-kategorie="${escapeAttr(tb)}">
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
        <p class="drawer-subtitle">Kategorien hinzufügen, umbenennen oder entfernen</p>
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
