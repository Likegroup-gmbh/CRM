// VideoTableStatusDropdown
// Status-Update der Kampagnen-Video-Tabelle inkl. optimistischem Inline-Render.
// Das Dropdown selbst ist der zentrale TableSelect (core/components/TableSelect.js).
// Haelt den Orchestrator (KampagneKooperationenVideoTable) frei von dieser Logik.

export class VideoTableStatusDropdown {
  constructor(table) {
    this.table = table;
  }

  async handleChange(kooperationId, newStatusId) {
    const t = this.table;
    const store = t.store;
    const statusOptions = store?.statusOptions || t.statusOptions || [];
    const statusName = statusOptions.find(s => s.id === newStatusId)?.name || '';

    // ID-basierter Guard: traegt den eigenen Update fuer 10s, robust gegen
    // langsame Realtime-Echos (z.B. erster Klick mit Cold-Connection).
    if (!t._pendingOwnUpdates) t._pendingOwnUpdates = new Map();
    t._pendingOwnUpdates.set(kooperationId, Date.now());
    t._lastUpdateBy = window.currentUser?.id;
    t._lastUpdateTime = Date.now();

    if (store) {
      store.updateKooperation(kooperationId, {
        status_id: newStatusId || null,
        status_name: statusName || null,
        status_ref: newStatusId ? { id: newStatusId, name: statusName } : null
      });
    }

    this.updateInline(kooperationId, newStatusId, statusName);

    try {
      const { error } = await window.supabase
        .from('kooperationen')
        .update({ status_id: newStatusId || null, status: statusName, updated_at: new Date().toISOString() })
        .eq('id', kooperationId);

      if (error) throw error;

      t._lastUpdateTime = Date.now();
      t._pendingOwnUpdates.set(kooperationId, Date.now());

      window.dispatchEvent(new CustomEvent('kooperationStatusChanged', {
        detail: { kooperationId, statusId: newStatusId, statusName }
      }));
      window.dispatchEvent(new CustomEvent('kooperationen-updated', {
        detail: { kampagneId: t.kampagneId, koopId: kooperationId, newStatusId }
      }));
    } catch (error) {
      console.error('❌ Fehler beim Status-Update:', error);
      t._pendingOwnUpdates.delete(kooperationId);
    }
  }

  updateInline(kooperationId, statusId, statusName) {
    const t = this.table;
    // Fallback-Mutation: nur wenn Store-Update (im Aufrufer) noch nicht erfolgt ist
    const koop = t.kooperationen.find(k => k.id === kooperationId);
    if (koop && koop.status_id !== (statusId || null)) {
      koop.status_id = statusId || null;
      koop.status_name = statusName || null;
      koop.status_ref = statusId ? { id: statusId, name: statusName } : null;
    }

    const row = document.querySelector(`tr[data-kooperation-id="${kooperationId}"]`);
    if (!row) return;

    const cell = row.querySelector('.col-status');
    if (!cell || !t.renderer) return;

    cell.innerHTML = t.renderer.renderStatusSelect(
      koop || { id: kooperationId, status_id: statusId, status_name: statusName, status_ref: statusId ? { id: statusId, name: statusName } : null }
    );
  }
}
