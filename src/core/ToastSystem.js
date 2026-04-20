// ToastSystem.js (ES6-Modul)
// Globales Toast-Notification-System für User-Feedback

export class ToastSystem {
  constructor() {
    this.toasts = [];
    this.container = null;
    this.maxToasts = 5;
    this.init();
  }

  init() {
    // Erstelle Container für Toasts (einmalig)
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.id = 'global-toast-container';
      document.body.appendChild(this.container);
    }
  }

  // Haupt-Methode zum Anzeigen von Toasts
  show(message, type = 'info', duration = 3000) {
    const toast = this.createToast(message, type, duration);
    this.addToast(toast);
    return toast.id;
  }

  // Convenience-Methoden
  success(message, duration = 2000) {
    return this.show(message, 'success', duration);
  }

  error(message, duration = 4000) {
    return this.show(message, 'error', duration);
  }

  info(message, duration = 3000) {
    return this.show(message, 'info', duration);
  }

  warning(message, duration = 3500) {
    return this.show(message, 'warning', duration);
  }

  // Toast erstellen
  createToast(message, type, duration) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;
    toastEl.id = id;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'polite');

    // Icon je nach Typ
    const icon = this.getIcon(type);
    
    toastEl.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-message">${this.escapeHtml(message)}</div>
      <button class="toast-close" aria-label="Schließen">×</button>
    `;

    // Close-Button Event
    const closeBtn = toastEl.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this.removeToast(id));

    return {
      id,
      element: toastEl,
      duration,
      timer: null
    };
  }

  // Toast zum Container hinzufügen
  addToast(toast) {
    // Limit: Älteste entfernen wenn zu viele
    if (this.toasts.length >= this.maxToasts) {
      const oldest = this.toasts[0];
      this.removeToast(oldest.id);
    }

    this.toasts.push(toast);
    this.container.appendChild(toast.element);

    // Animation: Fade-in
    requestAnimationFrame(() => {
      toast.element.classList.add('toast-show');
    });

    // Auto-Remove nach Duration
    if (toast.duration > 0) {
      toast.timer = setTimeout(() => {
        this.removeToast(toast.id);
      }, toast.duration);
    }
  }

  // Toast entfernen
  removeToast(id) {
    const toast = this.toasts.find(t => t.id === id);
    if (!toast || toast._removing) return;
    toast._removing = true;

    if (toast.timer) {
      clearTimeout(toast.timer);
    }

    toast.element.classList.remove('toast-show');
    toast.element.classList.add('toast-hide');

    setTimeout(() => {
      if (toast.element.parentNode) {
        toast.element.parentNode.removeChild(toast.element);
      }
      const idx = this.toasts.findIndex(t => t.id === id);
      if (idx !== -1) this.toasts.splice(idx, 1);
    }, 300);
  }

  // Alle Toasts entfernen
  clearAll() {
    this.toasts.forEach(toast => {
      if (toast.timer) clearTimeout(toast.timer);
      if (toast.element.parentNode) {
        toast.element.parentNode.removeChild(toast.element);
      }
    });
    this.toasts = [];
  }

  // Icon je nach Toast-Typ
  getIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  }

  // HTML escapen für XSS-Schutz
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Singleton-Instanz exportieren
export const toastSystem = new ToastSystem();

// Globale Verfügbarkeit
if (typeof window !== 'undefined') {
  window.toastSystem = toastSystem;
}

