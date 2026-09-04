// UnternehmenDetailEvents.js
// Event-Binding und Drag-to-Scroll für Unternehmen-Detailseite

import { activateSecondaryNavTab, getSecondaryNavTabFromEvent } from '../../core/TabUtils.js';

export function bindUnternehmenDetailEvents(detail) {
  detail.bindSidebarTabs();

  detail._eventsAbort?.abort();
  detail._eventsAbort = new AbortController();
  const signal = detail._eventsAbort.signal;

  // Main Tab-Navigation
  detail._tabClickHandler = (e) => {
    const tab = getSecondaryNavTabFromEvent(e);
    if (!tab) return;
    e.preventDefault();
    detail.activeMainTab = tab;
    activateSecondaryNavTab(tab);
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

  // Personas und Produkte: eigene Seiten, gleiche Formulare wie bei der Marke.
  // Muss vor dem generischen table-link-Handler stehen.
  detail._personaProduktClickHandler = (e) => {
    const basis = `/unternehmen/${detail.unternehmenId}`;

    if (e.target.closest('.persona-create-btn')) {
      e.preventDefault();
      window.navigateTo(`${basis}/persona`);
      return;
    }

    const personaRow = e.target.closest('.persona-row-open');
    if (personaRow) {
      e.preventDefault();
      window.navigateTo(`${basis}/persona?persona=${personaRow.dataset.personaId}`);
      return;
    }

    if (e.target.closest('.produkt-create-btn')) {
      e.preventDefault();
      window.navigateTo(`${basis}/produkt`);
      return;
    }

    const produktRow = e.target.closest('.produkt-row-open');
    if (produktRow) {
      e.preventDefault();
      window.navigateTo(`${basis}/produkt?produkt=${produktRow.dataset.produktId}`);
    }
  };
  document.addEventListener('click', detail._personaProduktClickHandler, { signal });

  // Navigation zu verknüpften Entitäten
  detail._tableLinkClickHandler = (e) => {
    const link = e.target.closest?.('.table-link');
    if (!link) return;
    const { table, id } = link.dataset;
    if (link.dataset.vertragOpen === 'edit' && id) {
      e.preventDefault();
      window.navigateTo(`/vertraege/${id}/edit`);
      return;
    }
    if (!table || !id) return;
    e.preventDefault();
    window.navigateTo(`/${table}/${id}`);
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
    if (['produkt', 'persona', 'strategie', 'creator_auswahl'].includes(e.detail?.entity)) {
      detail.loadUnternehmenData().then(() => {
        detail.render(true);
        detail.bindDragToScroll();
      });
    }
    // Auftragsbetraege stehen in den Tabs Auftraege und Kundenrechnungen.
    // Ohne diesen Zweig bleiben die Summen stehen, bis man die Seite neu betritt.
    if (['auftrag', 'auftrag_teilrechnung'].includes(e.detail?.entity)) {
      detail.loadUnternehmenData().then(() => {
        detail.render(true);
        detail.bindDragToScroll();
      });
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
