// CreatorListBulk.js
// Instagram-Bulk-Connect und Bulk-Delete (Prototype-Mixin)

import { CreatorList } from './CreatorListCore.js';
import { connectInstagramSilent } from '../../core/ActionsDropdownHandlers.js';

// ══════════════════════════════════════════════════════════════════════════
// BULK INSTAGRAM CONNECT
// ══════════════════════════════════════════════════════════════════════════

/**
 * Basis-Query für nicht verbundene Creator (Instagram-Handle gesetzt,
 * ig_connected_at leer).
 */
CreatorList.prototype._notConnectedQuery = function(select, options = {}) {
  return window.supabase
    .from('creator')
    .select(select, options)
    .not('instagram', 'is', null)
    .neq('instagram', '')
    .is('ig_connected_at', null);
};

/**
 * Zeigt im Button die Gesamtanzahl der nicht verbundenen Creator.
 */
CreatorList.prototype._updateConnectAllCount = async function() {
  const btn = document.getElementById('btn-connect-all');
  if (!btn || this._bulkConnectRunning || !window.supabase) return;

  try {
    const { count, error } = await this._notConnectedQuery('id', { count: 'exact', head: true });
    if (error) throw error;
    btn.textContent = `Connect (${count ?? 0})`;
  } catch (err) {
    console.warn('Connect-Count konnte nicht geladen werden:', err);
    btn.textContent = 'Connect';
  }
};

/**
 * Lädt alle IDs der nicht verbundenen Creator (seitenweise, um das
 * Supabase-Limit von 1000 Zeilen zu umgehen).
 */
CreatorList.prototype._loadNotConnectedIds = async function() {
  const ids = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await this._notConnectedQuery('id')
      .order('id')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Fehler beim Laden der nicht verbundenen Creator:', error);
      break;
    }

    ids.push(...(data || []).map(r => r.id));
    if (!data || data.length < pageSize) break;
  }

  return ids;
};

/**
 * Abbruch-freundliches Warten: schläft in 500ms-Schritten und bricht ab,
 * sobald das Abort-Flag gesetzt wird.
 */
CreatorList.prototype._bulkConnectWait = async function(ms) {
  const step = 500;
  for (let waited = 0; waited < ms; waited += step) {
    if (this._bulkConnectAbort) return;
    await new Promise(resolve => setTimeout(resolve, Math.min(step, ms - waited)));
  }
};

/**
 * Connected alle nicht verbundenen Creator sequentiell (~2s Throttle).
 * Bei Meta-Rate-Limit wird pausiert (60s, eskalierend bis 10min) und der
 * gleiche Creator erneut versucht; andere Fehler werden übersprungen.
 * Jede Karte aktualisiert sich einzeln via entityUpdated.
 * Erneuter Klick während des Laufs (auch in einer Pause) stoppt.
 */
CreatorList.prototype.runBulkConnect = async function() {
  const btn = document.getElementById('btn-connect-all');

  if (this._bulkConnectRunning) {
    this._bulkConnectAbort = true;
    if (btn) btn.textContent = 'Wird gestoppt…';
    return;
  }

  this._bulkConnectRunning = true;
  this._bulkConnectAbort = false;

  const THROTTLE_MS = 2000;
  const BACKOFF_START_MS = 60 * 1000;
  const BACKOFF_MAX_MS = 10 * 60 * 1000;

  const setLabel = (text) => {
    const liveBtn = document.getElementById('btn-connect-all');
    if (liveBtn) liveBtn.textContent = text;
  };

  try {
    setLabel('Lade Liste…');

    const ids = await this._loadNotConnectedIds();
    const total = ids.length;
    let connected = 0;
    let backoffMs = BACKOFF_START_MS;

    const progress = () => `${connected}/${total} ✓`;
    setLabel(`Connect · ${progress()}`);

    for (let i = 0; i < ids.length; i += 1) {
      if (this._bulkConnectAbort) break;

      const result = await connectInstagramSilent(ids[i]);

      if (result.ok) {
        connected++;
        backoffMs = BACKOFF_START_MS;
      } else if (result.retryable) {
        // Rate-Limit: warten und denselben Creator erneut versuchen
        if (!this._bulkConnectAbort) {
          setLabel(`Rate-Limit – Pause ${Math.round(backoffMs / 1000)}s · ${progress()}`);
          await this._bulkConnectWait(backoffMs);
          backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
          i -= 1;
        }
        continue;
      }
      // nicht-retryable Fehler: einfach weiter zum nächsten Creator

      if (!this._bulkConnectAbort) {
        setLabel(`Connect · ${progress()}`);
        await this._bulkConnectWait(THROTTLE_MS);
      }
    }

    console.log(`✅ Bulk-Connect beendet: ${connected}/${total} verbunden`);
  } finally {
    this._bulkConnectRunning = false;
    this._bulkConnectAbort = false;
    await this._updateConnectAllCount();
  }
};

// ══════════════════════════════════════════════════════════════════════════
// BULK DELETE
// ══════════════════════════════════════════════════════════════════════════

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
