// CreatorListBulk.js
// Bulk-Delete (Prototype-Mixin)

import { CreatorList } from './CreatorListCore.js';

CreatorList.prototype.showDeleteSelectedConfirmation = async function() {
  const selectedCount = this.selectedItems.size;
  if (selectedCount === 0) {
    alert('Keine Creator ausgewählt.');
    return;
  }

  const message = selectedCount === 1 
    ? 'Möchten Sie den ausgewählten Creator wirklich löschen?' 
    : `Möchten Sie die ${selectedCount} ausgewählten Creator wirklich löschen?`;

  if (window.confirmationModal) {
    const res = await window.confirmationModal.open({ title: 'Löschvorgang bestätigen', message, confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', danger: true });
    if (res?.confirmed) this.deleteSelectedCreators();
  } else {
    const confirmed = confirm(`${message}\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
    if (confirmed) this.deleteSelectedCreators();
  }
};

CreatorList.prototype.deleteSelectedCreators = async function() {
  const selectedIds = Array.from(this.selectedItems);
  const totalCount = selectedIds.length;
  
  console.log(`🗑️ Lösche ${totalCount} Creator...`);
  
  // Optimistisches UI-Update: Zeilen ausblenden
  selectedIds.forEach(id => {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) row.style.opacity = '0.5';
  });

  try {
    const result = await window.dataService.deleteEntities('creator', selectedIds);
    
    if (result.success) {
      selectedIds.forEach(id => {
        document.querySelector(`tr[data-id="${id}"]`)?.remove();
      });
      
      alert(`✅ ${result.deletedCount} Creator erfolgreich gelöscht.`);
      
      this.deselectAll();
      
      const tbody = document.querySelector('.data-table tbody');
      if (tbody && tbody.children.length === 0) {
        await this.loadData();
      }
      
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'creator', action: 'bulk-deleted', count: result.deletedCount }
      }));
    } else {
      throw new Error(result.error || 'Löschen fehlgeschlagen');
    }
  } catch (error) {
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '1';
    });
    
    console.error('❌ Fehler beim Löschen:', error);
    alert(`❌ Fehler beim Löschen: ${error.message}`);
    
    await this.loadData();
  }
};
