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
    
    const hasOverlay = tbody.classList.contains('table-loading-overlay');
    const isInitialLoad = tbody.querySelector('.loading') !== null;
    
    if (!hasOverlay && !isInitialLoad) {
      await this.fadeOut(tbody);
    }
    
    await updateFn();
    
    tbody.classList.remove('table-loading-overlay');
    
    this.fadeIn(tbody);
  },

  /**
   * Zeilen animiert anhängen (mit staggered effect)
   * @param {HTMLElement} tbody - Das tbody Element
   * @param {string} rowsHtml - HTML-String mit den neuen Zeilen
   * @returns {Promise} - Resolved nach Animation
   */
  async appendRows(tbody, rowsHtml) {
    if (!tbody || !rowsHtml) return;
    
    const temp = document.createElement('tbody');
    temp.innerHTML = rowsHtml;
    const newRows = Array.from(temp.children);
    
    if (newRows.length === 0) return;
    
    // Zeilen unsichtbar anfügen
    for (const row of newRows) {
      row.style.opacity = '0';
      row.style.transform = 'translateY(-10px)';
      tbody.appendChild(row);
    }
    
    // Staggered fade-in Animation
    for (let i = 0; i < newRows.length; i++) {
      setTimeout(() => {
        newRows[i].style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        newRows[i].style.opacity = '1';
        newRows[i].style.transform = 'translateY(0)';
      }, i * 40);
    }
    
    // Warten bis Animation fertig
    return new Promise(resolve => setTimeout(resolve, newRows.length * 40 + 200));
  },

  /**
   * Zeilen animiert entfernen (von unten nach oben)
   * @param {HTMLElement} tbody - Das tbody Element
   * @param {number} count - Anzahl der zu entfernenden Zeilen
   * @returns {Promise} - Resolved nach Animation
   */
  async removeRows(tbody, count) {
    if (!tbody || count <= 0) return;
    
    const rows = Array.from(tbody.querySelectorAll('tr:not(.no-data)'));
    const toRemove = rows.slice(-count); // Letzte N Zeilen
    
    if (toRemove.length === 0) return;
    
    // Staggered fade-out Animation (von unten nach oben)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      setTimeout(() => {
        toRemove[i].style.transition = 'opacity 0.15s ease, transform 0.15s ease';
        toRemove[i].style.opacity = '0';
        toRemove[i].style.transform = 'translateY(-10px)';
      }, (toRemove.length - 1 - i) * 30);
    }
    
    // Warten bis Animation fertig, dann Zeilen entfernen
    await new Promise(resolve => setTimeout(resolve, toRemove.length * 30 + 150));
    toRemove.forEach(row => row.remove());
  },

  /**
   * Zeigt Loading-Overlay (dimmt tbody während Daten laden)
   * Die alten Daten bleiben sichtbar - kein Content-Replacement!
   * @param {HTMLElement} tbody - Das tbody Element
   */
  showLoadingOverlay(tbody) {
    if (!tbody) return;
    tbody.classList.add('table-loading-overlay');
  },

  /**
   * Versteckt Loading-Overlay
   * @param {HTMLElement} tbody - Das tbody Element
   */
  hideLoadingOverlay(tbody) {
    if (!tbody) return;
    tbody.classList.remove('table-loading-overlay');
  }
};

// Globaler Zugriff für Legacy-Code
window.TableAnimationHelper = TableAnimationHelper;








