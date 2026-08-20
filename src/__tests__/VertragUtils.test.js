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

  // --- getVertragContext ---

  describe('getVertragContext', () => {
    it('liefert Auftrag-Kontext für Contracting mit Join', () => {
      const vertrag = {
        typ: 'Contracting',
        contracting_auftrag_id: 'a1',
        contracting_auftrag: { id: 'a1', titel: 'SharkNinja Q2', auftragsname: 'SN Q2' }
      };
      expect(VertragUtils.getVertragContext(vertrag)).toEqual({
        kind: 'auftrag',
        id: 'a1',
        label: 'SharkNinja Q2',
        href: '/contracts/a1',
        dataTable: 'contracts'
      });
    });

    it('fällt auf auftragsname zurück wenn titel fehlt', () => {
      const vertrag = {
        typ: 'Contracting',
        contracting_auftrag: { id: 'a1', titel: null, auftragsname: 'Auftrag X' }
      };
      expect(VertragUtils.getVertragContext(vertrag).label).toBe('Auftrag X');
    });

    it('nutzt contracting_auftrag_id wenn Join fehlt', () => {
      const vertrag = { typ: 'Contracting', contracting_auftrag_id: 'a9' };
      const ctx = VertragUtils.getVertragContext(vertrag);
      expect(ctx.id).toBe('a9');
      expect(ctx.href).toBe('/contracts/a9');
      expect(ctx.label).toBe('');
    });

    it('liefert Kampagne-Kontext für UGC', () => {
      const vertrag = {
        typ: 'UGC',
        kampagne_id: 'k1',
        kampagne: { id: 'k1', eigener_name: 'Sommer', kampagnenname: 'Kampagne A' }
      };
      expect(VertragUtils.getVertragContext(vertrag)).toEqual({
        kind: 'kampagne',
        id: 'k1',
        label: 'Sommer',
        href: '/kampagne/k1',
        dataTable: 'kampagne'
      });
    });

    it('fällt auf kampagnenname zurück wenn eigener_name fehlt', () => {
      const vertrag = {
        typ: 'Influencer Kooperation',
        kampagne: { id: 'k1', eigener_name: null, kampagnenname: 'Kampagne A' }
      };
      expect(VertragUtils.getVertragContext(vertrag).label).toBe('Kampagne A');
    });

    it('ignoriert Kampagne bei Contracting auch wenn Join vorhanden', () => {
      const vertrag = {
        typ: 'Contracting',
        kampagne: { id: 'k1', kampagnenname: 'Sollte nicht' },
        contracting_auftrag: { id: 'a1', titel: 'Contract' }
      };
      const ctx = VertragUtils.getVertragContext(vertrag);
      expect(ctx.kind).toBe('auftrag');
      expect(ctx.id).toBe('a1');
    });

    it('gibt leeren Kontext bei null', () => {
      expect(VertragUtils.getVertragContext(null).kind).toBeNull();
    });
  });

  describe('renderVertragContextHtml', () => {
    it('rendert Auftrag-Link für Contracting', () => {
      const html = VertragUtils.renderVertragContextHtml({
        typ: 'Contracting',
        contracting_auftrag: { id: 'a1', titel: 'SharkNinja' }
      });
      expect(html).toContain('/contracts/a1');
      expect(html).toContain('data-table="contracts"');
      expect(html).toContain('SharkNinja');
    });

    it('gibt Bindestrich ohne Kontext-ID', () => {
      expect(VertragUtils.renderVertragContextHtml({ typ: 'Contracting' })).toBe('-');
      expect(VertragUtils.renderVertragContextHtml({ typ: 'UGC' })).toBe('-');
    });
  });

  describe('getVertragOpenAction', () => {
    it('Draft → Edit-Pfad', () => {
      expect(VertragUtils.getVertragOpenAction({ id: 'v1', is_draft: true })).toEqual({
        kind: 'edit',
        href: '/vertraege/v1/edit'
      });
    });

    it('Final mit PDF → pdf-URL', () => {
      expect(VertragUtils.getVertragOpenAction({
        id: 'v1',
        is_draft: false,
        datei_url: 'https://example.com/v.pdf'
      })).toEqual({
        kind: 'pdf',
        url: 'https://example.com/v.pdf'
      });
    });

    it('Final ohne PDF → none', () => {
      expect(VertragUtils.getVertragOpenAction({ id: 'v1', is_draft: false })).toEqual({
        kind: 'none'
      });
    });
  });

  describe('renderVertragNameHtml', () => {
    it('Draft-Name geht auf Edit', () => {
      const html = VertragUtils.renderVertragNameHtml({ id: 'v1', name: 'Entwurf', is_draft: true });
      expect(html).toContain('/vertraege/v1/edit');
      expect(html).toContain('data-vertrag-open="edit"');
      expect(html).not.toContain('/vertraege/v1"');
    });

    it('Final-Name ist PDF-Link', () => {
      const html = VertragUtils.renderVertragNameHtml({
        id: 'v1',
        name: 'Final',
        is_draft: false,
        datei_url: 'https://example.com/v.pdf'
      });
      expect(html).toContain('https://example.com/v.pdf');
      expect(html).toContain('target="_blank"');
      expect(html).not.toContain('/vertraege/v1');
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
