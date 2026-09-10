// RechnungListSelection.js
// Bulk-selection: checkboxes, select-all, download, delete for Rechnung list.

import { resolveDocumentUrl } from '../../core/DocumentUrlHelper.js';

export class RechnungListSelection {
  constructor() {
    this.selected = new Set();
  }

  /** Bind checkbox/button handlers after table render */
  bind(rechnungen) {
    document.querySelectorAll('.rechnung-check').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) this.selected.add(id);
        else this.selected.delete(id);
        this._updateUI();
        this._updateHeaderSelectAll();
      });
    });

    const headerCb = document.getElementById('select-all-rechnungen');
    if (headerCb) {
      headerCb.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.rechnung-check').forEach(cb => {
          cb.checked = isChecked;
          if (isChecked) this.selected.add(cb.dataset.id);
          else this.selected.delete(cb.dataset.id);
        });
        this._updateUI();
      });
    }

    const selectAllBtn = document.getElementById('btn-select-all');
    if (selectAllBtn) {
      selectAllBtn.onclick = (e) => {
        e.preventDefault();
        document.querySelectorAll('.rechnung-check').forEach(cb => { cb.checked = true; this.selected.add(cb.dataset.id); });
        const h = document.getElementById('select-all-rechnungen');
        if (h) { h.indeterminate = false; h.checked = true; }
        this._updateUI();
      };
    }

    const deselectAllBtn = document.getElementById('btn-deselect-all');
    if (deselectAllBtn) {
      deselectAllBtn.onclick = (e) => {
        e.preventDefault();
        document.querySelectorAll('.rechnung-check').forEach(cb => { cb.checked = false; });
        this.selected.clear();
        const h = document.getElementById('select-all-rechnungen');
        if (h) { h.indeterminate = false; h.checked = false; }
        this._updateUI();
      };
    }

    const deleteBtn = document.getElementById('btn-delete-selected');
    if (deleteBtn) {
      deleteBtn.onclick = async (e) => {
        e.preventDefault();
        await this.showDeleteConfirmation(rechnungen);
      };
    }

    const downloadBtn = document.getElementById('btn-download-selected');
    if (downloadBtn) {
      downloadBtn.onclick = async (e) => {
        e.preventDefault();
        await this.downloadSelected(rechnungen);
      };
    }
  }

  // ──────────────────────────── Single download ────────────────────────────

  async handleDownload(rechnungId, rechnungen) {
    const rechnung = rechnungen.find(r => r.id === rechnungId);
    if (!rechnung) {
      window.toastSystem?.show('Rechnung nicht gefunden', 'error');
      return;
    }
    const pdfs = rechnung.rechnung_pdfs || [];
    if (pdfs.length === 0 && !rechnung.pdf_url) {
      window.toastSystem?.show('Keine PDF für diese Rechnung hinterlegt', 'warning');
      return;
    }
    const urls = pdfs.length > 0
      ? pdfs.map(p => ({ url: p.open_url, name: p.file_name }))
      : [{ url: rechnung.pdf_url, name: `Rechnung_${rechnung.rechnung_nr || rechnungId}.pdf` }];
    for (const { url, name } of urls) {
      const openUrl = await resolveDocumentUrl(url);
      const link = document.createElement('a');
      link.href = openUrl;
      link.target = '_blank';
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // ──────────────────────────── Bulk download ──────────────────────────────

  async downloadSelected(rechnungen) {
    const selectedIds = Array.from(this.selected);
    if (selectedIds.length === 0) {
      window.toastSystem?.show('Keine Rechnungen ausgewählt', 'warning');
      return;
    }
    const toDownload = rechnungen.filter(r =>
      selectedIds.includes(r.id) && ((r.rechnung_pdfs && r.rechnung_pdfs.length > 0) || r.pdf_url)
    );
    if (toDownload.length === 0) {
      window.toastSystem?.show('Keine der ausgewählten Rechnungen hat eine PDF hinterlegt', 'warning');
      return;
    }
    const skipped = selectedIds.length - toDownload.length;
    if (skipped > 0) {
      window.toastSystem?.show(`${skipped} Rechnung(en) ohne PDF übersprungen`, 'info');
    }
    const allPdfs = [];
    for (const rechnung of toDownload) {
      const pdfs = rechnung.rechnung_pdfs && rechnung.rechnung_pdfs.length > 0
        ? rechnung.rechnung_pdfs.map(p => ({ url: p.open_url, name: p.file_name || `Rechnung_${rechnung.rechnung_nr}.pdf` }))
        : [{ url: rechnung.pdf_url, name: `Rechnung_${rechnung.rechnung_nr || rechnung.id}.pdf` }];
      allPdfs.push(...pdfs);
    }
    window.toastSystem?.show(`Starte Download von ${allPdfs.length} PDF(s)...`, 'info');
    for (let i = 0; i < allPdfs.length; i++) {
      const pdf = allPdfs[i];
      try {
        const fetchUrl = await resolveDocumentUrl(pdf.url);
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`Fehler beim Laden von ${pdf.name}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = pdf.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        if (i < allPdfs.length - 1) await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Fehler beim Download von ${pdf.name}:`, error);
      }
    }
    window.toastSystem?.show(`${allPdfs.length} PDF(s) heruntergeladen`, 'success');
  }

  // ──────────────────────────── Bulk delete ────────────────────────────────

  async showDeleteConfirmation(rechnungen, reloadCallback) {
    if (!window.isAdmin()) return;
    const selectedIds = Array.from(this.selected);
    if (selectedIds.length === 0) { alert('Keine Rechnungen ausgewählt.'); return; }

    const message = selectedIds.length === 1
      ? 'Möchten Sie die ausgewählte Rechnung wirklich löschen?'
      : `Möchten Sie die ${selectedIds.length} ausgewählten Rechnungen wirklich löschen?`;

    const res = await window.confirmationModal.open({
      title: 'Löschvorgang bestätigen',
      message,
      confirmText: 'Endgültig löschen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (!res?.confirmed) return;

    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      const result = await window.dataService.deleteEntities('rechnung', selectedIds);
      if (result.success) {
        selectedIds.forEach(id => document.querySelector(`tr[data-id="${id}"]`)?.remove());
        alert(`✅ ${result.deletedCount} Rechnungen erfolgreich gelöscht.`);
        this.selected.clear();
        const tbody = document.querySelector('.data-table tbody');
        if (tbody && tbody.children.length === 0 && reloadCallback) await reloadCallback();
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'rechnung', action: 'bulk-deleted', count: result.deletedCount }
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
      if (reloadCallback) await reloadCallback();
    }
  }

  // ──────────────────────────── UI helpers ─────────────────────────────────

  _updateHeaderSelectAll() {
    const header = document.getElementById('select-all-rechnungen');
    const all = document.querySelectorAll('.rechnung-check');
    if (!header || all.length === 0) return;
    const checked = document.querySelectorAll('.rechnung-check:checked').length;
    header.checked = checked === all.length;
    header.indeterminate = checked > 0 && checked < all.length;
  }

  _updateUI() {
    const count = this.selected.size;
    const countEl = document.getElementById('selected-count');
    const selectBtn = document.getElementById('btn-select-all');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const downloadBtn = document.getElementById('btn-download-selected');
    const deleteBtn = document.getElementById('btn-delete-selected');
    if (countEl) { countEl.textContent = `${count} ausgewählt`; countEl.style.display = count > 0 ? 'inline' : 'none'; }
    if (selectBtn) selectBtn.style.display = count > 0 ? 'none' : 'inline-block';
    if (deselectBtn) deselectBtn.style.display = count > 0 ? 'inline-block' : 'none';
    if (downloadBtn) downloadBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    if (deleteBtn) deleteBtn.style.display = count > 0 ? 'inline-block' : 'none';
  }
}
