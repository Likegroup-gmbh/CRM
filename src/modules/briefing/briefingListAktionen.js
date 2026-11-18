// briefingListAktionen.js
// Klicks der Briefing-Liste (Ansicht, Ordner, Neu, Links) sowie Auswahl und Mehrfach-Löschen.
// Alle Listener hängen am AbortController der Liste (destroy räumt ab).

import { bindEmptyStateActions } from '../../core/components/EmptyState.js';

export function installBriefingListAktionen(proto) {
  Object.assign(proto, {
    bindEvents() {
      this._abortController?.abort();
      this._abortController = new AbortController();
      const signal = this._abortController.signal;

      document.addEventListener('click', (e) => {
        const listBtn = e.target.closest('#btn-view-list');
        if (listBtn) {
          e.preventDefault();
          this.setListViewMode('list');
          return;
        }

        const gridBtn = e.target.closest('#btn-view-grid');
        if (gridBtn) {
          e.preventDefault();
          this.setListViewMode('grid');
          return;
        }

        const backCompanies = e.target.closest('#btn-back-to-companies');
        if (backCompanies) {
          e.preventDefault();
          this.switchToCompaniesView();
          return;
        }

        const backBrands = e.target.closest('#btn-back-to-brands');
        if (backBrands) {
          e.preventDefault();
          this.backFromItems();
          return;
        }

        const companyCard = e.target.closest('#companies-grid .folder-card');
        if (companyCard) {
          this.switchToBrandsView(companyCard.dataset.unternehmenId, companyCard.dataset.unternehmenName);
          return;
        }

        const brandCard = e.target.closest('#brands-grid .folder-card');
        if (brandCard) {
          if (brandCard.dataset.ohneMarke === '1') {
            this.switchToItemsView(null, brandCard.dataset.markeName, { ohneMarke: true });
          } else {
            this.switchToItemsView(brandCard.dataset.markeId, brandCard.dataset.markeName);
          }
          return;
        }

        if (e.target.id === 'btn-briefing-new' || e.target.closest('#btn-briefing-new')) {
          e.preventDefault();
          window.navigateTo(this.createUrl());
        }
      }, { signal });

      bindEmptyStateActions(document, {
        'reset-filters': () => this.onFiltersReset()
      }, { signal });

      document.addEventListener('click', (e) => {
        if (e.target.id === 'btn-select-all') {
          e.preventDefault();
          const checkboxes = document.querySelectorAll('.briefing-check');
          checkboxes.forEach(cb => {
            cb.checked = true;
            if (cb.dataset.id) this.selectedBriefings.add(cb.dataset.id);
          });
          const selectAllHeader = document.getElementById('select-all-briefings');
          if (selectAllHeader) {
            selectAllHeader.indeterminate = false;
            selectAllHeader.checked = true;
          }
          this.updateSelection();
        }
      }, { signal });

      document.addEventListener('click', (e) => {
        if (e.target.id === 'btn-deselect-all') {
          e.preventDefault();
          document.querySelectorAll('.briefing-check').forEach(cb => { cb.checked = false; });
          this.selectedBriefings.clear();
          const selectAllHeader = document.getElementById('select-all-briefings');
          if (selectAllHeader) {
            selectAllHeader.indeterminate = false;
            selectAllHeader.checked = false;
          }
          this.updateSelection();
        }
      }, { signal });

      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('table-link') && e.target.dataset.table === 'briefing') {
          e.preventDefault();
          const id = e.target.dataset.id;
          window.navigateTo(`/briefing/${id}`);
        }
      }, { signal });

      window.addEventListener('entityUpdated', (e) => {
        if (e.detail.entity === 'briefing') {
          this._forceReload = true;
          this.loadAndRender();
        }
      }, { signal });

      document.addEventListener('change', (e) => {
        if (e.target.id === 'select-all-briefings') {
          const checkboxes = document.querySelectorAll('.briefing-check');
          const isChecked = e.target.checked;
          checkboxes.forEach(cb => {
            cb.checked = isChecked;
            if (isChecked) this.selectedBriefings.add(cb.dataset.id);
            else this.selectedBriefings.delete(cb.dataset.id);
          });
          this.updateSelection();
        }
      }, { signal });

      document.addEventListener('change', (e) => {
        if (e.target.classList.contains('briefing-check')) {
          if (e.target.checked) this.selectedBriefings.add(e.target.dataset.id);
          else this.selectedBriefings.delete(e.target.dataset.id);
          this.updateSelection();
          this.updateSelectAllCheckbox();
        }
      }, { signal });
    },

    async showDeleteSelectedConfirmation() {
      const selectedCount = this.selectedBriefings.size;
      if (selectedCount === 0) {
        alert('Keine Briefings ausgewählt.');
        return;
      }

      const message = selectedCount === 1
        ? 'Möchten Sie das ausgewählte Briefing wirklich löschen?'
        : `Möchten Sie die ${selectedCount} ausgewählten Briefings wirklich löschen?`;

      if (window.confirmationModal) {
        const res = await window.confirmationModal.open({ title: 'Löschvorgang bestätigen', message, confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', danger: true });
        if (res?.confirmed) this.deleteSelectedBriefings();
      } else {
        const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
        if (confirmed) this.deleteSelectedBriefings();
      }
    },

    async deleteSelectedBriefings() {
      if (!window.canBulkDelete()) return;

      const selectedIds = Array.from(this.selectedBriefings);

      selectedIds.forEach(id => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) row.style.opacity = '0.5';
      });

      try {
        const { error } = await window.supabase
          .from('campaign_briefings')
          .delete()
          .in('id', selectedIds);

        if (error) throw error;

        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });

        window.toastSystem?.show(`${selectedIds.length} Briefing(s) gelöscht.`, 'success');

        this.selectedBriefings.clear();
        this.updateSelection();
        this.updateSelectAllCheckbox();

        const tbody = document.getElementById('briefings-table-body');
        if (tbody && tbody.children.length === 0) {
          this._forceReload = true;
          await this.loadAndRender();
        }

        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'briefing', action: 'bulk-deleted', count: selectedIds.length }
        }));
      } catch (error) {
        selectedIds.forEach(id => {
          const row = document.querySelector(`tr[data-id="${id}"]`);
          if (row) row.style.opacity = '1';
        });
        console.error('Fehler beim Löschen:', error);
        window.toastSystem?.show(`Fehler beim Löschen: ${error.message}`, 'error');
        this._forceReload = true;
        await this.loadAndRender();
      }
    },

    updateSelection() {
      const selectedCount = this.selectedBriefings.size;
      const selectedCountEl = document.getElementById('selected-count');
      const selectBtn = document.getElementById('btn-select-all');
      const deselectBtn = document.getElementById('btn-deselect-all');
      const deleteBtn = document.getElementById('btn-delete-selected');

      if (selectedCountEl) {
        selectedCountEl.textContent = `${selectedCount} ausgewählt`;
        selectedCountEl.style.display = selectedCount > 0 ? 'inline' : 'none';
      }
      if (selectBtn) selectBtn.style.display = selectedCount > 0 ? 'none' : 'inline-block';
      if (deselectBtn) deselectBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
      if (deleteBtn) deleteBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    },

    updateSelectAllCheckbox() {
      const selectAllCheckbox = document.getElementById('select-all-briefings');
      const checkboxes = document.querySelectorAll('.briefing-check');

      if (!selectAllCheckbox || checkboxes.length === 0) return;

      const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
      const totalCount = checkboxes.length;

      selectAllCheckbox.checked = checkedCount === totalCount;
      selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < totalCount;
    }
  });
}
