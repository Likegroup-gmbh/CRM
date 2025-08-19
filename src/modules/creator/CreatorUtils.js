// CreatorUtils.js (ES6-Modul)
// Creator-spezifische Hilfsfunktionen

import { validatorSystem } from '../../core/ValidatorSystem.js';

export class CreatorUtils {
  constructor() {
    // Importiere ValidatorSystem für HTML-Sanitization
    this.validator = validatorSystem;
  }

  // HTML sanitize für Creator-Daten
  sanitizeHtml(html) {
    return this.validator.sanitizeHtml(html);
  }

  // Creator-Namen formatieren
  formatCreatorName(vorname, nachname) {
    if (!vorname && !nachname) {
      return 'Unbekannter Creator';
    }
    
    const firstName = this.sanitizeHtml(vorname || '');
    const lastName = this.sanitizeHtml(nachname || '');
    
    return `${firstName} ${lastName}`.trim();
  }

  // Follower-Zahl formatieren
  formatFollowerCount(count) {
    if (!count || isNaN(count)) {
      return '-';
    }
    
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    } else {
      return count.toString();
    }
  }

  // Budget formatieren
  formatBudget(budget) {
    if (!budget || isNaN(budget)) {
      return '-';
    }
    
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(budget);
  }

  // Adresse formatieren
  formatAddress(creator) {
    const parts = [];
    
    if (creator.lieferadresse_strasse) {
      parts.push(this.sanitizeHtml(creator.lieferadresse_strasse));
    }
    
    if (creator.lieferadresse_hausnummer) {
      parts.push(this.sanitizeHtml(creator.lieferadresse_hausnummer));
    }
    
    if (creator.lieferadresse_plz) {
      parts.push(this.sanitizeHtml(creator.lieferadresse_plz));
    }
    
    if (creator.lieferadresse_stadt) {
      parts.push(this.sanitizeHtml(creator.lieferadresse_stadt));
    }
    
    if (creator.lieferadresse_land) {
      parts.push(this.sanitizeHtml(creator.lieferadresse_land));
    }
    
    return parts.length > 0 ? parts.join(', ') : '-';
  }

  // Social Media Links formatieren
  formatSocialMedia(creator) {
    const links = [];
    
    if (creator.instagram) {
      links.push(`<a href="https://instagram.com/${creator.instagram.replace('@', '')}" target="_blank" rel="noopener noreferrer">${this.sanitizeHtml(creator.instagram)}</a>`);
    }
    
    if (creator.tiktok) {
      links.push(`<a href="https://tiktok.com/@${creator.tiktok.replace('@', '')}" target="_blank" rel="noopener noreferrer">${this.sanitizeHtml(creator.tiktok)}</a>`);
    }
    
    return links.length > 0 ? links.join('<br>') : '-';
  }

  // Tags formatieren
  formatTags(tags, maxTags = 3) {
    if (!tags || !Array.isArray(tags)) {
      return '-';
    }
    
    const sanitizedTags = tags
      .filter(tag => tag && tag.trim())
      .map(tag => `<span class="tag">${this.sanitizeHtml(tag.trim())}</span>`)
      .slice(0, maxTags);
    
    if (sanitizedTags.length === 0) {
      return '-';
    }
    
    let result = sanitizedTags.join('');
    
    if (tags.length > maxTags) {
      result += `<span class="tag-more">+${tags.length - maxTags}</span>`;
    }
    
    return result;
  }

  // Creator-Typ formatieren
  formatCreatorType(type) {
    if (!type) {
      return '-';
    }
    
    const typeMap = {
      'Influencer': 'Influencer',
      'Content Creator': 'Content Creator',
      'UGC Creator': 'UGC Creator',
      'Micro Influencer': 'Micro Influencer',
      'Macro Influencer': 'Macro Influencer',
      'Celebrity': 'Celebrity',
      'Expert': 'Expert',
      'Lifestyle': 'Lifestyle'
    };
    
    return typeMap[type] || this.sanitizeHtml(type);
  }

  // Kontakt-Informationen formatieren
  formatContact(creator) {
    const contact = [];
    
    if (creator.mail) {
      contact.push(`<a href="mailto:${this.sanitizeHtml(creator.mail)}">${this.sanitizeHtml(creator.mail)}</a>`);
    }
    
    if (creator.telefonnummer) {
      contact.push(`<a href="tel:${this.sanitizeHtml(creator.telefonnummer)}">${this.sanitizeHtml(creator.telefonnummer)}</a>`);
    }
    
    if (creator.portfolio_link) {
      contact.push(`<a href="${this.sanitizeHtml(creator.portfolio_link)}" target="_blank" rel="noopener noreferrer">Portfolio</a>`);
    }
    
    return contact.length > 0 ? contact.join('<br>') : '-';
  }

  // Creator-Status bestimmen
  getCreatorStatus(creator) {
    const hasInstagram = creator.instagram && creator.instagram_follower > 0;
    const hasTiktok = creator.tiktok && creator.tiktok_follower > 0;
    const hasContact = creator.mail || creator.telefonnummer;
    const hasAddress = creator.lieferadresse_stadt;
    
    if (hasInstagram && hasTiktok && hasContact && hasAddress) {
      return 'complete';
    } else if (hasInstagram || hasTiktok) {
      return 'partial';
    } else {
      return 'incomplete';
    }
  }

  // Status-Badge generieren
  getStatusBadge(status) {
    const badges = {
      'complete': '<span class="badge badge-success">Vollständig</span>',
      'partial': '<span class="badge badge-warning">Teilweise</span>',
      'incomplete': '<span class="badge badge-error">Unvollständig</span>'
    };
    
    return badges[status] || badges['incomplete'];
  }

  // Creator validieren
  validateCreator(creator) {
    const errors = [];
    
    if (!creator.vorname && !creator.nachname) {
      errors.push('Name ist erforderlich');
    }
    
    if (creator.mail && !this.validator.validateEmail(creator.mail)) {
      errors.push('Ungültige Email-Adresse');
    }
    
    if (creator.telefonnummer && !this.validator.validatePhone(creator.telefonnummer)) {
      errors.push('Ungültige Telefonnummer');
    }
    
    if (creator.portfolio_link && !this.validator.validateUrl(creator.portfolio_link)) {
      errors.push('Ungültige Portfolio-URL');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Exportiere Instanz
export const creatorUtils = new CreatorUtils();

// Globale Verfügbarkeit für Kompatibilität
if (typeof window !== 'undefined') {
  window.CreatorUtils = creatorUtils;
}
