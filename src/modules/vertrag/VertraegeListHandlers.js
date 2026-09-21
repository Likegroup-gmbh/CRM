import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { syncVertragCheckbox } from '../../core/VertragSyncHelper.js';
import { openDocumentUrl } from '../../core/DocumentUrlHelper.js';
import { VertragUtils } from './VertragUtils.js';
import {
  canEditVertragStatusManually,
  fallbackStatusAfterUnsigned,
  getVertragStatus,
  VERTRAG_STATUS,
} from './vertragStatus.js';

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

    // Draft-Name → Edit-Wizard
    const editLink = target.closest('[data-vertrag-open="edit"]');
    if (editLink) {
      e.preventDefault();
      e.stopPropagation();
      window.navigateTo(`/vertraege/${editLink.dataset.id}/edit`);
      return;
    }

    const statusItem = target.closest('.status-dropdown-item[data-status-value]');
    if (statusItem) {
      e.preventDefault();
      e.stopPropagation();
      await handleStatusChange(list, statusItem.dataset.id, statusItem.dataset.statusValue);
      return;
    }

    const statusTrigger = target.closest('.status-select-trigger');
    if (statusTrigger) {
      e.preventDefault();
      e.stopPropagation();
      const wrapper = statusTrigger.closest('.status-select-wrapper');
      document.querySelectorAll('.status-select-wrapper.show').forEach((w) => {
        if (w !== wrapper) w.classList.remove('show');
      });
      wrapper?.classList.toggle('show');
      return;
    }

    // Action-Items aus dem Dropdown
    const actionItem = target.closest('.action-item[data-action]');
    if (actionItem) {
      e.preventDefault();
      const action = actionItem.dataset.action;
      const id = actionItem.dataset.id;
      await handleVertragListAction(list, action, id);
      return;
    }

    // Row-Click → Detail
    if (target.closest('.actions-dropdown-container')) return;
    if (target.closest('.status-select-wrapper')) return;
    if (target.closest('input[type="checkbox"]')) return;
    if (target.closest('a')) return;

    const row = target.closest('tr[data-vertrag-id]');
    if (row) {
      openVertragRecord(list, row.dataset.vertragId);
    }
  };

  tbody.addEventListener('click', handler);
  list._boundEventListeners.add(() => tbody.removeEventListener('click', handler));
}

export function bindStatusDropdownDismiss(list) {
  const closeStatus = (e) => {
    if (e.target.closest?.('.status-select-wrapper')) return;
    document.querySelectorAll('.status-select-wrapper.show').forEach((w) => w.classList.remove('show'));
  };
  document.addEventListener('click', closeStatus);
  list._boundEventListeners.add(() => document.removeEventListener('click', closeStatus));
}

function openVertragRecord(list, id) {
  const vertrag = list.vertraege?.find(v => v.id === id);
  const action = VertragUtils.getVertragOpenAction(vertrag);
  if (action.kind === 'edit') {
    window.navigateTo(action.href);
    return;
  }
  if (action.kind === 'pdf') {
    openDocumentUrl(action.url);
    return;
  }
  window.toastSystem?.show('Keine PDF-Datei vorhanden', 'warning');
}

async function handleStatusChange(list, id, value) {
  if (!list.getVertragPermissions().canEdit) {
    window.toastSystem?.show('Keine Berechtigung, den Status zu ändern.', 'warning');
    return;
  }
  const vertrag = list.vertraege?.find(v => v.id === id);
  if (!vertrag) return;
  if (!canEditVertragStatusManually(getVertragStatus(vertrag))) return;

  let next = value;
  if (value === '__zurueck') {
    next = await fallbackStatusAfterUnsigned(window.supabase, id);
  }
  if (next === getVertragStatus(vertrag)) {
    document.querySelectorAll('.status-select-wrapper.show').forEach((w) => w.classList.remove('show'));
    return;
  }
  if (next !== VERTRAG_STATUS.VERZOEGERT && next !== VERTRAG_STATUS.ABGELEHNT
    && next !== VERTRAG_STATUS.ERSTELLT && next !== VERTRAG_STATUS.GESENDET) {
    return;
  }

  const { error } = await window.supabase
    .from('vertraege')
    .update({ status: next })
    .eq('id', id);
  if (error) {
    window.toastSystem?.show(`Status konnte nicht gesetzt werden: ${error.message}`, 'error');
    return;
  }
  window.toastSystem?.show('Status aktualisiert', 'success');
  await list.reloadData();
}

