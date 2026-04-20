// KampagneListUtils.js
// Shared Utilities für KampagneList: Debug, Debounce

// Debug-Flag für Logging (Production: false)
export const DEBUG_KAMPAGNE = false;

// Helper für bedingte Debug-Logs
export const debugLog = (...args) => DEBUG_KAMPAGNE && console.log(...args);

// Einfache Debounce-Funktion für Filter-Änderungen
export const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(null, args), delay);
  };
};

/**
 * Drag-to-Scroll für horizontales Scrollen der Tabelle.
 * Gibt ein Cleanup-Objekt zurück mit { destroy() }.
 */
export function bindDragToScroll(state) {
  const container = document.querySelector('.data-table-container');
  if (!container) return;

  state.dragScrollContainer = container;
  container.classList.add('drag-scroll-enabled');

  if (state._dragMouseDown) {
    container.removeEventListener('mousedown', state._dragMouseDown);
    container.removeEventListener('mousemove', state._dragMouseMove);
    container.removeEventListener('mouseup', state._dragMouseUp);
    container.removeEventListener('mouseleave', state._dragMouseUp);
  }

  state._dragMouseDown = (e) => {
    if (
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'BUTTON' ||
      e.target.classList.contains('status-badge') ||
      e.target.closest('a') ||
      e.target.closest('.actions-dropdown-container')
    ) {
      return;
    }

    state.isDragging = true;
    state.startX = e.pageX - container.offsetLeft;
    state.scrollLeft = container.scrollLeft;

    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
    e.preventDefault();
  };

  state._dragMouseMove = (e) => {
    if (!state.isDragging) return;
    e.preventDefault();

    const x = e.pageX - container.offsetLeft;
    const walk = (x - state.startX) * 1.5;
    container.scrollLeft = state.scrollLeft - walk;
  };

  state._dragMouseUp = () => {
    if (state.isDragging) {
      state.isDragging = false;
      container.style.cursor = 'grab';
      container.style.userSelect = '';
    }
  };

  container.addEventListener('mousedown', state._dragMouseDown);
  container.addEventListener('mousemove', state._dragMouseMove);
  container.addEventListener('mouseup', state._dragMouseUp);
  container.addEventListener('mouseleave', state._dragMouseUp);
}

/**
 * Cleanup für Drag-to-Scroll.
 */
export function destroyDragToScroll(state) {
  if (state.dragScrollContainer) {
    state.dragScrollContainer.removeEventListener('mousedown', state._dragMouseDown);
    state.dragScrollContainer.removeEventListener('mousemove', state._dragMouseMove);
    state.dragScrollContainer.removeEventListener('mouseup', state._dragMouseUp);
    state.dragScrollContainer.removeEventListener('mouseleave', state._dragMouseUp);
    state.dragScrollContainer.classList.remove('drag-scroll-enabled');
    state.dragScrollContainer.style.cursor = '';
    state.dragScrollContainer.style.userSelect = '';
    state.isDragging = false;
    state.dragScrollContainer = null;
  }
}
