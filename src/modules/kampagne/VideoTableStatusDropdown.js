// VideoTableStatusDropdown
// Portal-basiertes Status-Dropdown der Kampagnen-Video-Tabelle: Oeffnen/Schliessen,
// Positionierung (an document.body, damit es nicht im Grid-Overflow clippt) und
// das eigentliche Status-Update inkl. optimistischem Inline-Render. Haelt den
// Orchestrator (KampagneKooperationenVideoTable) frei von dieser Logik.

export class VideoTableStatusDropdown {
  constructor(table) {
    this.table = table;
  }

  // Legacy-API fuer Tests/Kompatibilitaet.
  positionStatusDropdown(wrapper) {
    const dropdown = wrapper?.querySelector('.status-dropdown');
    const trigger = wrapper?.querySelector('.status-select-trigger');
    if (!dropdown || !trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const dropdownHeight = dropdown.offsetHeight || dropdown.scrollHeight || 260;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const shouldOpenUp = spaceBelow < dropdownHeight + 8 && spaceAbove > spaceBelow;

    wrapper.classList.toggle('opens-up', shouldOpenUp);
  }

  closePortal() {
    document.querySelectorAll('.status-dropdown-portal').forEach(p => p.remove());
    document.querySelectorAll('.status-select-wrapper.open')
      .forEach(w => w.classList.remove('open', 'opens-up'));
  }

  openPortal(wrapper) {
    const sourceDropdown = wrapper?.querySelector('.status-dropdown');
    const trigger = wrapper?.querySelector('.status-select-trigger');
    if (!sourceDropdown || !trigger) return null;

    const portal = sourceDropdown.cloneNode(true);
    portal.classList.remove('status-dropdown');
    portal.classList.add('status-dropdown-portal');
    portal.dataset.kooperationId = wrapper.dataset.kooperationId || '';
    portal._sourceWrapper = wrapper;

    document.body.appendChild(portal);
    this._positionPortal(trigger, portal);
    return portal;
  }

  _positionPortal(trigger, portal) {
    if (!trigger || !portal) return;
    const triggerRect = trigger.getBoundingClientRect();
    const portalHeight = portal.offsetHeight || portal.scrollHeight || 260;
    const portalWidth = portal.offsetWidth || 180;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const openUp = spaceBelow < portalHeight + 8 && spaceAbove > spaceBelow;

    if (openUp) {
      portal.style.top = Math.max(8, triggerRect.top - portalHeight - 4) + 'px';
    } else {
      portal.style.top = (triggerRect.bottom + 4) + 'px';
    }
    const left = Math.min(triggerRect.left, viewportWidth - portalWidth - 8);
    portal.style.left = Math.max(8, left) + 'px';
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
