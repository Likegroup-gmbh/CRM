// calendarGridDnd.js
// Drag & Drop am CalendarGrid: Karten zwischen Tagen verschieben. Listener per Delegation am Container,
// damit ein Neu-Rendern nichts neu binden muss. Drops von außen (z. B. eine Liste neben dem Kalender)
// zählen auch, solange sie die ID über `setDragId` mitgeben.

export const CALENDAR_DRAG_TYPE = 'application/x-crm-calendar-event';

export function setDragId(e, id) {
  if (!e.dataTransfer) return;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData(CALENDAR_DRAG_TYPE, id);
  // Firefox startet einen Drag nur mit text/plain
  e.dataTransfer.setData('text/plain', id);
}

/** Während `dragover` sind die Daten gesperrt, nur die Typen sind lesbar. */
export function hasDragId(e) {
  return [...(e.dataTransfer?.types || [])].includes(CALENDAR_DRAG_TYPE);
}

export function getDragId(e) {
  return e.dataTransfer?.getData(CALENDAR_DRAG_TYPE) || null;
}

const EVENT_SEL = '[data-cal-event][draggable="true"]';
const ZONE_SEL = '[data-cal-drop]';

export function installCalendarDnd(proto) {
  Object.assign(proto, {
    _bindDnd() {
      const handlers = {
        dragstart: (e) => this._onDragStart(e),
        dragend: (e) => this._onDragEnd(e),
        dragover: (e) => this._onDragOver(e),
        dragleave: (e) => this._onDragLeave(e),
        drop: (e) => { void this._onDrop(e); }
      };
      Object.entries(handlers).forEach(([type, fn]) => this.container.addEventListener(type, fn));
      this._cleanups.push(() => {
        Object.entries(handlers).forEach(([type, fn]) => this.container.removeEventListener(type, fn));
      });
    },

    _onDragStart(e) {
      const el = e.target.closest?.(EVENT_SEL);
      if (!el || !this.opts.onMove) return;
      setDragId(e, el.dataset.calEvent);
      el.classList.add('dragging');
    },

    _onDragEnd(e) {
      e.target.closest?.(EVENT_SEL)?.classList.remove('dragging');
      this._clearDragOver();
    },

    _onDragOver(e) {
      const zone = e.target.closest?.(ZONE_SEL);
      if (!zone || !this.opts.onMove || !hasDragId(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!zone.classList.contains('drag-over')) {
        this._clearDragOver();
        zone.classList.add('drag-over');
      }
    },

    _onDragLeave(e) {
      const zone = e.target.closest?.(ZONE_SEL);
      if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    },

    async _onDrop(e) {
      const zone = e.target.closest?.(ZONE_SEL);
      if (!zone || !this.opts.onMove) return;
      e.preventDefault();
      this._clearDragOver();
      const id = getDragId(e);
      const iso = zone.dataset.calDrop;
      if (!id || !iso) return;
      // Auf denselben Tag gezogen: nichts zu tun
      if (this._eventById.get(id)?.iso === iso) return;
      await this.opts.onMove(id, iso);
    },

    _clearDragOver() {
      this.container?.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    }
  });
}
