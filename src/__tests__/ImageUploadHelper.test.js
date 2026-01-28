// ImageUploadHelper.test.js
// Unit Tests für die ImageUploadHelper Klasse

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageUploadHelper } from '../core/ImageUploadHelper.js';

// Mock für window.supabase
const mockSupabase = {
  storage: {
    from: vi.fn(() => ({
      list: vi.fn(() => Promise.resolve({ data: [] })),
      remove: vi.fn(() => Promise.resolve({ error: null })),
      upload: vi.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/test.jpg' } }))
    }))
  },
  from: vi.fn(() => ({
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null }))
    }))
  }))
};

describe('ImageUploadHelper', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    window.supabase = mockSupabase;
  });

  describe('upload', () => {
    it('sollte bei fehlendem Uploader übersprungen werden', async () => {
      const form = document.createElement('form');
      
      const result = await ImageUploadHelper.upload({
        entityType: 'ansprechpartner',
        entityId: '123',
        form,
        imageType: 'profile'
      });
      
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it('sollte bei unbekanntem Bildtyp Fehler zurückgeben', async () => {
      const form = document.createElement('form');
      
      const result = await ImageUploadHelper.upload({
        entityType: 'ansprechpartner',
        entityId: '123',
        form,
        imageType: 'unknown'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unbekannter Bildtyp');
    });

    it('sollte bei zu großer Datei Fehler zurückgeben', async () => {
      const form = document.createElement('form');
      const uploaderDiv = document.createElement('div');
      uploaderDiv.className = 'uploader';
      uploaderDiv.dataset.name = 'profile_image_file';
      
      // Mock großer Datei (600 KB)
      uploaderDiv.__uploaderInstance = {
        files: [{ 
          size: 600 * 1024, 
          type: 'image/jpeg',
          name: 'test.jpg'
        }]
      };
      form.appendChild(uploaderDiv);
      
      const result = await ImageUploadHelper.upload({
        entityType: 'ansprechpartner',
        entityId: '123',
        form,
        imageType: 'profile'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('zu groß');
    });

    it('sollte bei ungültigem Dateityp Fehler zurückgeben', async () => {
      const form = document.createElement('form');
      const uploaderDiv = document.createElement('div');
      uploaderDiv.className = 'uploader';
      uploaderDiv.dataset.name = 'profile_image_file';
      
      // Mock ungültiger Dateityp
      uploaderDiv.__uploaderInstance = {
        files: [{ 
          size: 100 * 1024, 
          type: 'image/gif',  // Nicht erlaubt
          name: 'test.gif'
        }]
      };
      form.appendChild(uploaderDiv);
      
      const result = await ImageUploadHelper.upload({
        entityType: 'ansprechpartner',
        entityId: '123',
        form,
        imageType: 'profile'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('PNG und JPG');
    });
  });

  describe('uploadProfileImage', () => {
    it('sollte uploadProfileImage korrekt delegieren', async () => {
      const form = document.createElement('form');
      
      // Ohne Uploader sollte es übersprungen werden
      const result = await ImageUploadHelper.uploadProfileImage('123', form);
      
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });
  });

  describe('uploadLogo', () => {
    it('sollte uploadLogo korrekt delegieren', async () => {
      const form = document.createElement('form');
      
      // Ohne Uploader sollte es übersprungen werden
      const result = await ImageUploadHelper.uploadLogo('unternehmen', '123', form);
      
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });
  });
});
