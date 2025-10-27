// AvatarBubbles.js
// Wiederverwendbare Komponente für überlappende Avatar-Bubbles mit Initialen

export class AvatarBubbles {
  /**
   * Extrahiert Initialen aus einem Namen
   * @param {string} name - Der Name (z.B. "Oliver Mackeldanz" oder "Green by Default")
   * @param {string} type - 'person' oder 'org'
   * @returns {string} Initialen (z.B. "OM" oder "GB")
   */
  static getInitials(name, type = 'org') {
    if (!name || typeof name !== 'string') return '?';
    
    const cleanName = name.trim();
    if (!cleanName) return '?';
    
    if (type === 'person') {
      // Personen: 2 Buchstaben (Vorname + Nachname)
      const parts = cleanName.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        // Nimm ersten Buchstaben vom ersten und letzten Teil
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      } else if (parts.length === 1) {
        // Nur ein Name: Nimm erste 2 Buchstaben
        return parts[0].substring(0, 2).toUpperCase();
      }
    } else {
      // Organisationen: 1-2 Buchstaben, erster Buchstabe jedes Wortes (max 2)
      const words = cleanName.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
      } else if (words.length === 1) {
        // Nur ein Wort: Nimm ersten Buchstaben
        return words[0][0].toUpperCase();
      }
    }
    
    return cleanName[0].toUpperCase();
  }

  /**
   * Rendert HTML für überlappende Avatar-Bubbles
   * @param {Array} items - Array von Objekten: {name, type, id?, entityType?}
   *   - name: Anzeigename
   *   - type: 'person' oder 'org'
   *   - id: Optional, ID für Klickbarkeit
   *   - entityType: Optional, 'unternehmen', 'marke', 'ansprechpartner' für Routing
   * @param {Object} config - Konfiguration {size?: number}
   * @returns {string} HTML-String
   */
  static renderBubbles(items, config = {}) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return '-';
    }

    const bubblesHtml = items
      .filter(item => item && item.name) // Nur gültige Items
      .map(item => {
        const initials = this.getInitials(item.name, item.type || 'org');
        const isClickable = item.id && item.entityType;
        const clickableClass = isClickable ? 'avatar-bubble--clickable' : '';
        
        // Sanitize name für title attribute
        const safeName = window.validatorSystem?.sanitizeHtml?.(item.name) || item.name;
        
        // Data-Attribute für Click-Handler
        const dataAttrs = isClickable 
          ? `data-entity="${item.entityType}" data-id="${item.id}"` 
          : '';
        
        return `<div class="avatar-bubble ${clickableClass}" 
                     title="${safeName}" 
                     ${dataAttrs}>
          ${initials}
        </div>`;
      })
      .join('');

    return `<div class="avatar-bubbles">${bubblesHtml}</div>`;
  }

  /**
   * Bindet Click-Events für klickbare Avatar-Bubbles
   * Sollte nach dem Rendern aufgerufen werden
   */
  static bindClickEvents() {
    // Verwende Event-Delegation auf document für dynamisch geladene Bubbles
    document.addEventListener('click', (e) => {
      const bubble = e.target.closest('.avatar-bubble--clickable');
      if (!bubble) return;

      const entityType = bubble.dataset.entity;
      const id = bubble.dataset.id;

      console.log('Avatar bubble clicked:', { entityType, id }); // Debug

      if (entityType && id && window.navigateTo) {
        e.preventDefault();
        e.stopPropagation();
        window.navigateTo(`/${entityType}/${id}`);
      }
    }, { capture: true }); // Capture-Phase für bessere Event-Priorität
  }
}

// Export als Singleton
export const avatarBubbles = AvatarBubbles;

// Verhindere doppelte Event-Bindung
let eventsInitialized = false;

// Auto-bind click events beim Laden
if (typeof document !== 'undefined' && !eventsInitialized) {
  eventsInitialized = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AvatarBubbles.bindClickEvents());
  } else {
    AvatarBubbles.bindClickEvents();
  }
}

