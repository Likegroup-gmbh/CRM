// UnternehmenDetailEvents.js
// Event-Binding und Drag-to-Scroll für Unternehmen-Detailseite

import { renderKickOff, bindUnternehmenKickOffCreateButton } from './UnternehmenDetailRendererRelations.js';

export function bindUnternehmenDetailEvents(detail) {
  detail.bindSidebarTabs();

  // Kick-Off Create Button binden (nach jedem Render)
  bindUnternehmenKickOffCreateButton(detail);

  detail._eventsAbort?.abort();
  detail._eventsAbort = new AbortController();
  const signal = detail._eventsAbort.signal;

  // Main Tab-Navigation
  detail._tabClickHandler = (e) => {
    const kickoffTypeBtn = e.target.closest('.kickoff-type-btn');
    if (kickoffTypeBtn) {
      e.preventDefault();
      const nextType = kickoffTypeBtn.dataset.kickoffType;
      if (!['paid', 'organic'].includes(nextType)) return;
      detail.activeKickoffType = nextType;
      detail.kickoff = detail.kickoffsByType[nextType] || null;
      detail.kickoffMarkenwerte = detail.kickoffMarkenwerteByType[nextType] || [];
      const pane = document.getElementById('tab-kickoff');
      if (pane) pane.innerHTML = renderKickOff(detail);
      bindUnternehmenKickOffCreateButton(detail);
      return;
    }

    const btn = e.target.closest('.tab-button');
    if (!btn) return;
    e.preventDefault();
    const tab = btn.dataset.tab;
    if (!tab) return;

    detail.activeMainTab = tab;
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const pane = document.getElementById(`tab-${tab}`);
    if (pane) pane.classList.add('active');
    detail.bindDragToScroll();
  };
  document.addEventListener('click', detail._tabClickHandler, { signal });

  // Unternehmen bearbeiten Button
  detail._editClickHandler = (e) => {
    if (e.target.closest('#btn-edit-unternehmen')) {
      detail.showEditForm();
    }
  };
  document.addEventListener('click', detail._editClickHandler, { signal });

  // Ansprechpartner hinzufügen Button
  detail._ansprechpartnerClickHandler = (e) => {
    if (e.target.id === 'btn-add-ansprechpartner-unternehmen') {
      const unternehmenId = e.target.dataset.unternehmenId || detail.unternehmenId;
      if (window.actionsDropdown) {
        window.actionsDropdown.openAddAnsprechpartnerToUnternehmenModal(unternehmenId);
      }
    }
  };
  document.addEventListener('click', detail._ansprechpartnerClickHandler, { signal });

  // Navigation zu verknüpften Entitäten
  detail._tableLinkClickHandler = (e) => {
    if (e.target.classList.contains('table-link')) {
      e.preventDefault();
      const table = e.target.dataset.table;
      const id = e.target.dataset.id;
      window.navigateTo(`/${table}/${id}`);
    }
  };
  document.addEventListener('click', detail._tableLinkClickHandler, { signal });

  // Entity Updates (für Ansprechpartner und Unternehmen)
  detail._entityUpdatedHandler = (e) => {
    if (e.detail?.entity === 'ansprechpartner' && e.detail?.unternehmenId === detail.unternehmenId) {
      detail.loadUnternehmenData().then(() => detail.render());
    }
    if (e.detail?.entity === 'unternehmen' && e.detail?.id === detail.unternehmenId) {
      detail.loadUnternehmenData().then(() => detail.render());
    }
  };
  document.addEventListener('entityUpdated', detail._entityUpdatedHandler, { signal });

  // Soft-Refresh bei Realtime-Updates
  detail._softRefreshHandler = async () => {
    if (detail._isLoading) return;
    if (document.querySelector('form.edit-form, .drawer.show, .modal.show')) return;
    if (!detail.unternehmenId || !location.pathname.includes('/unternehmen/')) return;

    await detail.loadUnternehmenData();
    detail.render();
    detail.bindDragToScroll();
  };
  window.addEventListener('softRefresh', detail._softRefreshHandler, { signal });
}

export function bindUnternehmenDetailDragScroll(detail) {
  detail._dragCleanup?.();
  detail._dragCleanup = null;

  const container = document.querySelector('.tab-pane.active .data-table-container');
  if (!container) return;

  container.classList.add('drag-scroll-enabled');

  const handleMouseDown = (e) => {
    if (
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'BUTTON' ||
      e.target.classList.contains('status-badge') ||
      e.target.closest('a') ||
      e.target.closest('.actions-dropdown-container')
    ) return;

    detail.isDragging = true;
    detail.startX = e.pageX - container.offsetLeft;
    detail.scrollLeft = container.scrollLeft;
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!detail.isDragging) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - detail.startX) * 1.5;
    container.scrollLeft = detail.scrollLeft - walk;
  };

  const handleMouseUp = () => {
    if (detail.isDragging) {
      detail.isDragging = false;
      container.style.cursor = 'grab';
      container.style.userSelect = '';
    }
  };

  container.addEventListener('mousedown', handleMouseDown);
  container.addEventListener('mousemove', handleMouseMove);
  container.addEventListener('mouseup', handleMouseUp);
  container.addEventListener('mouseleave', handleMouseUp);
  container.style.cursor = 'grab';

  detail._dragCleanup = () => {
    container.classList.remove('drag-scroll-enabled');
    container.removeEventListener('mousedown', handleMouseDown);
    container.removeEventListener('mousemove', handleMouseMove);
    container.removeEventListener('mouseup', handleMouseUp);
    container.removeEventListener('mouseleave', handleMouseUp);
    container.style.cursor = '';
  };
}
