/**
 * TableAnimationHelper.js
 * Zentraler Helper für Tabellen-Animationen
 * Einmal ändern = überall geändert
 */

export const TableAnimationHelper = {
  // Konfigurations-Optionen (zentral anpassbar)
  config: {
    fadeOutDuration: 200,  // ms - Dauer des Ausblendens
    fadeInDuration: 200,   // ms - Dauer des Einblendens
    fadeOutClass: 'table-fade-out',
    fadeInClass: 'table-fade-in'
  },

  /**
   * Fade-out Animation starten
   * @param {HTMLElement} tbody - Das tbody Element
   * @returns {Promise} - Resolved nach Fade-out
   */
  async fadeOut(tbody) {
    if (!tbody) return;
    tbody.classList.add(this.config.fadeOutClass);
    return new Promise(resolve => setTimeout(resolve, this.config.fadeOutDuration));
  },

  /**
   * Fade-in Animation starten
   * @param {HTMLElement} tbody - Das tbody Element
   */
  fadeIn(tbody) {
    if (!tbody) return;
    tbody.classList.remove(this.config.fadeOutClass);
    tbody.classList.add(this.config.fadeInClass);
    setTimeout(() => tbody.classList.remove(this.config.fadeInClass), this.config.fadeInDuration);
  },

  /**
   * Kompletter Update-Zyklus mit Animation
   * @param {HTMLElement} tbody - Das tbody Element
   * @param {Function} updateFn - Funktion die den Content aktualisiert (kann async sein)
   */
  async animatedUpdate(tbody, updateFn) {
    if (!tbody) return;
    await this.fadeOut(tbody);
    await updateFn();
    this.fadeIn(tbody);
  }
};

// Globaler Zugriff für Legacy-Code
window.TableAnimationHelper = TableAnimationHelper;








