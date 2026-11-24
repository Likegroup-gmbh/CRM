// KampagneDetailEvents.js
// Event-Binding und -Teardown für die Kampagnen-Detailseite

import {
  getWorkflowTableRoute,
  handleWorkflowTableSelect,
  reloadWorkflowPane
} from './KampagneDetailWorkflow.js';
import { handleVertragListAction } from '../vertrag/VertraegeListHandlers.js';
import { syncSkriptGeloeschtLocal } from './skriptFreigabeSync.js';
import { KampagneUtils } from './KampagneUtils.js';
import { closeLinienMenu, koopLinie, toggleLinienMenu } from './linienScope.js';
import { navigateToNewKooperationFromKampagne } from '../kooperation/kooperationFromKampagne.js';
import { bindPlatzhalterButton } from '../kooperation/platzhalterAnlegen.js';
import { handleWorkflowCreate } from './KampagneWorkflowCreate.js';
import { setBudgetTags } from '../produktion/budgetTabFilter.js';
import { openProduktionBriefingDrawer } from '../produktion/ProduktionBriefingDrawer.js';
import { VideoTableColumnVisibilityDrawer } from './VideoTableColumnVisibilityDrawer.js';
import { CustomColumnsDrawer } from './columns/CustomColumnsDrawer.js';
import { deleteDropboxCascade } from '../../core/VideoDeleteHelper.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { bindToolbarMenu } from '../../core/components/ToolbarMenu.js';
import { bindKampagnenAuswertung } from '../auswertung/auswertungKampagne.js';
import { resetKooperationFilter } from './kooperationFilterSpalte.js';
import { skriptGeloescht } from './KampagneDetailSkripte.js';
import { detailOffen } from './produktionTabDetail.js';

function initToolbarMenu(signal) {
  document.querySelectorAll('.page-header-right .toolbar-menu').forEach(menu => {
    const cleanup = bindToolbarMenu(menu);
    signal.addEventListener('abort', cleanup, { once: true });
  });
}

function refreshKooperationenView(detail) {
  if (detail.currentView === 'table') {
    detail.kooperationenVideoTable?.refilter();
  } else if (detail.currentView === 'kanban') {
    detail.kanbanBoard?.render();
  }
}

function initKooperationenSearch(detail, signal) {
  SearchInput.bind('kampagne-koop', (value) => {
    const newQuery = value || '';
    if (newQuery === (detail.store?.searchQuery || '')) return;
    detail.store?.setSearchQuery(newQuery);
    refreshKooperationenView(detail);
  }, signal);
}

function clearKooperationenSearch(detail) {
  if (!(detail.store?.searchQuery || '')) return;
  detail.store?.setSearchQuery('');
  const input = document.getElementById('kampagne-koop-search-input');
  if (input) input.value = '';
  const clearBtn = document.getElementById('kampagne-koop-search-clear');
  if (clearBtn) clearBtn.style.display = 'none';
  refreshKooperationenView(detail);
}

let _abortController = null;

async function aktualisiereProduktionen(detail) {
  await detail.loadCriticalData();
  if (!detail._isMounted) return;
  await detail.render();
}

