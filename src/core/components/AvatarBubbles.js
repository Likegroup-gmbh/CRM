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
    
    // Immer nur einen Buchstaben anzeigen
    if (type === 'person') {
      // Personen: Erster Buchstabe des Vornamens
      const parts = cleanName.split(/\s+/).filter(Boolean);
      return parts[0][0].toUpperCase();
    } else {
      // Organisationen: Erster Buchstabe des ersten Wortes
      const words = cleanName.split(/\s+/).filter(Boolean);
      return words[0][0].toUpperCase();
    }
    
    return cleanName[0].toUpperCase();
  }

  /**
   * Rendert HTML für überlappende Avatar-Bubbles
   * @param {Array} items - Array von Objekten: {name, type, id?, entityType?, logo_url?, profile_image_url?}
   *   - name: Anzeigename
   *   - type: 'person' oder 'org'
   *   - id: Optional, ID für Klickbarkeit
   *   - entityType: Optional, 'unternehmen', 'marke', 'ansprechpartner', 'mitarbeiter' für Routing
   *   - logo_url: Optional, Logo-URL für Organisationen
   *   - profile_image_url: Optional, Profilbild-URL für Mitarbeiter (hat Priorität über logo_url)
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
        
        // Unterstütze beide: logo_url (für Orgs) UND profile_image_url (für Mitarbeiter)
        const imageUrl = item.profile_image_url || item.logo_url;
        const hasImage = imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0;
        const imageClass = hasImage ? 'avatar-bubble--with-logo' : '';
        
        // Debug-Logging
        if (hasImage) {
          console.log('🎨 Avatar Bubble:', item.name, '| type:', item.type, '| hasImage:', hasImage, '| imageUrl:', imageUrl);
        }
        
        // Sanitize name für title attribute
        const safeName = window.validatorSystem?.sanitizeHtml?.(item.name) || item.name;
        
        // Data-Attribute für Click-Handler
        const dataAttrs = isClickable 
          ? `data-entity="${item.entityType}" data-id="${item.id}"` 
          : '';
        
        // Content: Profilbild/Logo oder Initialen
        const content = hasImage 
          ? `<img src="${imageUrl}" alt="${safeName}" class="avatar-bubble-logo" />` 
          : initials;
        
        return `<div class="avatar-bubble ${clickableClass} ${imageClass}" 
                     title="${safeName}" 
                     ${dataAttrs}>
          ${content}
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

