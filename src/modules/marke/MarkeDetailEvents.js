// MarkeDetailEvents.js
// Event-Binding: Document-Click, entityUpdated, softRefresh, Cache-Invalidierung

import { tabDataCache } from '../../core/loaders/TabDataCache.js';
import { loadMarkeTabData } from './MarkeDetailLoader.js';

export function bindMarkeDetailEvents(detail) {
  detail.bindSidebarTabs();

  if (detail._eventsBound) return;
  detail._eventsBound = true;

  detail._eventsAbort?.abort();
  detail._eventsAbort = new AbortController();
  const signal = detail._eventsAbort.signal;

  // Zentraler Click-Handler
  const handleDocumentClick = async (e) => {
    // Tab-Button Navigation
    const btn = e.target.closest('.tab-button');
    if (btn) {
      e.preventDefault();
      const tab = btn.dataset.tab;
      if (!tab) return;

      detail.activeMainTab = tab;
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const pane = document.getElementById(`tab-${tab}`);
      if (pane) {
        pane.classList.add('active');
        if (!['ansprechpartner'].includes(tab)) {
          await loadMarkeTabData(detail, tab);
        }
      }
      return;
    }

    // Persona anlegen (eigene Seite)
    if (e.target.closest('.persona-create-btn')) {
      e.preventDefault();
      window.navigateTo(`/marke/${detail.markeId}/persona`);
      return;
    }

    // Persona bearbeiten - muss vor dem generischen table-link-Handler stehen
    const personaRow = e.target.closest('.persona-row-open');
    if (personaRow) {
      e.preventDefault();
      window.navigateTo(`/marke/${detail.markeId}/persona?persona=${personaRow.dataset.personaId}`);
      return;
    }

    // Produkt anlegen (eigene Seite)
    if (e.target.closest('.produkt-create-btn')) {
      e.preventDefault();
      window.navigateTo(`/marke/${detail.markeId}/produkt`);
      return;
    }

    // Produkt bearbeiten - ebenfalls vor dem generischen table-link-Handler
    const produktRow = e.target.closest('.produkt-row-open');
    if (produktRow) {
      e.preventDefault();
      window.navigateTo(`/marke/${detail.markeId}/produkt?produkt=${produktRow.dataset.produktId}`);
      return;
    }

    // Marke bearbeiten
    if (e.target.closest('#btn-edit-marke')) {
      detail.showEditForm();
      return;
    }

    // Ansprechpartner hinzufügen
    if (e.target.id === 'btn-add-ansprechpartner') {
      const markeId = e.target.dataset.markeId || detail.markeId;
      if (window.actionsDropdown) {
        window.actionsDropdown.openAddAnsprechpartnerModal(markeId);
      }
      return;
    }

    // Navigation zu verknüpften Entitäten
    if (e.target.classList.contains('table-link')) {
      e.preventDefault();
      const table = e.target.dataset.table;
      const id = e.target.dataset.id;
      window.navigateTo(`/${table}/${id}`);
      return;
    }
  };

  // Entity Updated Handler
  const handleEntityUpdated = (e) => {
    if (e.detail?.entity === 'ansprechpartner' && e.detail?.markeId === detail.markeId) {
      detail.loadCriticalData().then(() => {
        detail.render();
        detail.bindEvents();
      });
    }
  };

  // Soft-Refresh Handler
  const handleSoftRefresh = async () => {
    const hasActiveForm = document.querySelector('form.edit-form, .drawer.show, .modal.show');
    if (hasActiveForm) return;
    if (!detail.markeId || !location.pathname.includes('/marke/')) return;

    await detail.loadCriticalData();
    detail.render();
    detail.bindEvents();
  };

  document.addEventListener('click', handleDocumentClick, { signal });
  document.addEventListener('entityUpdated', handleEntityUpdated, { signal });
  window.addEventListener('softRefresh', handleSoftRefresh, { signal });
}

export function setupCacheInvalidation(detail) {
  detail._cacheAbortController?.abort();
  detail._cacheAbortController = new AbortController();

  window.addEventListener('entityUpdated', (e) => {
    if (e.detail?.entity === 'marke' && e.detail?.id === detail.markeId) {
      tabDataCache.invalidate('marke', detail.markeId);

      if (e.detail.action === 'updated') {
        detail.loadCriticalData().then(() => detail.render());
      }
    }
  }, { signal: detail._cacheAbortController.signal });
}