export function setupEvents(detail) {
  teardownEvents();
  _abortController = new AbortController();
  const signal = _abortController.signal;

  initToolbarMenu(signal);
  initKooperationenSearch(detail, signal);
  bindKampagnenAuswertung(detail, signal);

  document.getElementById('btn-new-produktion')?.addEventListener('click', async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    try {
      const { createProduktion } = await import('../produktion/ProduktionService.js');
      const created = await createProduktion({ kampagneId: detail.kampagneId });
      window.toastSystem?.show('Produktion angelegt', 'success');
      if (created?.id) window.navigateTo(`/produktion/${created.id}`);
    } catch (error) {
      console.error('Produktion konnte nicht angelegt werden:', error);
      window.toastSystem?.show(error.message || 'Produktion konnte nicht angelegt werden', 'error');
      button.disabled = false;
    }
  }, { signal });

  // Linien-Dropdown in der Tab-Zeile: Eintrag wechselt die Linie, "+ Briefing" legt eine weitere an.
  document.addEventListener('click', async (e) => {
    const nameAction = e.target.closest('[data-action="produktion-name"]');
    if (nameAction) {
      e.preventDefault();
      const produktion = (detail.produktionen || []).find(row => row.id === nameAction.dataset.id);
      if (!produktion) return;
      const { openProduktionName } = await import('../produktion/produktionBearbeitenDrawer.js');
      openProduktionName(produktion, () => aktualisiereProduktionen(detail));
      return;
    }

    const budgetAction = e.target.closest('[data-action="produktion-budget"]');
    if (budgetAction) {
      e.preventDefault();
      const produktion = (detail.produktionen || []).find(row => row.id === budgetAction.dataset.id);
      if (!produktion) return;
      const { openProduktionBudget } = await import('../produktion/produktionBearbeitenDrawer.js');
      openProduktionBudget({
        produktion,
        produktionen: detail.produktionen || [],
        kampagne: detail.kampagneData,
        onSaved: () => aktualisiereProduktionen(detail)
      });
      return;
    }

    const loeschen = e.target.closest('[data-produktion-loeschen]');
    if (loeschen) {
      e.preventDefault();
      const produktionId = loeschen.dataset.produktionLoeschen;
      const produktion = (detail.produktionen || []).find(row => row.id === produktionId)
        || (detail.produktion?.id === produktionId ? detail.produktion : null);
      const hatLinien = (produktion?.linien || []).length > 0;
      const { deleteProduktion } = await import('../produktion/ProduktionService.js');
      const { confirmDanger } = await import('../../core/actions/actionDelete.js');
      if (!await confirmDanger({
        title: 'Produktion löschen',
        message: hatLinien
          ? 'Möchten Sie diese Produktion wirklich löschen? Briefing, Casting, Konzept und Skripte werden mit gelöscht.'
          : 'Möchten Sie diese leere Produktion wirklich löschen?'
      })) return;
      try {
        await deleteProduktion(produktionId);
        window.toastSystem?.show('Produktion gelöscht', 'success');
        if (detail.mode === 'workflow') {
          window.navigateTo(`/kampagne/${detail.kampagneId}`);
          return;
        }
        await detail.loadCriticalData();
        detail.render();
      } catch (error) {
        window.toastSystem?.show(error.message || 'Produktion konnte nicht gelöscht werden', 'warning');
      }
      return;
    }
    const toggle = e.target.closest('[data-linien-toggle]');
    if (toggle) {
      e.preventDefault();
      toggleLinienMenu(toggle.closest('[data-linien-switch]'));
      return;
    }
    const chip = e.target.closest('[data-linie]');
    if (chip) {
      e.preventDefault();
      closeLinienMenu();
      void detail.switchLinie(chip.dataset.linie);
      return;
    }
    if (e.target.closest('[data-linie-neu]')) {
      e.preventDefault();
      closeLinienMenu();
      openProduktionBriefingDrawer(detail, { produktionId: detail.produktionId || null });
      return;
    }
    if (!e.target.closest('[data-linien-switch]')) closeLinienMenu();
  }, { signal });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLinienMenu();
  }, { signal });
  window.addEventListener('resize', closeLinienMenu, { signal });

  document.querySelectorAll('a[data-table="produktion"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (link.dataset.id) window.navigateTo(`/produktion/${link.dataset.id}`);
    }, { signal });
  });

  // Ein document-Click statt einem Listener pro Aktion. Reihenfolge wie vorher,
  // erster Treffer gewinnt. Selektoren überlappen sich nicht.
  document.addEventListener('click', (e) => {
    const filterTab = e.target.closest('.kampagne-filter-tabs .tab-button');
    if (filterTab) {
      e.preventDefault();
      detail.switchTab(filterTab.dataset.tab);
      return;
    }

    const workflowTab = e.target.closest('[data-workflow-tab]');
    if (workflowTab) {
      e.preventDefault();
      detail.switchWorkflowTab(workflowTab.dataset.workflowTab);
      return;
    }

    const teilenBtn = e.target.closest('.kampagne-tab-chrome [data-skripte-teilen]');
    if (teilenBtn) {
      e.preventDefault();
      const k = detail.kampagneData || {};
      window.skriptPaketDrawer?.open({
        kampagneId: detail.kampagneId,
        kampagneName: k.kampagnenname || k.eigener_name || ''
      });
      return;
    }

    const createBtn = e.target.closest('.kampagne-tab-chrome [data-create-action]');
    if (createBtn) {
      e.preventDefault();
      if (createBtn.disabled || createBtn.getAttribute('aria-disabled') === 'true') return;
      handleWorkflowCreate(detail, createBtn.dataset.createAction);
      return;
    }

    if (e.target.closest('.workflow-pane:not([data-pane="kooperationen"])')) {
      const tagRemove = e.target.closest('[data-budget-tag-remove]');
      if (tagRemove) {
        e.preventDefault();
        const id = tagRemove.dataset.budgetTagRemove;
        setBudgetTags(detail, (detail.budgetTagIds || []).filter(t => t !== id));
        return;
      }
      const vertragEdit = e.target.closest('[data-vertrag-open="edit"]');
      if (vertragEdit?.dataset.id) {
        e.preventDefault();
        window.navigateTo(`/vertraege/${vertragEdit.dataset.id}/edit`);
        return;
      }
      const link = e.target.closest('.table-link[data-table][data-id]');
      const href = link?.getAttribute('href') || '';
      // Ziele im Flow tragen ihre Adresse im href, die Produktion zeigt sie ohne Neuaufbau
      const route = link && (href.startsWith('/produktion/')
        ? href
        : getWorkflowTableRoute(link.dataset.table, link.dataset.id));
      if (route) {
        e.preventDefault();
        window.navigateTo(route);
        return;
      }
    }

    const emptyReset = e.target.closest('[data-empty-action="reset-filters"]');
    if (emptyReset) {
      e.preventDefault();
      resetKooperationFilter(detail);
      clearKooperationenSearch(detail);
      refreshKooperationenView(detail);
      return;
    }

    if (e.target.closest('#btn-download-finale')) {
      e.preventDefault();
      detail.kooperationenVideoTable?._finalBulkDownload?.downloadSelected();
      return;
    }

    if (e.target.closest('#btn-edit-kampagne') || e.target.closest('#btn-edit-kampagne-bottom')) {
      e.preventDefault();
      const auftragId = detail.kampagneData?.auftrag_id;
      if (auftragId) {
        window.navigateTo(`/projekt-erstellen/edit/${auftragId}?step=kampagnen&kampagneId=${detail.kampagneId}`);
      } else {
        console.warn('⚠️ Keine auftrag_id auf Kampagne – Fallback auf Wizard-Neuanlage');
        window.navigateTo('/projekt-erstellen');
      }
      return;
    }

    if (e.target.closest('#btn-column-visibility')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showColumnVisibilityDrawer(detail);
      return;
    }

    if (e.target.closest('#btn-view-table')) {
      e.preventDefault();
      detail.switchView('table');
      return;
    }
    if (e.target.closest('#btn-view-kanban')) {
      e.preventDefault();
      detail.switchView('kanban');
      return;
    }

    if (e.target.id === 'btn-delete-kampagne') {
      e.preventDefault();
      const confirmed = confirm('Sind Sie sicher, dass Sie diese Kampagne löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.');
      if (confirmed) deleteKampagne(detail);
    }
  }, { signal });

  // Workflow-Panes: Inline-Selects (Skript-Status). Casting/Konzepte laufen über das Worksheet.
  // tableSelect feuert das Event auf document; hier nur die aus unseren Panes.
  document.addEventListener('table-select-change', (e) => {
    const pane = e.detail?.element?.closest('.workflow-pane');
    if (!pane) return;
    if (pane.dataset.pane === 'casting' || pane.dataset.pane === 'konzepte') return;
    handleWorkflowTableSelect(detail, e.detail);
  }, { signal });

  // Kooperation anlegen
  const btnNewKooperation = document.getElementById('btn-new-kooperation');
  if (btnNewKooperation) {
    btnNewKooperation.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToNewKooperationFromKampagne(detail.kampagneId, detail.kampagneData, detail.produktionId, koopLinie(detail));
    }, { signal });
  }
  bindPlatzhalterButton(detail, signal, koopLinie);

  // Kampagne teilen (Gast-Zugang per E-Mail)
  const btnShareKampagne = document.getElementById('btn-share-kampagne');
  if (btnShareKampagne) {
    btnShareKampagne.addEventListener('click', (e) => {
      e.preventDefault();
      window.shareListDrawer?.open({
        entityType: 'kampagne',
        entityId: detail.kampagneId,
        entityName: KampagneUtils.getDisplayName(detail.kampagneData) || detail.kampagneData?.kampagnenname || ''
      });
    }, { signal });
  }

  // Soft-Refresh
  window.addEventListener('softRefresh', async () => {
    const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
    // Offene Ansichten (Skript-Editor, Formulare) halten eigene Daten und ungespeicherte Eingaben
    if (hasActiveForm || detailOffen(detail)) return;
    const path = location.pathname;
    if (!detail.kampagneId || (!path.includes('/kampagne/') && !path.includes('/produktion/'))) return;

    console.log('🔄 KAMPAGNEDETAIL: Soft-Refresh - lade Daten neu');
    await detail.loadCriticalData();
    detail.render();
    teardownEvents();
    setupEvents(detail);
    if (detail.mode !== 'overview') {
      if (detail.currentView === 'kanban') {
        detail.kanbanBoard?.destroy();
        detail.kanbanBoard = null;
        detail._mountKanban();
      } else {
        await detail._mountVideoTable();
      }
    }
  }, { signal });

  // Ansprechpartner entityUpdated
  window.addEventListener('entityUpdated', (e) => {
    if (e.detail.entity === 'ansprechpartner' && e.detail.action === 'added' && e.detail.kampagneId === detail.kampagneId) {
      detail.loadCriticalData().then(() => detail.render());
    }
  }, { signal });

  // Skript gelöscht: Skripte-Pane (Cache) und Skript-Spalte der Videotabelle
  window.addEventListener('entityUpdated', (e) => {
    if (e.detail?.entity !== 'skripte' || e.detail.action !== 'deleted' || !e.detail.id) return;
    syncSkriptGeloeschtLocal(detail, e.detail.id);
    skriptGeloescht(detail, e.detail.id);
  }, { signal });

  window.addEventListener('vertrag-signed-action', (e) => {
    if (detail.activeWorkflowTab !== 'vertraege') return;
    void handleKampagneVertragListAction(detail, e.detail?.action, e.detail?.vertragId);
  }, { signal });

  window.addEventListener('vertrag-anschreiben-action', (e) => {
    if (detail.activeWorkflowTab !== 'vertraege') return;
    void handleKampagneVertragListAction(detail, 'anschreiben', e.detail?.vertragId);
  }, { signal });

  window.addEventListener('vertrag-list-action', (e) => {
    if (detail.activeWorkflowTab !== 'vertraege') return;
    void handleKampagneVertragListAction(detail, e.detail?.action, e.detail?.vertragId);
  }, { signal });

  window.addEventListener('anschreibenSent', (e) => {
    if (e.detail?.dokumentTyp !== 'vertrag') return;
    if (detail.activeWorkflowTab !== 'vertraege') return;
    void reloadWorkflowPane(detail, 'vertraege');
  }, { signal });
}

