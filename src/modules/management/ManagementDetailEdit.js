// Bearbeiten eines Managements und Zuordnen oder Entfernen von Creatorn.

import { FormSubmitHelper } from '../../core/form/FormSubmitHelper.js';

export async function showAddCreatorDialog(detail) {
  const existingIds = detail.creators.map(c => c.id);
  const { data: allCreators } = await window.supabase
    .from('creator')
    .select('id, vorname, nachname')
    .order('nachname');

  const available = (allCreators || []).filter(c => !existingIds.includes(c.id));
  if (available.length === 0) {
    window.toastSystem?.show('Keine weiteren Creator verfügbar.', 'info');
    return;
  }

  const options = available.map(c => `<option value="${c.id}">${c.vorname || ''} ${c.nachname || ''}</option>`).join('');
  const dialog = document.createElement('div');
  dialog.className = 'modal show';
  dialog.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4)';
  dialog.innerHTML = `
    <div class="mgmt-add-creator-dialog">
      <h3 class="mgmt-add-creator-title">Creator hinzufügen</h3>
      <select id="mgmt-add-creator-select" class="mgmt-add-creator-select">
        <option value="">Bitte wählen...</option>
        ${options}
      </select>
      <div class="mgmt-add-creator-actions">
        <button class="mdc-btn mdc-btn--secondary mdc-btn--sm" id="mgmt-add-cancel">Abbrechen</button>
        <button class="mdc-btn mdc-btn--sm" id="mgmt-add-confirm">Hinzufügen</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  dialog.querySelector('#mgmt-add-cancel').onclick = () => dialog.remove();
  dialog.querySelector('#mgmt-add-confirm').onclick = async () => {
    const creatorId = dialog.querySelector('#mgmt-add-creator-select').value;
    if (!creatorId) return;
    dialog.remove();

    const { data: existing } = await window.supabase
      .from('creator_management')
      .select('id')
      .eq('management_id', detail.managementId)
      .eq('creator_id', creatorId)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await window.supabase
        .from('creator_management')
        .update({ ist_aktiv: true, updated_at: new Date().toISOString() })
        .eq('id', existing.id));
    } else {
      ({ error } = await window.supabase
        .from('creator_management')
        .insert([{ management_id: detail.managementId, creator_id: creatorId, ist_aktiv: true }]));
    }

    if (error) {
      window.toastSystem?.show('Fehler: ' + error.message, 'error');
    } else {
      window.toastSystem?.success('Creator zugeordnet!');
      await detail.loadManagementData();
      detail.render();
    }
  };
}

export async function removeCreatorFromManagement(detail, creatorId) {
  if (!confirm('Creator-Zuordnung wirklich entfernen?')) return;
  const { error } = await window.supabase
    .from('creator_management')
    .update({ ist_aktiv: false })
    .eq('management_id', detail.managementId)
    .eq('creator_id', creatorId)
    .eq('ist_aktiv', true);

  if (error) {
    window.toastSystem?.show('Fehler: ' + error.message, 'error');
  } else {
    window.toastSystem?.success('Creator-Zuordnung entfernt.');
    await detail.loadManagementData();
    detail.render();
  }
}

export async function showManagementEditForm(detail) {
  if (!detail.management || detail._isEditing) return;

  try {
    detail._isEditing = true;
    window.breadcrumbSystem?.showEditLeaf();

    const formData = {
      ...detail.management,
      creator_ids: detail.creators.map(c => c.id).filter(Boolean),
      _isEditMode: true,
      _entityId: detail.managementId
    };

    const formHtml = window.formSystem.renderFormOnly('management', formData);
    window.setHeadline(`${detail.management.firmenname || 'Management'} bearbeiten`);
    window.content.innerHTML = `
      <div class="form-page form-page--half">
        ${formHtml}
      </div>
    `;

    await window.formSystem.bindFormEvents('management', formData);

    const form = document.getElementById('management-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await handleEditSubmit(detail, form);
      };
    }
  } catch (error) {
    detail._isEditing = false;
    console.error('❌ MANAGEMENTDETAIL: Fehler beim Öffnen des Bearbeiten-Formulars:', error);
    window.toastSystem?.show('Formular konnte nicht geladen werden: ' + error.message, 'error');
  }
}

async function handleEditSubmit(detail, form) {
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn?.innerHTML;

  try {
    if (submitBtn) {
      submitBtn.innerHTML = '<div class="loading-spinner"></div> Wird gespeichert...';
      submitBtn.disabled = true;
    }

    const data = FormSubmitHelper.formDataToObject(
      new FormData(form),
      FormSubmitHelper.collectTagBasedSelects(form)
    );

    if (typeof data.firmenname === 'string') data.firmenname = data.firmenname.trim();
    if (!data.firmenname || data.firmenname.length < 2) {
      throw new Error('Bitte einen Firmennamen mit mindestens 2 Zeichen angeben.');
    }

    const creatorIds = Array.isArray(data.creator_ids) ? data.creator_ids : [];
    delete data.creator_ids;

    const result = await window.dataService.updateEntity('management', detail.managementId, data);
    if (!result.success) throw new Error(result.error || 'Fehler beim Speichern');

    await syncCreatorZuordnung(detail, creatorIds);

    window.toastSystem?.success('Management erfolgreich aktualisiert!');
    document.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'management', id: detail.managementId }
    }));

    if (/\/edit\/?$/.test(location.pathname)) {
      window.navigateTo(`/management/${detail.managementId}`);
    } else {
      await detail.init(detail.managementId);
    }
  } catch (error) {
    console.error('❌ MANAGEMENTDETAIL: Fehler beim Speichern:', error);
    window.toastSystem?.show('Fehler beim Speichern: ' + error.message, 'error');
    if (submitBtn) {
      submitBtn.innerHTML = originalText || 'Speichern';
      submitBtn.disabled = false;
    }
  }
}

async function syncCreatorZuordnung(detail, creatorIds) {
  const desired = new Set(creatorIds);

  const { data: rows, error } = await window.supabase
    .from('creator_management')
    .select('id, creator_id, ist_aktiv')
    .eq('management_id', detail.managementId);
  if (error) throw error;

  const now = new Date().toISOString();
  const existing = new Set();

  for (const row of rows || []) {
    existing.add(row.creator_id);
    const shouldBeActive = desired.has(row.creator_id);
    if (shouldBeActive === !!row.ist_aktiv) continue;
    const { error: updError } = await window.supabase
      .from('creator_management')
      .update({ ist_aktiv: shouldBeActive, updated_at: now })
      .eq('id', row.id);
    if (updError) throw updError;
  }

  const toInsert = [...desired]
    .filter(id => !existing.has(id))
    .map(creator_id => ({ management_id: detail.managementId, creator_id, ist_aktiv: true }));

  if (toInsert.length > 0) {
    const { error: insError } = await window.supabase.from('creator_management').insert(toInsert);
    if (insError) throw insError;
  }
}
