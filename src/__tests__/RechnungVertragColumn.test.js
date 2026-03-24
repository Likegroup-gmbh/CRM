import { describe, it, expect } from 'vitest';
import { renderVertragCell } from '../modules/rechnung/RechnungVertragColumn.js';

describe('RechnungVertragColumn', () => {

  describe('renderVertragCell', () => {

    // --- ROT: Kein Vertrag ---

    it('zeigt roten Dot wenn kein Vertrag vorhanden (null)', () => {
      const html = renderVertragCell({ vertrag: null });
      expect(html).toContain('status-dot--inactive');
      expect(html).toContain('Kein Vertrag erstellt');
    });

    it('zeigt roten Dot wenn Rechnung kein vertrag-Objekt hat', () => {
      const html = renderVertragCell({});
      expect(html).toContain('status-dot--inactive');
    });

    // --- ORANGE: Vertrag erstellt, nicht unterschrieben ---

    it('zeigt orangen Dot wenn Vertrag Entwurf ist', () => {
      const html = renderVertragCell({
        vertrag: { id: 'v1', is_draft: true }
      });
      expect(html).toContain('status-dot--warning');
      expect(html).toContain('nicht unterschrieben');
      expect(html).not.toContain('href');
    });

    it('zeigt orangen Dot wenn Vertrag erstellt aber nicht unterschrieben', () => {
      const html = renderVertragCell({
        vertrag: {
          id: 'v1',
          is_draft: false,
          datei_url: 'https://supabase.co/generated.pdf',
          unterschriebener_vertrag_url: null,
          dropbox_file_url: null
        }
      });
      expect(html).toContain('status-dot--warning');
      expect(html).not.toContain('href');
    });

    it('zeigt orangen Dot wenn Vertrag keine URLs hat', () => {
      const html = renderVertragCell({
        vertrag: { id: 'v1', is_draft: false }
      });
      expect(html).toContain('status-dot--warning');
    });

    // --- GRUEN: Unterschrieben ---

    it('zeigt gruenen Dot mit Icon-Link bei unterschriebenem Vertrag (Dropbox)', () => {
      const html = renderVertragCell({
        vertrag: {
          id: 'v1',
          name: 'Vertrag Acme UGC',
          dropbox_file_url: 'https://dropbox.com/signed.pdf',
          unterschriebener_vertrag_url: null,
          datei_url: null
        }
      });
      expect(html).toContain('status-dot--active');
      expect(html).toContain('href="https://dropbox.com/signed.pdf"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('<svg');
      expect(html).toContain('external-link-btn');
    });

    it('zeigt gruenen Dot mit Icon-Link bei unterschriebener_vertrag_url', () => {
      const html = renderVertragCell({
        vertrag: {
          id: 'v2',
          name: 'Vertrag Model',
          dropbox_file_url: null,
          unterschriebener_vertrag_url: 'https://supabase.co/signed.pdf',
          datei_url: 'https://supabase.co/generated.pdf'
        }
      });
      expect(html).toContain('status-dot--active');
      expect(html).toContain('href="https://supabase.co/signed.pdf"');
      expect(html).toContain('<svg');
    });

    it('zeigt SVG-Icon statt Vertragsname als Linktext', () => {
      const html = renderVertragCell({
        vertrag: {
          id: 'v3',
          name: 'Langer Vertragsname',
          dropbox_file_url: 'https://dropbox.com/v3.pdf'
        }
      });
      expect(html).not.toContain('Langer Vertragsname');
      expect(html).toContain('<svg');
    });

  });

});
