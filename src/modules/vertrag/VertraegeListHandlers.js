import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { syncVertragCheckbox } from '../../core/VertragSyncHelper.js';

export function bindTableDelegation(list) {
  const tbody = document.getElementById('vertraege-table-body');
  if (!tbody) return;

  const handler = async (e) => {
    const target = e.target;

    // Upload-Button in "Unterschrieben"-Spalte
    const uploadBtn = target.closest('.contract-signed-action--upload');
    if (uploadBtn) {
      e.preventDefault();
      e.stopPropagation();
      list.openVertragUploadDrawer(uploadBtn.dataset.id);
      return;
    }

    // Action-Items aus dem Dropdown
    const actionItem = target.closest('.action-item[data-action]');
    if (actionItem) {
      e.preventDefault();
      const action = actionItem.dataset.action;
      const id = actionItem.dataset.id;
      await handleAction(list, action, id);
      return;
    }

    // Row-Click → Detail
    if (target.closest('.actions-dropdown-container')) return;
    if (target.closest('input[type="checkbox"]')) return;
    if (target.closest('a')) return;

    const row = target.closest('tr[data-vertrag-id]');
    if (row) {
      const vertragId = row.dataset.vertragId;
      const isDraft = row.dataset.vertragDraft === '1';
      window.navigateTo(isDraft ? `/vertraege/${vertragId}/edit` : `/vertraege/${vertragId}`);
    }
  };

  tbody.addEventListener('click', handler);
  list._boundEventListeners.add(() => tbody.removeEventListener('click', handler));
}

async function handleAction(list, action, id) {
  switch (action) {
    case 'view': {
      const tbody = document.getElementById('vertraege-table-body');
      const item = tbody?.querySelector(`[data-action="view"][data-id="${id}"]`);
      const row = item?.closest('tr[data-vertrag-draft]');
      const isDraft = row?.dataset?.vertragDraft === '1';
      window.navigateTo(isDraft ? `/vertraege/${id}/edit` : `/vertraege/${id}`);
      break;
    }
    case 'edit':
    case 'continue':
      if (!list.getVertragPermissions().canEdit) {
        window.toastSystem?.show('Sie haben keine Berechtigung, Vertragsentwürfe zu bearbeiten.', 'warning');
        break;
      }
      window.navigateTo(`/vertraege/${id}/edit`);
      break;
    case 'download':
      list.downloadVertrag(id);
      break;
    case 'delete':
      list.deleteVertrag(id);
      break;
    case 'add-signed':
    case 'replace-signed':
      list.openVertragUploadDrawer(id);
      break;
    case 'remove-signed':
      await removeSignedContract(list, id);
      break;
  }
}

export async function openVertragUploadDrawer(list, vertragId) {
  const vertrag = list.vertraege?.find(v => v.id === vertragId);
  if (!vertrag) return;

  const { VertragUploadDrawer } = await import('./VertragUploadDrawer.js');
  const drawer = new VertragUploadDrawer();
  drawer.open(vertragId, {
    kooperationId: vertrag.kooperation_id,
    unternehmen: vertrag.kunde?.firmenname || list.currentUnternehmenName || '',
    kampagne: KampagneUtils.getDisplayName(vertrag.kampagne) || '',
    creator: vertrag.creator ? `${vertrag.creator.vorname || ''} ${vertrag.creator.nachname || ''}`.trim() : '',
    vertragstyp: vertrag.typ || ''
  }, () => {
    window.toastSystem?.show('Vertrag erfolgreich hochgeladen', 'success');
    list.reloadData();
  });
}

