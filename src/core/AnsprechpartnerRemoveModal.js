// AnsprechpartnerRemoveModal.js
// Ansprechpartner (einzeln oder mehrere) vom Unternehmen entfernen.

import { icon } from './icons/IconSystem.js';

export async function openRemoveAnsprechpartnerFromUnternehmenModal(dropdown, unternehmenId) {
  let ansprechpartner = [];

  try {
    const { data } = await window.supabase
      .from('ansprechpartner_unternehmen')
      .select(`ansprechpartner_id, ansprechpartner:ansprechpartner_id (id, vorname, nachname, email, telefonnummer, position:position_id(name), unternehmen:unternehmen_id(firmenname))`)
      .eq('unternehmen_id', unternehmenId);
    ansprechpartner = (data || []).filter(r => r.ansprechpartner).map(r => r.ansprechpartner);
  } catch (error) {
    console.warn('Fehler beim Laden der Ansprechpartner:', error);
  }

  if (ansprechpartner.length === 0) {
    alert('Diesem Unternehmen sind noch keine Ansprechpartner zugeordnet.');
    return;
  }

  const s = window.validatorSystem?.sanitizeHtml?.bind(window.validatorSystem) || (x => x);
  const tableRows = ansprechpartner.map(ap => `
    <tr>
      <td><input type="checkbox" class="ansprechpartner-remove-check" data-id="${ap.id}" /></td>
      <td>
        <a href="#" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${ap.id}')" class="table-link">
          ${s(ap.vorname)} ${s(ap.nachname)}
        </a>
      </td>
      <td>${s(ap.email || '-')}</td>
      <td>${s(ap.telefonnummer || '-')}</td>
      <td>${s(ap.position?.name || '-')}</td>
      <td>
        <button class="mdc-btn btn-remove-single mdc-btn--delete" data-id="${ap.id}" title="Einzeln entfernen">
          ${icon('x-mark', { className: 'w-4 h-4' })}
        </button>
      </td>
    </tr>`).join('');

  const modal = document.createElement('div');
  modal.className = 'modal overlay-modal modal-large';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3>Ansprechpartner vom Unternehmen entfernen</h3>
        <button class="modal-close" id="remove-ansprechpartner-unternehmen-close">×</button>
      </div>
      <div class="modal-body">
        <p class="modal-description">Wählen Sie die Ansprechpartner aus, die Sie vom Unternehmen entfernen möchten:</p>
        <div class="bulk-actions">
          <button id="select-all-ansprechpartner" class="mdc-btn mdc-btn--secondary">Alle auswählen</button>
          <button id="deselect-all-ansprechpartner" class="mdc-btn mdc-btn--secondary">Auswahl aufheben</button>
          <span class="selected-count">0 ausgewählt</span>
        </div>
        <div class="data-table-container">
          <table class="data-table">
            <thead><tr>
              <th width="40"><input type="checkbox" id="select-all-header" /></th>
              <th>Name</th><th>E-Mail</th><th>Telefon</th><th>Position</th><th width="80">Aktion</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="mdc-btn mdc-btn--cancel" id="remove-ansprechpartner-unternehmen-cancel">
          <span class="mdc-btn__icon" aria-hidden="true">
            ${icon('x-circle-filled')}
          </span>
          <span class="mdc-btn__label">Abbrechen</span>
        </button>
        <button class="mdc-btn mdc-btn--delete" id="remove-selected-ansprechpartner" disabled>Ausgewählte entfernen</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const checkboxes = modal.querySelectorAll('.ansprechpartner-remove-check');
  const selectAllHeader = modal.querySelector('#select-all-header');
  const selectAllBtn = modal.querySelector('#select-all-ansprechpartner');
  const deselectAllBtn = modal.querySelector('#deselect-all-ansprechpartner');
  const selectedCountSpan = modal.querySelector('.selected-count');
  const removeSelectedBtn = modal.querySelector('#remove-selected-ansprechpartner');

  const updateSelection = () => {
    const selected = modal.querySelectorAll('.ansprechpartner-remove-check:checked');
    const count = selected.length;
    selectedCountSpan.textContent = `${count} ausgewählt`;
    removeSelectedBtn.disabled = count === 0;
    if (count === 0) { selectAllHeader.checked = false; selectAllHeader.indeterminate = false; }
    else if (count === checkboxes.length) { selectAllHeader.checked = true; selectAllHeader.indeterminate = false; }
    else { selectAllHeader.checked = false; selectAllHeader.indeterminate = true; }
  };

  checkboxes.forEach(cb => cb.addEventListener('change', updateSelection));
  selectAllHeader.addEventListener('change', () => { checkboxes.forEach(cb => { cb.checked = selectAllHeader.checked; }); updateSelection(); });
  selectAllBtn.addEventListener('click', () => { checkboxes.forEach(cb => { cb.checked = true; }); updateSelection(); });
  deselectAllBtn.addEventListener('click', () => { checkboxes.forEach(cb => { cb.checked = false; }); updateSelection(); });

  modal.querySelectorAll('.btn-remove-single').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const apId = e.target.closest('.btn-remove-single').dataset.id;
      const ap = ansprechpartner.find(a => a.id === apId);
      const name = ap ? `${ap.vorname} ${ap.nachname}` : 'Ansprechpartner';
      let proceed = false;
      const msg = `Möchten Sie ${name} wirklich vom Unternehmen entfernen?`;
      if (window.confirmationModal) {
        const res = await window.confirmationModal.open({ title: 'Entfernen bestätigen', message: msg, confirmText: 'Entfernen', cancelText: 'Abbrechen', danger: true });
        proceed = !!res?.confirmed;
      } else {
        proceed = confirm(msg);
      }
      if (!proceed) return;
      await removeAnsprechpartnerFromUnternehmen(apId, unternehmenId);
      e.target.closest('tr').remove();
      updateSelection();
      if (modal.querySelectorAll('tbody tr').length === 0) close();
    });
  });

  removeSelectedBtn.addEventListener('click', async () => {
    const selectedIds = Array.from(modal.querySelectorAll('.ansprechpartner-remove-check:checked')).map(cb => cb.dataset.id);
    if (selectedIds.length === 0) return;

    let proceed = false;
    const msg = `Möchten Sie wirklich ${selectedIds.length} Ansprechpartner vom Unternehmen entfernen?`;
    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({ title: 'Entfernen bestätigen', message: msg, confirmText: 'Entfernen', cancelText: 'Abbrechen', danger: true });
      proceed = !!res?.confirmed;
    } else {
      proceed = confirm(msg);
    }
    if (!proceed) return;

    let successCount = 0;
    let errorCount = 0;
    for (const apId of selectedIds) {
      try {
        await removeAnsprechpartnerFromUnternehmen(apId, unternehmenId);
        successCount++;
        const checkbox = modal.querySelector(`.ansprechpartner-remove-check[data-id="${apId}"]`);
        if (checkbox) checkbox.closest('tr').remove();
      } catch {
        errorCount++;
      }
    }

    let message = '';
    if (successCount > 0) message += `${successCount} Ansprechpartner erfolgreich entfernt.`;
    if (errorCount > 0) message += `\n${errorCount} Ansprechpartner konnten nicht entfernt werden.`;
    alert(message);
    updateSelection();
    if (modal.querySelectorAll('tbody tr').length === 0) close();
  });

  const handleEsc = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', handleEsc); document.body.removeChild(modal); };
  document.addEventListener('keydown', handleEsc);
  modal.querySelector('#remove-ansprechpartner-unternehmen-close').onclick = close;
  modal.querySelector('#remove-ansprechpartner-unternehmen-cancel').onclick = close;
  updateSelection();
}

export async function removeAnsprechpartnerFromUnternehmen(ansprechpartnerId, unternehmenId) {
  const { error } = await window.supabase
    .from('ansprechpartner_unternehmen')
    .delete()
    .eq('ansprechpartner_id', ansprechpartnerId)
    .eq('unternehmen_id', unternehmenId);

  if (error) throw error;

  window.dispatchEvent(new CustomEvent('entityUpdated', {
    detail: { entity: 'ansprechpartner', action: 'removed', unternehmenId }
  }));
  return true;
}
