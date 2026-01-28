// LinkedInValidation.test.js
// Unit Tests für die LinkedIn-URL Validierung (XSS-Schutz)

import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Standalone renderLinkedInLink Funktion für Tests
 * (Extrahiert aus AnsprechpartnerDetail.js und AnsprechpartnerList.js)
 */
function renderLinkedInLink(url, sanitize = (x) => x) {
  if (!url) return '-';
  
  try {
    const parsed = new URL(url);
    
    // Nur http/https URLs erlauben (blockiert javascript:, data:, etc.)
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return '-';
    }
    
    // URL sanitisieren
    const safeUrl = sanitize(url);
    
    // LinkedIn-Domain prüfen für besseres Labeling
    const isLinkedIn = parsed.hostname.includes('linkedin.com');
    const linkText = isLinkedIn ? 'Profil öffnen' : 'Link öffnen';
    
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
  } catch {
    // Ungültige URL
    return '-';
  }
}

describe('renderLinkedInLink (XSS-Schutz)', () => {
  describe('Gültige URLs', () => {
    it('sollte LinkedIn-URLs korrekt rendern', () => {
      const result = renderLinkedInLink('https://www.linkedin.com/in/johndoe');
      
      expect(result).toContain('href="https://www.linkedin.com/in/johndoe"');
      expect(result).toContain('Profil öffnen');
      expect(result).toContain('target="_blank"');
      expect(result).toContain('rel="noopener noreferrer"');
    });

    it('sollte andere HTTPS-URLs akzeptieren', () => {
      const result = renderLinkedInLink('https://example.com/profile');
      
      expect(result).toContain('href="https://example.com/profile"');
      expect(result).toContain('Link öffnen');
    });

    it('sollte HTTP-URLs akzeptieren', () => {
      const result = renderLinkedInLink('http://linkedin.com/in/test');
      
      expect(result).toContain('href="http://linkedin.com/in/test"');
      expect(result).toContain('Profil öffnen');
    });
  });

  describe('XSS-Angriffe blockieren', () => {
    it('sollte javascript: URLs blockieren', () => {
      const result = renderLinkedInLink('javascript:alert("XSS")');
      
      expect(result).toBe('-');
      expect(result).not.toContain('javascript');
    });

    it('sollte data: URLs blockieren', () => {
      const result = renderLinkedInLink('data:text/html,<script>alert("XSS")</script>');
      
      expect(result).toBe('-');
      expect(result).not.toContain('data:');
    });

    it('sollte vbscript: URLs blockieren', () => {
      const result = renderLinkedInLink('vbscript:msgbox("XSS")');
      
      expect(result).toBe('-');
    });

    it('sollte file: URLs blockieren', () => {
      const result = renderLinkedInLink('file:///etc/passwd');
      
      expect(result).toBe('-');
    });
  });

  describe('Ungültige Eingaben', () => {
    it('sollte null zurückgeben für leere Werte', () => {
      expect(renderLinkedInLink(null)).toBe('-');
      expect(renderLinkedInLink(undefined)).toBe('-');
      expect(renderLinkedInLink('')).toBe('-');
    });

    it('sollte ungültige URLs ablehnen', () => {
      expect(renderLinkedInLink('not a url')).toBe('-');
      expect(renderLinkedInLink('://invalid')).toBe('-');
      expect(renderLinkedInLink('just text')).toBe('-');
    });

    it('sollte relative URLs ablehnen', () => {
      expect(renderLinkedInLink('/relative/path')).toBe('-');
      expect(renderLinkedInLink('../parent/path')).toBe('-');
    });
  });

  describe('LinkedIn-Domain Erkennung', () => {
    it('sollte verschiedene LinkedIn-Subdomains erkennen', () => {
      const urls = [
        'https://www.linkedin.com/in/test',
        'https://linkedin.com/company/test',
        'https://de.linkedin.com/in/test'
      ];
      
      urls.forEach(url => {
        const result = renderLinkedInLink(url);
        expect(result).toContain('Profil öffnen');
      });
    });

    it('sollte Nicht-LinkedIn-URLs korrekt labeln', () => {
      const result = renderLinkedInLink('https://xing.com/profile/test');
      expect(result).toContain('Link öffnen');
    });
  });

  describe('Sanitization', () => {
    it('sollte die sanitize-Funktion verwenden wenn übergeben', () => {
      const mockSanitize = (url) => url.replace(/"/g, '&quot;');
      const urlWithQuotes = 'https://linkedin.com/in/test"onclick="alert(1)';
      
      const result = renderLinkedInLink(urlWithQuotes, mockSanitize);
      
      // Die URL sollte sanitisiert sein
      expect(result).toContain('&quot;');
      expect(result).not.toContain('onclick');
    });
  });
});
