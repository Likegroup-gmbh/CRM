// KampagneDetailEvents.js
// Event-Binding und -Teardown für die Kampagnen-Detailseite

import { KampagneUtils } from './KampagneUtils.js';
import { VideoTableColumnVisibilityDrawer } from './VideoTableColumnVisibilityDrawer.js';
import { CustomColumnsDrawer } from './columns/CustomColumnsDrawer.js';
import { deleteDropboxCascade } from '../../core/VideoDeleteHelper.js';
import { sortDropdown } from '../../core/components/SortDropdown.js';

const KOOPERATION_SORT_ENTITY = 'kampagne-kooperationen';

const KAMPAGNE_KOOPERATION_SORT_OPTIONS = [
  { value: 'name_asc', label: 'A-Z' },
  { value: 'name_desc', label: 'Z-A' },
  { value: 'created_desc', label: 'Neueste zuerst' },
  { value: 'created_asc', label: 'Älteste zuerst' },
  { value: 'posting_asc', label: 'GoLive früheste zuerst' },
  { value: 'posting_desc', label: 'GoLive späteste zuerst' }
];

function initKooperationSortDropdown(detail) {
  const container = document.getElementById('kampagne-kooperation-sort-container');
  if (!container) return;

  sortDropdown.init(KOOPERATION_SORT_ENTITY, container, {
    nameField: 'name',
    defaultSort: 'created_desc',
    sortOptions: KAMPAGNE_KOOPERATION_SORT_OPTIONS,
    onSortChange: () => {
      const currentSort = sortDropdown.getCurrentSort(KOOPERATION_SORT_ENTITY);
      detail.store?.setKooperationSort(currentSort);
      if (detail.currentView === 'table') {
        detail.kooperationenVideoTable?.refilter();
      } else if (detail.currentView === 'kanban') {
        detail.kanbanBoard?.render();
      }
    }
  });

  // Store mit (ggf. bereits persistierter) Auswahl synchronisieren
  const persisted = sortDropdown.getCurrentSort(KOOPERATION_SORT_ENTITY);
  detail.store?.setKooperationSort(persisted);
}

let _abortController = null;

export function setupEvents(detail) {
  teardownEvents();
  _abortController = new AbortController();
  const signal = _abortController.signal;

  initKooperationSortDropdown(detail);

  // Tab Navigation (Offen / Abgeschlossen / Alle)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-button');
    if (btn) {
      e.preventDefault();
      detail.switchTab(btn.dataset.tab);
    }
  }, { signal });

  // Kooperation anlegen
  const btnNewKooperation = document.getElementById('btn-new-kooperation');
  if (btnNewKooperation) {
    btnNewKooperation.addEventListener('click', (e) => {
      e.preventDefault();
      if (detail.kampagneData) {
        window.kooperationPrefillCache = {
          kampagne_id: detail.kampagneId,
          kampagnenname: KampagneUtils.getDisplayName(detail.kampagneData),
          unternehmen_id: detail.kampagneData.unternehmen_id,
          marke_id: detail.kampagneData.marke_id || null,
          unternehmen: detail.kampagneData.unternehmen,
          marke: detail.kampagneData.marke,
          timestamp: Date.now()
        };
      }
      window.navigateTo(`/kooperation/new?kampagne_id=${detail.kampagneId}`);
    }, { signal });
  }

  // Bearbeiten Button → Wizard mit auftrag_id
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#btn-edit-kampagne') || e.target.closest('#btn-edit-kampagne-bottom')) {
      e.preventDefault();
      const auftragId = detail.kampagneData?.auftrag_id;
      if (auftragId) {
        window.navigateTo(`/projekt-erstellen/edit/${auftragId}?step=kampagnen&kampagneId=${detail.kampagneId}`);
      } else {
        console.warn('⚠️ Keine auftrag_id auf Kampagne – Fallback auf Wizard-Neuanlage');
        window.navigateTo('/projekt-erstellen');
      }
    }
  }, { signal });

  // Spalten-Sichtbarkeit
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-column-visibility')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showColumnVisibilityDrawer(detail);
    }
  }, { signal });

  // Custom Columns verwalten
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-custom-columns')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showCustomColumnsDrawer(detail);
    }
  }, { signal });

  // View-Switch (Tabelle / Kanban)
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-view-table')) {
      e.preventDefault();
      detail.switchView('table');
    } else if (e.target.closest('#btn-view-kanban')) {
      e.preventDefault();
      detail.switchView('kanban');
    }
  }, { signal });

  // Löschen
  document.addEventListener('click', (e) => {
    if (e.target.id === 'btn-delete-kampagne') {
      e.preventDefault();
      const confirmed = confirm('Sind Sie sicher, dass Sie diese Kampagne löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.');
      if (confirmed) deleteKampagne(detail);
    }
  }, { signal });

  // Soft-Refresh
  window.addEventListener('softRefresh', async () => {
    const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
    if (hasActiveForm) return;
    if (!detail.kampagneId || !location.pathname.includes('/kampagne/')) return;

    console.log('🔄 KAMPAGNEDETAIL: Soft-Refresh - lade Daten neu');
    await detail.loadCriticalData();
    detail.render();
    teardownEvents();
    setupEvents(detail);
  }, { signal });

  // Ansprechpartner entityUpdated
  window.addEventListener('entityUpdated', (e) => {
    if (e.detail.entity === 'ansprechpartner' && e.detail.action === 'added' && e.detail.kampagneId === detail.kampagneId) {
      detail.loadCriticalData().then(() => detail.render());
    }
  }, { signal });
}

export function teardownEvents() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
}

function showColumnVisibilityDrawer(detail) {
  if (!detail.videoColumnVisibilityDrawer) {
    detail.videoColumnVisibilityDrawer = new VideoTableColumnVisibilityDrawer(detail.kampagneId, detail.store);
  }
  detail.videoColumnVisibilityDrawer.open();
}

function showCustomColumnsDrawer(detail) {
  if (window.isKunde()) return;
  if (!detail._customColumnsDrawer) {
    detail._customColumnsDrawer = new CustomColumnsDrawer(
      detail.kampagneId,
      detail.store,
      () => detail.kooperationenVideoTable?.refilter()
    );
  }
  detail._customColumnsDrawer.open();
}

async function deleteKampagne(detail) {
  try {
    const cascade = await deleteDropboxCascade('kampagne', detail.kampagneId);
    if (cascade.failed > 0) {
      console.warn('Dropbox-Cascade: Einige Dateien konnten nicht gelöscht werden:', cascade.failures);
    }
    const { error } = await window.supabase.from('kampagne').delete().eq('id', detail.kampagneId);
    if (error) throw error;
    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'kampagne', action: 'deleted', id: detail.kampagneId }
    }));
    window.navigateTo('/kampagne');
  } catch (error) {
    console.error('❌ Fehler beim Löschen der Kampagne:', error);
    alert('Ein unerwarteter Fehler ist aufgetreten.');
  }
}
