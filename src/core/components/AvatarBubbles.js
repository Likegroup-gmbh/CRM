// AvatarBubbles.js
// Wiederverwendbare Komponente für überlappende Avatar-Bubbles mit Initialen

export class AvatarBubbles {
  static _abortController = null;

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
    }
    // Organisationen: Erster Buchstabe des ersten Wortes
    const words = cleanName.split(/\s+/).filter(Boolean);
    return words[0][0].toUpperCase();
  }

  /**
   * Rendert HTML für überlappende Avatar-Bubbles
   * @param {Array} items - Array von Objekten: {name, type, id?, entityType?, logo_url?, profile_image_url?, label?}
   *   - name: Anzeigename (wird auch für Tooltip verwendet)
   *   - type: 'person' oder 'org'
   *   - id: Optional, ID für Klickbarkeit
   *   - entityType: Optional, 'unternehmen', 'marke', 'ansprechpartner', 'mitarbeiter' für Routing
   *   - logo_url: Optional, Logo-URL für Organisationen
   *   - profile_image_url: Optional, Profilbild-URL für Mitarbeiter (hat Priorität über logo_url)
   *   - label: Optional, alternativer Text für das Label (z.B. internes_kuerzel statt firmenname)
   * @param {Object} config - Konfiguration {maxVisible?: number, showLabel?: boolean}
   * @returns {string} HTML-String
   */
  static renderBubbles(items, config = {}) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return '-';
    }

    const validItems = items.filter(item => item && item.name);
    const maxVisible = config.maxVisible || 3; // Standard: max 3 Bubbles anzeigen
    const showLabel = config.showLabel || false;
    const visibleItems = validItems.slice(0, maxVisible);
    const remainingCount = validItems.length - maxVisible;

    const bubblesHtml = visibleItems
      .map(item => {
        const initials = this.getInitials(item.name, item.type || 'org');
        const isClickable = item.id && item.entityType;
        const clickableClass = isClickable ? 'avatar-bubble--clickable' : '';
        
        // Unterstütze beide: logo_url (für Orgs) UND profile_image_url (für Mitarbeiter)
        // Bevorzuge thumb_url wenn verfügbar (128px WebP, deutlich kleiner)
        const imageUrl = item.thumb_url || item.profile_image_url || item.logo_url;
        const hasImage = imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0;
        const imageClass = hasImage ? 'avatar-bubble--with-logo' : '';
        
        // Sanitize name für title attribute
        const safeName = window.validatorSystem?.sanitizeHtml?.(item.name) || item.name;
        
        // Data-Attribute für Click-Handler
        const dataAttrs = isClickable 
          ? `data-entity="${item.entityType}" data-id="${item.id}"` 
          : '';
        
        // Content: Profilbild/Logo oder Initialen
        const content = hasImage 
          ? `<img src="${imageUrl}" alt="${safeName}" class="avatar-bubble-logo" width="32" height="32" loading="lazy" decoding="async" fetchpriority="low" />` 
          : initials;
        
        // Label-Text (item.label hat Priorität, Fallback auf item.name)
        const labelText = showLabel 
          ? `<span class="avatar-bubble-label ${isClickable ? 'avatar-bubble-label--clickable' : ''}" ${dataAttrs}>${window.validatorSystem?.sanitizeHtml?.(item.label || item.name) || item.label || item.name}</span>` 
          : '';
        
        return `<div class="avatar-bubble-item ${showLabel ? 'avatar-bubble-item--labeled' : ''}" ${dataAttrs}>
          <div class="avatar-bubble ${clickableClass} ${imageClass}" 
                       ${showLabel ? '' : `title="${safeName}"`} 
                       ${dataAttrs}>
            ${content}
          </div>${labelText}
        </div>`;
      })
      .join('');

    // "+X mehr" Badge wenn es mehr Items gibt
    const moreHtml = remainingCount > 0 
      ? `<div class="avatar-bubble avatar-bubble--more" title="${validItems.slice(maxVisible).map(i => i.name).join(', ')}">+${remainingCount}</div>`
      : '';

    const labeledClass = showLabel ? 'avatar-bubbles--labeled' : '';
    return `<div class="avatar-bubbles ${labeledClass}">${bubblesHtml}${moreHtml}</div>`;
  }

  /**
   * Bindet Click-Events für klickbare Avatar-Bubbles
   * Sollte nach dem Rendern aufgerufen werden
   */
  static bindClickEvents() {
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();

    document.addEventListener('click', (e) => {
      const bubble = e.target.closest('.avatar-bubble--clickable') || e.target.closest('.avatar-bubble-label--clickable');
      if (!bubble) return;

      const entityType = bubble.dataset.entity;
      const id = bubble.dataset.id;

      if (entityType && id && window.navigateTo) {
        e.preventDefault();
        e.stopPropagation();
        window.navigateTo(`/${entityType}/${id}`);
      }
    }, { capture: true, signal: this._abortController.signal });
  }

  static destroy() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
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

