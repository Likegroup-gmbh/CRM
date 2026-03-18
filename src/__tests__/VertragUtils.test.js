import { describe, it, expect } from 'vitest';
import { VertragUtils } from '../modules/vertrag/VertragUtils.js';

describe('VertragUtils', () => {

  // --- getVertragLinkUrl ---

  describe('getVertragLinkUrl', () => {
    it('gibt dropbox_file_url zurück wenn vorhanden', () => {
      const vertrag = {
        dropbox_file_url: 'https://dropbox.com/signed.pdf',
        unterschriebener_vertrag_url: 'https://supabase.co/old.pdf',
        datei_url: 'https://supabase.co/generated.pdf'
      };
      expect(VertragUtils.getVertragLinkUrl(vertrag)).toBe('https://dropbox.com/signed.pdf');
    });

    it('fällt auf unterschriebener_vertrag_url zurück wenn kein Dropbox-Link', () => {
      const vertrag = {
        dropbox_file_url: null,
        unterschriebener_vertrag_url: 'https://supabase.co/signed.pdf',
        datei_url: 'https://supabase.co/generated.pdf'
      };
      expect(VertragUtils.getVertragLinkUrl(vertrag)).toBe('https://supabase.co/signed.pdf');
    });

    it('fällt auf datei_url zurück wenn kein signierter Link', () => {
      const vertrag = {
        dropbox_file_url: null,
        unterschriebener_vertrag_url: null,
        datei_url: 'https://supabase.co/generated.pdf'
      };
      expect(VertragUtils.getVertragLinkUrl(vertrag)).toBe('https://supabase.co/generated.pdf');
    });

    it('gibt null zurück wenn gar kein Link vorhanden', () => {
      const vertrag = {};
      expect(VertragUtils.getVertragLinkUrl(vertrag)).toBeNull();
    });

    it('gibt null zurück bei null-Input', () => {
      expect(VertragUtils.getVertragLinkUrl(null)).toBeNull();
    });
  });

  // --- getVertragStatus ---

  describe('getVertragStatus', () => {
    it('gibt "unterschrieben" bei dropbox_file_url', () => {
      const vertrag = { dropbox_file_url: 'https://dropbox.com/signed.pdf', is_draft: false };
      expect(VertragUtils.getVertragStatus(vertrag)).toBe('unterschrieben');
    });

    it('gibt "unterschrieben" bei unterschriebener_vertrag_url', () => {
      const vertrag = { unterschriebener_vertrag_url: 'https://supabase.co/signed.pdf', is_draft: false };
      expect(VertragUtils.getVertragStatus(vertrag)).toBe('unterschrieben');
    });

    it('gibt "entwurf" bei is_draft=true', () => {
      const vertrag = { is_draft: true };
      expect(VertragUtils.getVertragStatus(vertrag)).toBe('entwurf');
    });

    it('gibt "erstellt" bei generiertem PDF ohne Unterschrift', () => {
      const vertrag = { datei_url: 'https://supabase.co/generated.pdf', is_draft: false };
      expect(VertragUtils.getVertragStatus(vertrag)).toBe('erstellt');
    });

    it('gibt "kein_vertrag" ohne jegliche URLs', () => {
      const vertrag = { is_draft: false };
      expect(VertragUtils.getVertragStatus(vertrag)).toBe('kein_vertrag');
    });

    it('gibt "kein_vertrag" bei null-Input', () => {
      expect(VertragUtils.getVertragStatus(null)).toBe('kein_vertrag');
    });
  });

  // --- shouldShowVertragstyp ---

  describe('shouldShowVertragstyp', () => {
    it('gibt false wenn Creator nur einen Vertragstyp hat', () => {
      const vertraege = [
        { creator_id: 'c1', typ: 'UGC' },
        { creator_id: 'c1', typ: 'UGC' },
      ];
      expect(VertragUtils.shouldShowVertragstyp(vertraege, 'c1')).toBe(false);
    });

    it('gibt true wenn Creator mehrere Vertragstypen hat', () => {
      const vertraege = [
        { creator_id: 'c1', typ: 'UGC' },
        { creator_id: 'c1', typ: 'Model' },
      ];
      expect(VertragUtils.shouldShowVertragstyp(vertraege, 'c1')).toBe(true);
    });

    it('gibt false bei leerem Array', () => {
      expect(VertragUtils.shouldShowVertragstyp([], 'c1')).toBe(false);
    });

    it('filtert nur den angegebenen Creator', () => {
      const vertraege = [
        { creator_id: 'c1', typ: 'UGC' },
        { creator_id: 'c2', typ: 'Model' },
      ];
      expect(VertragUtils.shouldShowVertragstyp(vertraege, 'c1')).toBe(false);
    });

    it('ignoriert Verträge ohne Typ', () => {
      const vertraege = [
        { creator_id: 'c1', typ: 'UGC' },
        { creator_id: 'c1', typ: null },
      ];
      expect(VertragUtils.shouldShowVertragstyp(vertraege, 'c1')).toBe(false);
    });
  });

  // --- buildDropboxVertragPath ---

  describe('buildDropboxVertragPath', () => {
    it('baut vollständigen Pfad mit allen Parametern', () => {
      const path = VertragUtils.buildDropboxVertragPath({
        unternehmen: 'Acme GmbH',
        kampagne: 'Sommer 2026',
        creator: 'Max Mustermann',
        vertragstyp: 'UGC',
        fileName: 'Vertrag_Acme.pdf'
      });
      expect(path).toBe('/Vertraege/Acme GmbH/Sommer 2026/Max Mustermann/UGC/Vertrag_Acme.pdf');
    });

    it('lässt Vertragstyp weg wenn nicht angegeben', () => {
      const path = VertragUtils.buildDropboxVertragPath({
        unternehmen: 'Acme GmbH',
        kampagne: 'Sommer 2026',
        creator: 'Max Mustermann',
        fileName: 'Vertrag.pdf'
      });
      expect(path).toBe('/Vertraege/Acme GmbH/Sommer 2026/Max Mustermann/Vertrag.pdf');
    });

    it('sanitiert Sonderzeichen im Pfad', () => {
      const path = VertragUtils.buildDropboxVertragPath({
        unternehmen: 'Firma <Test> "GmbH"',
        kampagne: 'Kampagne',
        creator: 'Creator',
        fileName: 'file.pdf'
      });
      expect(path).not.toContain('<');
      expect(path).not.toContain('>');
      expect(path).not.toContain('"');
    });

    it('generiert Fallback-Dateinamen wenn keiner angegeben', () => {
      const path = VertragUtils.buildDropboxVertragPath({
        unternehmen: 'Acme',
        kampagne: 'Test',
        creator: 'Creator',
      });
      expect(path).toMatch(/^\/Vertraege\/Acme\/Test\/Creator\/Vertrag_\d+\.pdf$/);
    });

    it('gibt minimalen Pfad wenn nichts angegeben', () => {
      const path = VertragUtils.buildDropboxVertragPath({});
      expect(path).toMatch(/^\/Vertraege\/Vertrag_\d+\.pdf$/);
    });
  });
});