export function teardownEvents() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
}

function showColumnVisibilityDrawer(detail) {
  if (!(window.canFeature?.('kampagneTableLayout') ?? false)) return;
  const drawer = detail.videoColumnVisibilityDrawer;
  if (drawer && (drawer.kampagneId !== detail.kampagneId || drawer.store !== detail.store)) {
    drawer.destroy();
    detail.videoColumnVisibilityDrawer = null;
  }
  if (!detail.videoColumnVisibilityDrawer) {
    detail.videoColumnVisibilityDrawer = new VideoTableColumnVisibilityDrawer(detail.kampagneId, detail.store, {
      onTableRefresh: () => detail.kooperationenVideoTable?.refilter(),
      onPflege: (host, ctx) => {
        const editor = ensureCustomColumnsDrawer(detail);
        editor.mountIn(host, ctx);
      }
    });
  }
  detail.videoColumnVisibilityDrawer.open();
}

function ensureCustomColumnsDrawer(detail) {
  const drawer = detail._customColumnsDrawer;
  if (drawer && (drawer.kampagneId !== detail.kampagneId || drawer.store !== detail.store)) {
    drawer.destroy();
    detail._customColumnsDrawer = null;
  }
  if (!detail._customColumnsDrawer) {
    detail._customColumnsDrawer = new CustomColumnsDrawer(
      detail.kampagneId,
      detail.store,
      () => detail.kooperationenVideoTable?.refilter()
    );
  }
  return detail._customColumnsDrawer;
}

function handleKampagneVertragListAction(detail, action, vertragId) {
  const adapter = detail._vertragListAdapter;
  if (!adapter || !action || !vertragId) return;
  return handleVertragListAction(adapter, action, vertragId);
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
