// StrategieListCrud.js
// Create/Edit/Delete Drawer und Handler für Strategien

import { strategieService } from './StrategieService.js';

export function showHowToModal() {
  if (window.modalSystem) {
    window.modalSystem.open({
      title: 'Wie funktioniert die Strategie?',
      content: `
        <div class="how-to-content">
          <p><strong>1. Strategie erstellen</strong></p>
          <p>Klicke auf "Neue Strategie anlegen" und wähle Unternehmen, Marke und Kampagne aus.</p>
          <p><strong>2. Items hinzufügen</strong></p>
          <p>Füge Video-Konzepte, Hooks und andere Elemente zur Strategie hinzu.</p>
          <p><strong>3. Mit Kunden teilen</strong></p>
          <p>Kunden können die Strategie einsehen und Feedback geben.</p>
        </div>
      `,
      size: 'medium'
    });
  }
}

export async function confirmDeleteStrategie(list, id) {
  if (window.confirmationModal) {
    const result = await window.confirmationModal.open({
      title: 'Strategie löschen',
      message: 'Möchten Sie diese Strategie wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (result?.confirmed) {
      await deleteStrategie(list, id);
    }
  } else if (confirm('Möchten Sie diese Strategie wirklich löschen?')) {
    await deleteStrategie(list, id);
  }
}

async function deleteStrategie(list, id) {
  try {
    const { error } = await window.supabase
      .from('strategie')
      .delete()
      .eq('id', id);

    if (error) throw error;
    window.toastSystem?.show('Strategie erfolgreich gelöscht', 'success');
    list._forceReload = true;
    list.strategien = [];
    await list.loadAndRender();
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    window.toastSystem?.show('Fehler beim Löschen der Strategie', 'error');
  }
}

export function openCreateDrawer(list) {
  closeCreateDrawer();

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = 'strategie-create-drawer-overlay';

  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.className = 'drawer-panel';
  panel.id = 'strategie-create-drawer';

  const header = document.createElement('div');
  header.className = 'drawer-header';
  header.innerHTML = `
    <div>
      <span class="drawer-title">Neue Strategie</span>
      <p class="drawer-subtitle">Erstellen Sie eine neue Strategie für eine Kampagne</p>
    </div>
    <div>
      <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'drawer-body';
  body.innerHTML = window.formSystem.renderFormOnly('strategie');

  panel.appendChild(header);
  panel.appendChild(body);

  overlay.addEventListener('click', () => closeCreateDrawer());
  header.querySelector('.drawer-close-btn').addEventListener('click', () => closeCreateDrawer());

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  requestAnimationFrame(() => {
    panel.classList.add('show');
  });

  window.formSystem.bindFormEvents('strategie', null);
  const form = panel.querySelector('#strategie-form');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      await handleCreateFormSubmit(list, form);
    };
    const cancelBtn = form.querySelector('.mdc-btn--cancel');
    if (cancelBtn) {
      cancelBtn.onclick = (e) => {
        e.preventDefault();
        closeCreateDrawer();
      };
    }
  }
}

export function closeCreateDrawer() {
  const overlay = document.getElementById('strategie-create-drawer-overlay');
  const panel = document.getElementById('strategie-create-drawer');

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

async function handleCreateFormSubmit(list, form) {
  try {
    const submitData = window.formSystem.collectSubmitData(form);
    if (!submitData.name || submitData.name.trim() === '') {
      window.toastSystem?.show('Bitte geben Sie einen Strategienamen ein', 'error');
      return;
    }

    const newStrategie = await strategieService.createStrategie(submitData);
    if (newStrategie?.id) {
      window.toastSystem?.show('Strategie erfolgreich erstellt', 'success');
      closeCreateDrawer();
      window.navigateTo(`/strategie/${newStrategie.id}`);
    } else {
      throw new Error('Keine ID zurückgegeben');
    }
  } catch (error) {
    console.error('❌ Fehler beim Erstellen:', error);
    window.toastSystem?.show(`Fehler beim Erstellen: ${error.message}`, 'error');
  }
}

export async function openEditDrawer(list, strategieId) {
  closeEditDrawer();

  try {
    const strategie = await strategieService.getStrategieById(strategieId);
    if (!strategie) throw new Error('Strategie nicht gefunden');

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'strategie-edit-drawer-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'strategie-edit-drawer';

    const header = document.createElement('div');
    header.className = 'drawer-header';
    header.innerHTML = `
      <div>
        <span class="drawer-title">Strategie bearbeiten</span>
        <p class="drawer-subtitle">Strategie bearbeiten</p>
      </div>
      <div>
        <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.innerHTML = `
      <form id="strategie-edit-form" class="mdc-form" novalidate>
        <input type="hidden" name="strategie_id" value="${strategie.id}" />

        <div class="mdc-field">
          <label class="mdc-label" for="edit-strategie-name">Name <span class="required">*</span></label>
          <input type="text" id="edit-strategie-name" name="name" class="mdc-input" value="${list.sanitize(strategie.name || '')}" required />
        </div>

        <div class="mdc-field">
          <label class="mdc-label" for="edit-strategie-unternehmen">Unternehmen <span class="required">*</span></label>
          <select id="edit-strategie-unternehmen" name="unternehmen_id" class="mdc-select" required>
            <option value="">Wird geladen...</option>
          </select>
        </div>

        <div class="mdc-field">
          <label class="mdc-label" for="edit-strategie-marke">Marke</label>
          <select id="edit-strategie-marke" name="marke_id" class="mdc-select">
            <option value="">Wird geladen...</option>
          </select>
        </div>

        <div class="mdc-field">
          <label class="mdc-label" for="edit-strategie-kampagne">Kampagne <span class="required">*</span></label>
          <select id="edit-strategie-kampagne" name="kampagne_id" class="mdc-select" required>
            <option value="">Wird geladen...</option>
          </select>
        </div>

        <div class="mdc-form-actions">
          <button type="button" class="mdc-btn mdc-btn--cancel">Abbrechen</button>
          <button type="submit" class="mdc-btn mdc-btn--primary">Speichern</button>
        </div>
      </form>
    `;

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => closeEditDrawer());
    header.querySelector('.drawer-close-btn').addEventListener('click', () => closeEditDrawer());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      panel.classList.add('show');
    });

    await populateEditSelects(list, strategie);
    bindEditSelectCascades(list);

    const form = panel.querySelector('#strategie-edit-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await handleEditFormSubmit(list, strategie.id, form);
      };
      const cancelBtn = form.querySelector('.mdc-btn--cancel');
      if (cancelBtn) {
        cancelBtn.onclick = (e) => {
          e.preventDefault();
          closeEditDrawer();
        };
      }
    }

  } catch (error) {
    console.error('Fehler beim Öffnen des Edit-Drawers:', error);
    window.toastSystem?.show('Fehler beim Laden der Strategie', 'error');
  }
}

