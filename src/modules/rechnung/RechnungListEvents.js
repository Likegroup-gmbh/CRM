// RechnungListEvents.js
// All DOM event listeners for the Rechnung list.

import { rechnungNotizModal } from './RechnungNotizModal.js';
import { bindEmptyStateActions } from '../../core/components/EmptyState.js';

/**
 * Bind all delegated events for RechnungList.
 * @param {import('./RechnungList.js').RechnungList} list – orchestrator instance
 * @param {AbortSignal} signal
 */
export function bindRechnungListEvents(list, signal) {
  // entityUpdated
  window.addEventListener('entityUpdated', (e) => {
    if (e?.detail?.entity !== 'rechnung') return;
    const { action, id, field, value } = e.detail;
    if (action === 'updated' && field === 'status' && id) {
      if (value === 'Rückfrage' || list.activeStatusTab === 'Rückfrage') {
        list.loadAndRender();
      } else {
        list.handleSingleRowUpdate(id, value);
      }
    } else {
      list.loadAndRender();
    }
  }, { signal });

  // "Neue Rechnung"
  document.addEventListener('click', (e) => {
    if (e.target?.id === 'btn-rechnung-new') {
      e.preventDefault();
      window.navigateTo('/rechnung/new');
    }
  }, { signal });

  // Empty-state reset
  bindEmptyStateActions(document, {
    'reset-filters': () => list.onFiltersReset()
  }, { signal });

  // Download-Action
  document.addEventListener('click', (e) => {
    const actionItem = e.target.closest('.action-item[data-action="download"]');
    if (actionItem) {
      e.preventDefault();
      list.selection.handleDownload(actionItem.dataset.id, list.rechnungen);
    }
  }, { signal });

  // Notiz-Indikator
  document.addEventListener('click', async (e) => {
    const indicator = e.target.closest('.notiz-indicator');
    if (!indicator) return;
    e.preventDefault();
    e.stopPropagation();
    const rechnungId = indicator.dataset.notizId;
    if (!rechnungId) return;
    const result = await rechnungNotizModal.open({ rechnungId, mode: 'edit' });
    if (result.action === 'save' && result.text) {
      await rechnungNotizModal.saveNotiz(rechnungId, result.text);
    } else if (result.action === 'delete') {
      await rechnungNotizModal.deleteNotiz(rechnungId);
      list._notizMap.delete(rechnungId);
      const btn = document.querySelector(`.notiz-indicator[data-notiz-id="${rechnungId}"]`);
      if (btn) btn.remove();
    }
  }, { signal });

  // Bezahlt-Toggle
  document.addEventListener('change', async (e) => {
    const target = e.target;
    if (!target?.classList?.contains('rechnung-bezahlt-toggle')) return;
    const id = target.dataset.id;
    if (!id || list._bezahltUpdateInFlight.has(id)) return;

    const newStatus = target.checked ? 'Bezahlt' : 'Offen';
    list._bezahltUpdateInFlight.add(id);
    target.disabled = true;
    try {
      const result = await window.dataService.updateEntity('rechnung', id, { status: newStatus });
      if (result?.error) throw new Error(result.error);
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'rechnung', id, action: 'updated', field: 'status', value: newStatus }
      }));
    } catch (err) {
      target.checked = !target.checked;
      window.toastSystem?.show?.('Fehler beim Ändern des Status', 'error');
      console.error('❌ Bezahlt-Toggle Fehler:', err);
    } finally {
      list._bezahltUpdateInFlight.delete(id);
      target.disabled = !window.isAdmin();
    }
  }, { signal });

  // Status-Tab clicks
  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.rechnung-status-tabs .tab-button');
    if (!tabBtn) return;
    e.preventDefault();
    const tab = tabBtn.dataset.tab;
    if (tab && tab !== list.activeStatusTab) {
      list.activeStatusTab = tab;
      document.querySelectorAll('.rechnung-status-tabs .tab-button').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      list.updateStatusTabCounts();
      list.updateTable(list.getFilteredRechnungen());
    }
  }, { signal });

  // Type-Tab clicks
  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.rechnung-type-tabs .tab-button');
    if (!tabBtn) return;
    e.preventDefault();
    const tab = tabBtn.dataset.tab;
    if (tab && tab !== list.activeTypeTab) {
      list.activeTypeTab = tab;
      list.activeStatusTab = 'alle';
      document.querySelectorAll('.rechnung-type-tabs .tab-button').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      document.querySelectorAll('.rechnung-status-tabs .tab-button').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === 'alle');
      });
      list.reloadBlatt({ withCounts: true });
    }
  }, { signal });

  // Month-Tab clicks
  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('#rechnung-month-tabs .tab-button[data-tab]');
    if (!tabBtn) return;
    e.preventDefault();
    list.selectInvoiceMonth(tabBtn.dataset.tab);
  }, { signal });

  // Year select
  document.addEventListener('change', (e) => {
    if (e.target?.id === 'rechnung-year-select') {
      list.selectInvoiceYear(e.target.value);
    }
  }, { signal });

  // Table links
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.table-link[data-table][data-id]');
    if (!link) return;
    e.preventDefault();
    const table = link.dataset.table;
    const id = link.dataset.id;
    if (table && id) window.navigateTo(`/${table}/${id}`);
  }, { signal });

  // Unternehmen-Quickfilter: toggle / reset / click-outside
  document.addEventListener('click', (e) => {
    const container = document.getElementById('rechnung-unternehmen-filter-container');
    const dropdown = document.getElementById('rechnung-unternehmen-filter-dropdown');
    const toggleButton = document.getElementById('rechnung-unternehmen-filter-toggle');
    if (!container || !dropdown || !toggleButton) return;

    if (e.target.closest('#rechnung-unternehmen-filter-toggle')) {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = !dropdown.classList.contains('show');
      dropdown.classList.toggle('show', willOpen);
      toggleButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      return;
    }

    if (e.target.closest('#rechnung-unternehmen-filter-reset')) {
      e.preventDefault();
      list.applyUnternehmenQuickFilter([]);
      return;
    }

    if (!e.target.closest('#rechnung-unternehmen-filter-container')) {
      dropdown.classList.remove('show');
      toggleButton.setAttribute('aria-expanded', 'false');
    }
  }, { signal });

  // Unternehmen-Quickfilter: checkbox change
  document.addEventListener('change', (e) => {
    if (!e.target.classList.contains('rechnung-unternehmen-filter-toggle-input')) return;
    const selectedIds = Array.from(
      document.querySelectorAll('.rechnung-unternehmen-filter-toggle-input:checked')
    ).map(input => input.value).filter(Boolean);
    list.applyUnternehmenQuickFilter(selectedIds);
  }, { signal });

  // Drag-to-scroll (bind once)
  bindDragToScroll(list, signal);
}

// ────────────────────────── Drag-to-scroll ──────────────────────

function bindDragToScroll(list, signal) {
  const container = document.querySelector('.rechnung-table-container');
  if (!container) return;
  container.classList.add('drag-scroll-enabled');
  container.style.cursor = 'grab';

  let isDragging = false;
  let startX = 0;
  let scrollLeft = 0;

  const onDown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' ||
        e.target.closest('a') || e.target.closest('button') ||
        e.target.closest('.actions-dropdown-container')) return;
    isDragging = true;
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    container.scrollLeft = scrollLeft - (e.pageX - container.offsetLeft - startX) * 1.5;
  };
  const onUp = () => {
    if (!isDragging) return;
    isDragging = false;
    container.style.cursor = 'grab';
    container.style.userSelect = '';
  };

  container.addEventListener('mousedown', onDown, { signal });
  container.addEventListener('mousemove', onMove, { signal });
  container.addEventListener('mouseup', onUp, { signal });
  container.addEventListener('mouseleave', onUp, { signal });
}