export async function removeSignedContract(list, vertragId) {
  const result = await window.confirmationModal?.open({
    title: 'Vertrag entfernen?',
    message: 'Möchten Sie den hochgeladenen unterschriebenen Vertrag wirklich entfernen? Die Datei wird unwiderruflich gelöscht.',
    confirmText: 'Entfernen',
    cancelText: 'Abbrechen',
    danger: true
  });

  if (!result?.confirmed) return;

  try {
    if (!window.supabase) throw new Error('Supabase nicht verfügbar');

    const { data } = await window.supabase
      .from('vertraege')
      .select('unterschriebener_vertrag_path, dropbox_file_path')
      .eq('id', vertragId)
      .single();

    if (data?.unterschriebener_vertrag_path) {
      const { error: storageError } = await window.supabase.storage
        .from('unterschriebene-vertraege')
        .remove([data.unterschriebener_vertrag_path]);
      if (storageError) console.warn('⚠️ Storage-Löschfehler (nicht kritisch):', storageError);
    }

    if (data?.dropbox_file_path) {
      try {
        await fetch('/.netlify/functions/dropbox-delete-vertrag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: data.dropbox_file_path })
        });
      } catch (dbxErr) {
        console.warn('Dropbox-Löschung fehlgeschlagen (wird ignoriert):', dbxErr);
      }
    }

    const { error } = await window.supabase
      .from('vertraege')
      .update({
        unterschriebener_vertrag_url: null,
        unterschriebener_vertrag_path: null,
        dropbox_file_url: null,
        dropbox_file_path: null
      })
      .eq('id', vertragId);

    if (error) throw error;

    const vertrag = list.vertraege.find(v => v.id === vertragId);
    if (vertrag?.kooperation_id) {
      await syncVertragCheckbox(vertrag.kooperation_id, false);
    }

    window.toastSystem?.show('Vertrag entfernt', 'success');
    await list.reloadData();

  } catch (error) {
    console.error('❌ Fehler beim Entfernen:', error);
    window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
  }
}

export function bindSelectionEvents(list) {
  const canBulkDelete = window.canBulkDelete();
  if (!canBulkDelete) return;

  const selectAllBtn = document.getElementById('btn-select-all');
  if (selectAllBtn) {
    const handler = (e) => {
      e.preventDefault();
      document.querySelectorAll('.vertraege-check').forEach(cb => {
        cb.checked = true;
        if (cb.dataset.id) list.selectedVertraege.add(cb.dataset.id);
      });
      const selectAllHeader = document.getElementById('select-all-vertraege');
      if (selectAllHeader) { selectAllHeader.indeterminate = false; selectAllHeader.checked = true; }
      list.updateSelection();
    };
    selectAllBtn.addEventListener('click', handler);
    list._boundEventListeners.add(() => selectAllBtn.removeEventListener('click', handler));
  }

  const deselectBtn = document.getElementById('btn-deselect-all');
  if (deselectBtn) {
    const handler = (e) => { e.preventDefault(); list.deselectAll(); };
    deselectBtn.addEventListener('click', handler);
    list._boundEventListeners.add(() => deselectBtn.removeEventListener('click', handler));
  }

  const deleteSelectedBtn = document.getElementById('btn-delete-selected');
  if (deleteSelectedBtn) {
    const handler = (e) => { e.preventDefault(); list.showDeleteSelectedConfirmation(); };
    deleteSelectedBtn.addEventListener('click', handler);
    list._boundEventListeners.add(() => deleteSelectedBtn.removeEventListener('click', handler));
  }

  const selectAllCheckbox = document.getElementById('select-all-vertraege');
  if (selectAllCheckbox) {
    const handler = (e) => {
      document.querySelectorAll('.vertraege-check').forEach(cb => {
        cb.checked = e.target.checked;
        if (e.target.checked) list.selectedVertraege.add(cb.dataset.id);
        else list.selectedVertraege.delete(cb.dataset.id);
      });
      list.updateSelection();
    };
    selectAllCheckbox.addEventListener('change', handler);
    list._boundEventListeners.add(() => selectAllCheckbox.removeEventListener('change', handler));
  }

  document.querySelectorAll('.vertraege-check').forEach(cb => {
    const handler = () => {
      if (cb.checked) list.selectedVertraege.add(cb.dataset.id);
      else list.selectedVertraege.delete(cb.dataset.id);
      list.updateSelection();
      list.updateSelectAllCheckbox();
    };
    cb.addEventListener('change', handler);
    list._boundEventListeners.add(() => cb.removeEventListener('change', handler));
  });
}
