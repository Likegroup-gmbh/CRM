// CreatorAuswahlListDrawers.js
// Anlegen, Umbenennen und Loeschen einer Casting-Liste (Prototype-Mixin von CreatorAuswahlList)

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { berechneHiddenColumns, STANDARD_VERSTECKTE_SPALTEN } from './sourcingSpaltenPreset.js';

export async function confirmDeleteListe(id) {
  if (!window.canDelete?.('sourcing')) {
    window.toastSystem?.show('Sie haben keine Berechtigung für diese Aktion.', 'warning');
    return;
  }
  if (window.confirmationModal) {
    const result = await window.confirmationModal.open({
      title: 'Casting-Liste löschen',
      message: 'Möchten Sie diese Casting-Liste wirklich löschen? Alle zugeordneten Creator werden entfernt.',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (result?.confirmed) {
      await this.deleteListe(id);
    }
  } else if (confirm('Möchten Sie diese Casting-Liste wirklich löschen?')) {
    await this.deleteListe(id);
  }
}

export async function deleteListe(id) {
  try {
    await creatorAuswahlService.deleteListe(id);
    window.toastSystem?.show('Casting-Liste erfolgreich gelöscht', 'success');
    this._forceReload = true;
    this.listen = [];
    await this.loadAndRender();
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    window.toastSystem?.show('Fehler beim Löschen der Casting-Liste', 'error');
  }
}

export function openRenameDrawer(listeId, currentName) {
  if (!window.canEdit?.('sourcing')) return;
  this.closeRenameDrawer();

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = 'sourcing-rename-drawer-overlay';

  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'drawer-panel';
  panel.id = 'sourcing-rename-drawer';

  const header = document.createElement('div');
  header.className = 'drawer-header';
  header.innerHTML = `
    <div>
      <span class="drawer-title">Name bearbeiten</span>
      <p class="drawer-subtitle">Ändern Sie den Namen dieser Casting-Liste</p>
    </div>
    <div>
      <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'drawer-body';
  body.innerHTML = `
    <form id="sourcing-rename-form">
      <div class="form-group">
        <label class="form-label" for="rename-liste-name">Name</label>
        <input type="text" id="rename-liste-name" class="form-input" value="${currentName}" required>
      </div>
      <div class="drawer-footer u-mt-lg">
        <button type="submit" class="mdc-btn">Speichern</button>
        <button type="button" class="mdc-btn mdc-btn--secondary rename-cancel-btn">Abbrechen</button>
      </div>
    </form>
  `;

  panel.appendChild(header);
  panel.appendChild(body);

  overlay.addEventListener('click', () => this.closeRenameDrawer());
  header.querySelector('.drawer-close-btn').addEventListener('click', () => this.closeRenameDrawer());

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  requestAnimationFrame(() => {
    panel.classList.add('show');
  });

  const form = panel.querySelector('#sourcing-rename-form');
  const input = panel.querySelector('#rename-liste-name');
  input.focus();
  input.select();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const newName = input.value.trim();
    if (!newName) {
      window.toastSystem?.show('Name darf nicht leer sein', 'warning');
      return;
    }
    await this.handleRenameSubmit(listeId, newName);
  };

  body.querySelector('.rename-cancel-btn').addEventListener('click', () => this.closeRenameDrawer());
}

export function closeRenameDrawer() {
  const overlay = document.getElementById('sourcing-rename-drawer-overlay');
  const panel = document.getElementById('sourcing-rename-drawer');

  if (panel) {
    panel.classList.remove('show');
    setTimeout(() => {
      overlay?.remove();
      panel?.remove();
    }, 300);
  } else {
    overlay?.remove();
  }
}

export async function handleRenameSubmit(listeId, newName) {
  try {
    await creatorAuswahlService.updateListe(listeId, { name: newName });

    const liste = this.listen.find(l => l.id === listeId);
    if (liste) liste.name = newName;

    window.toastSystem?.show('Name erfolgreich geändert', 'success');
    this.closeRenameDrawer();
    this.loadAndRender();
  } catch (error) {
    console.error('Fehler beim Umbenennen:', error);
    window.toastSystem?.show('Fehler beim Umbenennen der Liste', 'error');
  }
}

export function openCreateDrawer() {
  this.closeCreateDrawer();

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = 'sourcing-create-drawer-overlay';

  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'drawer-panel';
  panel.id = 'sourcing-create-drawer';

  const header = document.createElement('div');
  header.className = 'drawer-header';
  header.innerHTML = `
    <div>
      <span class="drawer-title">Neue Casting-Liste</span>
      <p class="drawer-subtitle">Erstellen Sie eine neue Casting-Liste für eine Kampagne</p>
    </div>
    <div>
      <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'drawer-body';
  body.innerHTML = window.formSystem.renderFormOnly('sourcing');

  panel.appendChild(header);
  panel.appendChild(body);

  overlay.addEventListener('click', () => this.closeCreateDrawer());
  header.querySelector('.drawer-close-btn').addEventListener('click', () => this.closeCreateDrawer());

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  requestAnimationFrame(() => {
    panel.classList.add('show');
  });

  window.formSystem.bindFormEvents('sourcing', null);

  const form = panel.querySelector('#sourcing-form');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      await this.handleCreateFormSubmit(form);
    };

    const cancelBtn = form.querySelector('.mdc-btn--cancel');
    if (cancelBtn) {
      cancelBtn.onclick = (e) => {
        e.preventDefault();
        this.closeCreateDrawer();
      };
    }
  }
}

