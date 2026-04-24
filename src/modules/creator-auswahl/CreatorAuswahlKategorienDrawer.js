// CreatorAuswahlKategorienDrawer.js
// Drawer zum Verwalten von Kategorien (Teilbereichen) einer Creator-Auswahl-Liste

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { getTeilbereicheFromListe } from './CreatorAuswahlTemplates.js';

export class CreatorAuswahlKategorienDrawer {
  constructor(detail) {
    this.detail = detail;
  }

  renderBody() {
    const teilbereiche = getTeilbereicheFromListe(this.detail.liste);

    return `
      <div class="kategorien-list" id="kategorien-list">
        ${teilbereiche.length > 0 ? teilbereiche.map(tb => `
          <div class="kategorie-item" data-kategorie="${tb}">
            <span class="kategorie-name">${tb}</span>
            <button type="button" class="kategorie-delete-btn" data-kategorie="${tb}" title="Kategorie löschen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        `).join('') : '<p style="color: var(--text-secondary); text-align: center;">Noch keine Kategorien definiert</p>'}
      </div>
      <div class="kategorien-add-form" style="margin-top: var(--space-md); display: flex; gap: var(--space-sm);">
        <input type="text" id="new-kategorie-input" class="form-input" placeholder="Neue Kategorie..." style="flex: 1;">
        <button type="button" id="btn-add-kategorie" class="primary-btn">Hinzufügen</button>
      </div>
    `;
  }

  async handleAdd() {
    const input = document.getElementById('new-kategorie-input');
    const newKategorie = input?.value?.trim();

    if (!newKategorie) {
      window.toastSystem?.show('Bitte einen Namen eingeben', 'warning');
      return;
    }

    const existingKategorien = getTeilbereicheFromListe(this.detail.liste);
    if (existingKategorien.includes(newKategorie)) {
      window.toastSystem?.show('Diese Kategorie existiert bereits', 'warning');
      return;
    }

    try {
      const updatedKategorien = [...existingKategorien, newKategorie];
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

    document.querySelectorAll('.kategorie-delete-btn').forEach(btn => {
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
        <p class="drawer-subtitle">Kategorien für die Creator-Gruppierung</p>
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