export async function openVertragAnschreiben(list, id) {
  if (!window.isInternal?.()) return;
  const vertrag = list.vertraege?.find(v => v.id === id);
  if (!vertrag) return;
  const { openAnschreiben } = await import('../../core/anschreiben/openAnschreiben.js');
  await openAnschreiben({
    dokumentTyp: 'vertrag',
    dokumentId: id,
    vertrag,
  });
}

export function downloadVertrag(list, id) {
  const vertrag = list.vertraege?.find(v => v.id === id);
  if (!vertrag?.datei_url) {
    window.toastSystem?.show('Keine PDF-Datei vorhanden', 'warning');
    return;
  }
  openDocumentUrl(vertrag.datei_url);
}

export async function deleteVertrag(list, id) {
  const result = await window.confirmationModal?.open({
    title: 'Vertrag löschen?',
    message: 'Möchten Sie diesen Vertrag wirklich löschen?',
    confirmText: 'Löschen',
    cancelText: 'Abbrechen',
    danger: true
  });
  if (!result?.confirmed) return;

  try {
    const vertrag = list.vertraege?.find(v => v.id === id);

    if (vertrag?.datei_path) {
      if (vertrag.datei_path.startsWith('/')) {
        try {
          await fetch('/.netlify/functions/dropbox-delete-vertrag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: vertrag.datei_path })
          });
        } catch (dbxErr) {
          console.warn('Dropbox-Löschung (datei_path) fehlgeschlagen:', dbxErr);
        }
      } else {
        await window.supabase.storage.from('vertraege').remove([vertrag.datei_path]);
      }
    }
    if (vertrag?.unterschriebener_vertrag_path) {
      await window.supabase.storage.from('unterschriebene-vertraege').remove([vertrag.unterschriebener_vertrag_path]);
    }
    if (vertrag?.dropbox_file_path) {
      try {
        await fetch('/.netlify/functions/dropbox-delete-vertrag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: vertrag.dropbox_file_path })
        });
      } catch (dbxErr) {
        console.warn('Dropbox-Löschung fehlgeschlagen (wird ignoriert):', dbxErr);
      }
    }

    const { error } = await window.supabase.from('vertraege').delete().eq('id', id);
    if (error) throw error;

    const hadSigned = vertrag?.unterschriebener_vertrag_url || vertrag?.dropbox_file_url;
    if (hadSigned && vertrag?.kooperation_id) {
      await syncVertragCheckbox(vertrag.kooperation_id, false);
    }

    window.toastSystem?.show('Vertrag gelöscht', 'success');
    await list.reloadData();
  } catch (error) {
    console.error('❌ Fehler beim Löschen:', error);
    window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
  }
}

export async function handleVertragListAction(list, action, id) {
  if (!id) return;
  switch (action) {
    case 'view':
      openVertragRecord(list, id);
      break;
    case 'edit':
    case 'continue':
      if (!list.getVertragPermissions().canEdit) {
        window.toastSystem?.show('Sie haben keine Berechtigung, Vertragsentwürfe zu bearbeiten.', 'warning');
        break;
      }
      window.navigateTo(`/vertraege/${id}/edit`);
      break;
    case 'download':
      downloadVertrag(list, id);
      break;
    case 'generate-pdf':
      try {
        const { generateVertragPdf } = await import('./generateVertragPdf.js');
        await generateVertragPdf(list, id);
      } catch (error) {
        console.error('❌ PDF erzeugen fehlgeschlagen:', error);
        window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
      }
      break;
    case 'anschreiben':
      await openVertragAnschreiben(list, id);
      break;
    case 'delete':
      await deleteVertrag(list, id);
      break;
    case 'add-signed':
    case 'replace-signed':
      if (!list.getVertragPermissions().canEdit) {
        window.toastSystem?.show('Sie haben keine Berechtigung, Vertragsentwürfe zu bearbeiten.', 'warning');
        break;
      }
      list.openVertragUploadDrawer(id);
      break;
    case 'remove-signed':
      if (!list.getVertragPermissions().canEdit) {
        window.toastSystem?.show('Sie haben keine Berechtigung, Vertragsentwürfe zu bearbeiten.', 'warning');
        break;
      }
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
    marke: vertrag.kampagne?.marke?.markenname || '',
    kampagne: KampagneUtils.getDisplayName(vertrag.kampagne) || '',
    kooperation: vertrag.kooperation?.name || '',
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

    const fallbackStatus = await fallbackStatusAfterUnsigned(window.supabase, vertragId);
    const { error } = await window.supabase
      .from('vertraege')
      .update({
        unterschriebener_vertrag_url: null,
        unterschriebener_vertrag_path: null,
        dropbox_file_url: null,
        dropbox_file_path: null,
        status: fallbackStatus
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
