import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VertragUploadDrawer } from '../modules/vertrag/VertragUploadDrawer.js';

describe('VertragUploadDrawer', () => {
  let drawer;

  beforeEach(() => {
    document.body.innerHTML = '';
    drawer = new VertragUploadDrawer();
  });

  afterEach(() => {
    drawer.removeDrawer();
  });

  describe('open', () => {
    it('erstellt Drawer-Elemente im DOM', () => {
      drawer.open('v1', { unternehmen: 'Acme' }, vi.fn());

      expect(document.getElementById('vertrag-upload-drawer')).not.toBeNull();
      expect(document.getElementById('vertrag-upload-drawer-overlay')).not.toBeNull();
      expect(document.querySelector('.dropzone-browse-btn')).not.toBeNull();
    });

    it('zeigt Drop-Zone und versteckte Preview', () => {
      drawer.open('v1', {}, vi.fn());

      const dropzone = document.getElementById('vertrag-upload-dropzone');
      const preview = document.getElementById('vertrag-upload-preview');

      expect(dropzone.style.display).not.toBe('none');
      expect(preview.style.display).toBe('none');
    });
  });

  describe('selectFile', () => {
    it('akzeptiert PDF-Dateien', () => {
      drawer.open('v1', {}, vi.fn());

      const pdfFile = new File(['dummy'], 'vertrag.pdf', { type: 'application/pdf' });
      Object.defineProperty(pdfFile, 'size', { value: 1024 * 1024 });

      drawer.selectFile(pdfFile);

      expect(drawer._selectedFile).toBe(pdfFile);
      expect(document.getElementById('vertrag-upload-dropzone').style.display).toBe('none');
      expect(document.getElementById('vertrag-upload-preview').style.display).toBe('flex');
    });

    it('lehnt Nicht-PDF-Dateien ab', () => {
      drawer.open('v1', {}, vi.fn());

      const jpgFile = new File(['dummy'], 'bild.jpg', { type: 'image/jpeg' });
      drawer.selectFile(jpgFile);

      expect(drawer._selectedFile).toBeNull();
      const errorEl = document.getElementById('vertrag-upload-error');
      expect(errorEl.style.display).toBe('block');
      expect(errorEl.textContent).toContain('PDF');
    });

    it('lehnt zu große Dateien ab', () => {
      drawer.open('v1', {}, vi.fn());

      const bigFile = new File(['dummy'], 'vertrag.pdf', { type: 'application/pdf' });
      Object.defineProperty(bigFile, 'size', { value: 30 * 1024 * 1024 });

      drawer.selectFile(bigFile);

      expect(drawer._selectedFile).toBeNull();
      const errorEl = document.getElementById('vertrag-upload-error');
      expect(errorEl.style.display).toBe('block');
      expect(errorEl.textContent).toContain('groß');
    });
  });

  describe('close', () => {
    it('entfernt Drawer aus dem DOM', () => {
      drawer.open('v1', {}, vi.fn());
      drawer.close();

      setTimeout(() => {
        expect(document.getElementById('vertrag-upload-drawer')).toBeNull();
      }, 400);
    });

    it('verhindert Schließen während Upload', () => {
      drawer.open('v1', {}, vi.fn());
      drawer._isUploading = true;
      drawer.close();

      expect(document.getElementById('vertrag-upload-drawer')).not.toBeNull();
    });
  });

  describe('clearFile', () => {
    it('setzt Dateiauswahl zurück', () => {
      drawer.open('v1', {}, vi.fn());

      const pdfFile = new File(['dummy'], 'vertrag.pdf', { type: 'application/pdf' });
      Object.defineProperty(pdfFile, 'size', { value: 1024 });
      drawer.selectFile(pdfFile);

      drawer.clearFile();

      expect(drawer._selectedFile).toBeNull();
      expect(document.getElementById('vertrag-upload-dropzone').style.display).toBe('');
      expect(document.getElementById('vertrag-upload-preview').style.display).toBe('none');
    });
  });
});