export function closeCreateDrawer() {
  const overlay = document.getElementById('sourcing-create-drawer-overlay');
  const panel = document.getElementById('sourcing-create-drawer');

  if (panel) {
    panel.classList.remove('show');
    setTimeout(() => {
      overlay?.remove();
      panel?.remove();
    }, 300);
  } else {
    overlay?.remove();
  }
}

export async function handleCreateFormSubmit(form) {
  try {
    const submitData = window.formSystem.collectSubmitData(form);
    this.applySpaltenPreset(submitData);

    if (!submitData.name || submitData.name.trim() === '') {
      const generatedName = await this.autoGeneration.autoGenerateSourcingName(
        submitData.kampagne_id,
        submitData.marke_id,
        submitData.unternehmen_id
      );
      if (generatedName) submitData.name = generatedName;
    }

    const newListe = await creatorAuswahlService.createListe(submitData);
    if (newListe?.id) {
      window.toastSystem?.show('Casting-Liste erfolgreich erstellt', 'success');
      this.closeCreateDrawer();
      window.navigateTo(`/castings/${newListe.id}`);
    } else {
      throw new Error('Keine ID zurückgegeben');
    }
  } catch (error) {
    console.error('❌ Fehler beim Erstellen:', error);
    window.toastSystem?.show(`Fehler beim Erstellen: ${error.message}`, 'error');
  }
}

/**
 * Listentyp, Plattform und Instagram-Format legen die Startsichtbarkeit der
 * Spalten fest. Die drei Werte werden mitgespeichert und sind spaeter im
 * Drawer "Tabelle anpassen" der Detailseite aenderbar.
 */
export function applySpaltenPreset(submitData) {
  // Creator Art startet ausgeblendet. Bewusst hier und nicht im Preset: das
  // Preset laeuft bei jeder Typ-Aenderung im Drawer erneut und wuerde die
  // Spalte sonst wieder ausblenden, nachdem jemand sie eingeschaltet hat.
  submitData.hidden_columns = [
    ...berechneHiddenColumns(submitData),
    ...STANDARD_VERSTECKTE_SPALTEN
  ];

  // Nur bei Influencer-Listen abgefragt: leere Strings wuerden sonst als ''
  // in der DB landen und die Matrix beim Bearbeiten verfaelschen.
  if (!submitData.plattformen) submitData.plattformen = null;
  if (!submitData.ig_formate) submitData.ig_formate = null;

  const tkp = Number(submitData.tkp);
  submitData.tkp = Number.isFinite(tkp) && tkp >= 0 ? tkp : 25;
}

export function showCreateForm() {
  if (window.location.pathname !== '/castings') {
    window.navigateTo('/castings');
    setTimeout(() => this.openCreateDrawer(), 100);
  } else {
    this.openCreateDrawer();
  }
}

export const creatorAuswahlListDrawersMethods = {
  confirmDeleteListe,
  deleteListe,
  openRenameDrawer,
  closeRenameDrawer,
  handleRenameSubmit,
  openCreateDrawer,
  closeCreateDrawer,
  handleCreateFormSubmit,
  applySpaltenPreset,
  showCreateForm
};