export function closeEditDrawer() {
  const overlay = document.getElementById('strategie-edit-drawer-overlay');
  const panel = document.getElementById('strategie-edit-drawer');

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

async function populateEditSelects(list, strategie) {
  const unternehmenSelect = document.getElementById('edit-strategie-unternehmen');
  const markeSelect = document.getElementById('edit-strategie-marke');
  const kampagneSelect = document.getElementById('edit-strategie-kampagne');

  const unternehmen = await strategieService.getAllUnternehmen();
  unternehmenSelect.innerHTML = '<option value="">-- Unternehmen wählen --</option>' +
    unternehmen.map(u => `<option value="${u.id}" ${u.id === strategie.unternehmen_id ? 'selected' : ''}>${list.sanitize(u.firmenname)}</option>`).join('');

  if (strategie.unternehmen_id) {
    const marken = await strategieService.getAllMarken(strategie.unternehmen_id);
    markeSelect.innerHTML = '<option value="">-- Keine Marke --</option>' +
      marken.map(m => `<option value="${m.id}" ${m.id === strategie.marke_id ? 'selected' : ''}>${list.sanitize(m.markenname)}</option>`).join('');

    const kampagneFilter = strategie.marke_id || null;
    let kampagnen;
    if (kampagneFilter) {
      kampagnen = await strategieService.getAllKampagnen(kampagneFilter);
    } else {
      const { data } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname')
        .eq('unternehmen_id', strategie.unternehmen_id)
        .order('kampagnenname');
      kampagnen = data || [];
    }
    kampagneSelect.innerHTML = '<option value="">-- Kampagne wählen --</option>' +
      kampagnen.map(k => `<option value="${k.id}" ${k.id === strategie.kampagne_id ? 'selected' : ''}>${list.sanitize(k.kampagnenname)}</option>`).join('');
  } else {
    markeSelect.innerHTML = '<option value="">-- Zuerst Unternehmen wählen --</option>';
    kampagneSelect.innerHTML = '<option value="">-- Zuerst Unternehmen wählen --</option>';
  }
}

function bindEditSelectCascades(list) {
  const unternehmenSelect = document.getElementById('edit-strategie-unternehmen');
  const markeSelect = document.getElementById('edit-strategie-marke');
  const kampagneSelect = document.getElementById('edit-strategie-kampagne');
  const nameInput = document.getElementById('edit-strategie-name');

  if (!unternehmenSelect || !markeSelect || !kampagneSelect) return;

  unternehmenSelect.addEventListener('change', async () => {
    const unternehmenId = unternehmenSelect.value;
    markeSelect.innerHTML = '<option value="">Wird geladen...</option>';
    kampagneSelect.innerHTML = '<option value="">-- Zuerst Unternehmen/Marke wählen --</option>';

    if (!unternehmenId) {
      markeSelect.innerHTML = '<option value="">-- Zuerst Unternehmen wählen --</option>';
      return;
    }

    const marken = await strategieService.getAllMarken(unternehmenId);
    markeSelect.innerHTML = '<option value="">-- Keine Marke --</option>' +
      marken.map(m => `<option value="${m.id}">${list.sanitize(m.markenname)}</option>`).join('');

    const { data: kampagnen } = await window.supabase
      .from('kampagne')
      .select('id, kampagnenname')
      .eq('unternehmen_id', unternehmenId)
      .order('kampagnenname');
    kampagneSelect.innerHTML = '<option value="">-- Kampagne wählen --</option>' +
      (kampagnen || []).map(k => `<option value="${k.id}">${list.sanitize(k.kampagnenname)}</option>`).join('');
  });

  markeSelect.addEventListener('change', async () => {
    const markeId = markeSelect.value;
    const unternehmenId = unternehmenSelect.value;
    kampagneSelect.innerHTML = '<option value="">Wird geladen...</option>';

    let kampagnen;
    if (markeId) {
      kampagnen = await strategieService.getAllKampagnen(markeId);
    } else if (unternehmenId) {
      const { data } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname')
        .eq('unternehmen_id', unternehmenId)
        .order('kampagnenname');
      kampagnen = data || [];
    } else {
      kampagnen = [];
    }

    kampagneSelect.innerHTML = '<option value="">-- Kampagne wählen --</option>' +
      kampagnen.map(k => `<option value="${k.id}">${list.sanitize(k.kampagnenname)}</option>`).join('');
  });

}

async function handleEditFormSubmit(list, strategieId, form) {
  const submitBtn = form.querySelector('.mdc-btn--primary');
  const originalText = submitBtn?.textContent;
  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Speichern...';
    }

    const name = form.querySelector('[name="name"]').value.trim();
    const unternehmenId = form.querySelector('[name="unternehmen_id"]').value;
    const markeId = form.querySelector('[name="marke_id"]').value || null;
    const kampagneId = form.querySelector('[name="kampagne_id"]').value;

    if (!name) {
      window.toastSystem?.show('Bitte geben Sie einen Strategienamen ein', 'error');
      return;
    }
    if (!unternehmenId) {
      window.toastSystem?.show('Bitte wählen Sie ein Unternehmen aus', 'error');
      return;
    }
    if (!kampagneId) {
      window.toastSystem?.show('Bitte wählen Sie eine Kampagne aus', 'error');
      return;
    }

    const updates = {
      name,
      unternehmen_id: unternehmenId,
      marke_id: markeId,
      kampagne_id: kampagneId
    };

    await strategieService.updateStrategie(strategieId, updates);

    window.toastSystem?.show('Strategie erfolgreich aktualisiert', 'success');
    closeEditDrawer();
    list._forceReload = true;
    list.strategien = [];
    await list.loadAndRender();

  } catch (error) {
    console.error('Fehler beim Aktualisieren:', error);
    window.toastSystem?.show(`Fehler beim Aktualisieren: ${error.message}`, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}
