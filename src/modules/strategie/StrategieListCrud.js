// StrategieListCrud.js
// Create/Edit/Delete Drawer und Handler für Strategien

import { strategieService } from './StrategieService.js';

export function showHowToModal() {
  if (window.modalSystem) {
    window.modalSystem.open({
      title: 'Wie funktionieren Konzepte?',
      content: `
        <div class="how-to-content">
          <p><strong>1. Konzept erstellen</strong></p>
          <p>Klicke auf "Neues Konzept anlegen" und wähle Unternehmen, Marke und Kampagne aus.</p>
          <p><strong>2. Items hinzufügen</strong></p>
          <p>Füge Video-Konzepte, Hooks und andere Elemente zum Konzept hinzu.</p>
          <p><strong>3. Mit Kunden teilen</strong></p>
          <p>Kunden können das Konzept einsehen und Feedback geben.</p>
        </div>
      `,
      size: 'medium'
    });
  }
}

export async function confirmDeleteStrategie(list, id) {
  if (window.confirmationModal) {
    const result = await window.confirmationModal.open({
      title: 'Konzept löschen',
      message: 'Möchten Sie dieses Konzept wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (result?.confirmed) {
      await deleteStrategie(list, id);
    }
  } else if (confirm('Möchten Sie dieses Konzept wirklich löschen?')) {
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
    window.toastSystem?.show('Konzept erfolgreich gelöscht', 'success');
    list._forceReload = true;
    list.strategien = [];
    await list.loadAndRender();
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    window.toastSystem?.show('Fehler beim Löschen des Konzepts', 'error');
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
      <span class="drawer-title">Neues Konzept</span>
      <p class="drawer-subtitle">Erstellen Sie ein neues Konzept für eine Kampagne</p>
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
      window.toastSystem?.show('Bitte geben Sie einen Konzeptnamen ein', 'error');
      return;
    }

    const newStrategie = await strategieService.createStrategie(submitData);
    if (newStrategie?.id) {
      window.toastSystem?.show('Konzept erfolgreich erstellt', 'success');
      closeCreateDrawer();
      window.navigateTo(`/konzepte/${newStrategie.id}`);
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
    if (!strategie) throw new Error('Konzept nicht gefunden');

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
        <span class="drawer-title">Konzept bearbeiten</span>
        <p class="drawer-subtitle">Konzept bearbeiten</p>
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

        <div class="mdc-field" id="edit-strategie-briefing-field">
          <label class="mdc-label" for="edit-strategie-briefing">Briefing</label>
          <select id="edit-strategie-briefing" name="briefing_id" class="mdc-select">
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
    window.toastSystem?.show('Fehler beim Laden des Konzepts', 'error');
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

  await renderEditBriefingField(list, strategie);
}

// Briefing-Pflicht (Step 1): gesetzter Link ist eingefroren (read-only Anzeige).
// Altbestand ohne Link darf genau einmal gesetzt werden (searchable Picker,
// finalisierte Briefings des Unternehmens, bei Marke nur dieser Marke).
async function renderEditBriefingField(list, strategie) {
  const briefingSelect = document.getElementById('edit-strategie-briefing');
  const briefingField = document.getElementById('edit-strategie-briefing-field');
  if (!briefingSelect || !briefingField) return;

  if (strategie.briefing_id) {
    const { data: briefing } = await window.supabase
      .from('campaign_briefings')
      .select('aktivierung_name')
      .eq('id', strategie.briefing_id)
      .single();
    const name = briefing?.aktivierung_name || 'Briefing';
    briefingField.innerHTML = `
      <label class="mdc-label">Briefing</label>
      <div class="mdc-input mdc-input--readonly">${list.sanitize(name)}</div>
    `;
    return;
  }

  if (!strategie.unternehmen_id) {
    briefingSelect.innerHTML = '<option value="">-- Zuerst Unternehmen wählen --</option>';
    briefingSelect.disabled = true;
    return;
  }

  let query = window.supabase
    .from('campaign_briefings')
    .select('id, aktivierung_name')
    .eq('unternehmen_id', strategie.unternehmen_id)
    .eq('is_draft', false)
    .order('created_at', { ascending: false });
  if (strategie.marke_id) {
    query = query.eq('marke_id', strategie.marke_id);
  }
  const { data: briefings } = await query;

  if (!briefings || briefings.length === 0) {
    const params = new URLSearchParams({ unternehmen: strategie.unternehmen_id });
    if (strategie.marke_id) params.set('marke', strategie.marke_id);
    briefingSelect.innerHTML = `<option value="">Kein finalisiertes Briefing — zuerst anlegen: /briefing/new?${params.toString()}</option>`;
    briefingSelect.disabled = true;
    return;
  }

  const options = briefings.map(b => ({
    value: b.id,
    label: b.aktivierung_name || `Briefing ${b.id.slice(0, 6)}`
  }));
  briefingSelect.innerHTML = '<option value="">-- Briefing wählen (optional) --</option>';
  briefingSelect.disabled = false;
  window.formSystem?.createSearchableSelect(briefingSelect, options, {
    name: 'briefing_id',
    placeholder: 'Briefing suchen und auswählen...'
  });
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
    // Searchable-Select traegt den Wert im hidden input; das Original-select
    // hat kein name-Attribut mehr. querySelector('[name="briefing_id"]')
    // trifft daher den hidden input.
    const briefingId = form.querySelector('[name="briefing_id"]')?.value || null;

    if (!name) {
      window.toastSystem?.show('Bitte geben Sie einen Konzeptnamen ein', 'error');
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
    // Nur mitschicken wenn gesetzt (Grandfather: einmal setzen erlaubt).
    // Der Service-Lock verwirft leere/ausgelassene Werte bei bestehendem Link.
    if (briefingId) {
      updates.briefing_id = briefingId;
    }

    await strategieService.updateStrategie(strategieId, updates);

    window.toastSystem?.show('Konzept erfolgreich aktualisiert', 'success');
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
