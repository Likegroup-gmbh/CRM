// VideoEventHandler.js
// Event-Binding fuer VideoList: View-Toggle, Folder-Clicks, Navigation, Drag-to-Scroll

const TABLE_ROUTES = {
  video: (id) => `/video/${id}`,
  kooperation: (id) => `/kooperation/${id}`,
  kampagne: (id) => `/kampagne/${id}`,
  creator: (id) => `/creator/${id}`
};

export class VideoEventHandler {
  constructor() {
    this._cleanups = new Set();
    this._dragState = { isDragging: false, startX: 0, scrollLeft: 0, container: null };
    this._dragHandlers = null;
  }

  /**
   * Bindet alle View-Events. callbacks: {
   *   onViewModeChange(listViewMode),
   *   onBackToUnternehmen(),
   *   onBackToKampagnen(),
   *   onUnternehmenSelect(id, name),
   *   onKampagneSelect(id, name)
   * }
   */
  bindEvents(callbacks) {
    this.clearEvents();

    this._bindViewToggle(callbacks.onViewModeChange);
    this._bindBackButtons(callbacks.onBackToUnternehmen, callbacks.onBackToKampagnen);
    this._bindUnternehmenClicks(callbacks.onUnternehmenSelect);
    this._bindKampagnenClicks(callbacks.onKampagneSelect);
    this._bindTableLinks();
  }

  clearEvents() {
    this._cleanups.forEach(cleanup => cleanup());
    this._cleanups.clear();
  }

  // ============================================
  // VIEW-TOGGLE (Grid / Liste)
  // ============================================

  _bindViewToggle(onChange) {
    const btnList = document.getElementById('btn-view-list');
    const btnGrid = document.getElementById('btn-view-grid');

    const makeHandler = (mode) => (e) => {
      e.preventDefault();
      onChange?.(mode);
    };

    if (btnList) this._addListener(btnList, 'click', makeHandler('list'));
    if (btnGrid) this._addListener(btnGrid, 'click', makeHandler('grid'));
  }

  _bindBackButtons(onBackUnt, onBackKamp) {
    const btnBackUnt = document.getElementById('btn-back-to-unternehmen');
    if (btnBackUnt && onBackUnt) {
      this._addListener(btnBackUnt, 'click', (e) => { e.preventDefault(); onBackUnt(); });
    }

    const btnBackKamp = document.getElementById('btn-back-to-kampagnen');
    if (btnBackKamp && onBackKamp) {
      this._addListener(btnBackKamp, 'click', (e) => { e.preventDefault(); onBackKamp(); });
    }
  }

  // ============================================
  // FOLDER-CLICKS (Level 1 + 2)
  // ============================================

  _bindUnternehmenClicks(onSelect) {
    if (!onSelect) return;

    const grid = document.getElementById('folders-grid');
    if (grid) {
      this._addListener(grid, 'click', (e) => {
        const card = e.target.closest('.folder-card');
        if (card) onSelect(card.dataset.unternehmenId, card.dataset.unternehmenName);
      });
    }

    document.querySelectorAll('.unternehmen-row').forEach(row => {
      this._addListener(row, 'click', (e) => {
        if (e.target.closest('.unternehmen-link')) e.preventDefault();
        const id = row.dataset.unternehmenId;
        const name = row.dataset.unternehmenName;
        if (id) onSelect(id, name);
      });
    });
  }

  _bindKampagnenClicks(onSelect) {
    if (!onSelect) return;

    const grid = document.getElementById('kampagnen-grid');
    if (grid) {
      this._addListener(grid, 'click', (e) => {
        const card = e.target.closest('.folder-card');
        if (card) onSelect(card.dataset.kampagneId, card.dataset.kampagneName);
      });
    }

    document.querySelectorAll('.kampagne-row').forEach(row => {
      this._addListener(row, 'click', (e) => {
        if (e.target.closest('.kampagne-folder-link')) e.preventDefault();
        const id = row.dataset.kampagneId;
        const name = row.dataset.kampagneName;
        if (id) onSelect(id, name);
      });
    });
  }

  // ============================================
  // TABLE-LINKS (Navigation zu Detail-Seiten)
  // ============================================

  _bindTableLinks() {
    const handler = (e) => {
      const link = e.target.closest('.table-link[data-table]');
      if (!link) return;
      e.preventDefault();
      const table = link.dataset.table;
      const id = link.dataset.id;
      if (!id) return;
      const routeFn = TABLE_ROUTES[table];
      if (routeFn) window.navigateTo(routeFn(id));
    };
    document.addEventListener('click', handler);
    this._cleanups.add(() => document.removeEventListener('click', handler));
  }

  // ============================================
  // DRAG-TO-SCROLL
  // ============================================

  bindDragToScroll() {
    const container = document.querySelector('.data-table-container');
    if (!container) return;

    this._unbindDragToScroll();
    this._dragState.container = container;

    const onMouseDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' ||
          e.target.classList.contains('status-badge') || e.target.closest('a')) return;
      this._dragState.isDragging = true;
      this._dragState.startX = e.pageX - container.offsetLeft;
      this._dragState.scrollLeft = container.scrollLeft;
      container.classList.add('is-dragging');
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!this._dragState.isDragging) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      container.scrollLeft = this._dragState.scrollLeft - (x - this._dragState.startX) * 1.5;
    };

    const onMouseUp = () => {
      if (this._dragState.isDragging) {
        this._dragState.isDragging = false;
        container.classList.remove('is-dragging');
      }
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);

    this._dragHandlers = { onMouseDown, onMouseMove, onMouseUp };
  }

  _unbindDragToScroll() {
    const c = this._dragState.container;
    const h = this._dragHandlers;
    if (!c || !h) return;
    c.removeEventListener('mousedown', h.onMouseDown);
    c.removeEventListener('mousemove', h.onMouseMove);
    c.removeEventListener('mouseup', h.onMouseUp);
    c.removeEventListener('mouseleave', h.onMouseUp);
    this._dragHandlers = null;
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  destroy() {
    this.clearEvents();
    this._unbindDragToScroll();
    if (this._dragState.container) {
      this._dragState.container.classList.remove('is-dragging');
    }
    this._dragState = { isDragging: false, startX: 0, scrollLeft: 0, container: null };
  }

  // ============================================
  // INTERNAL HELPER
  // ============================================

  _addListener(element, event, handler) {
    element.addEventListener(event, handler);
    this._cleanups.add(() => element.removeEventListener(event, handler));
  }
}

export default VideoEventHandler;
