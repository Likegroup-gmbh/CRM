// @vitest-environment jsdom
//
// Deckt die drei neuen Bausteine der Produktbild-Tabelle ab: Format-Erkennung
// beim Komprimieren, Masse/Groesse-Spalten samt Reduzieren-Button und die
// Navigation der Bild-Lightbox.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UploaderField } from '../core/form/fields/UploaderField.js';
import { ImageLightbox } from '../core/media/ImageLightbox.js';
import { ProduktForm } from '../modules/produkt/ProduktForm.js';
import { ProduktService } from '../modules/produkt/ProduktService.js';

/**
 * OffscreenCanvas gibt es in jsdom nicht. Der Stub liefert nur fuer die in
 * `koennen` genannten Typen einen Blob dieses Typs - alles andere faellt wie im
 * echten Browser still auf PNG zurueck.
 */
function stubCanvas(koennen) {
  globalThis.OffscreenCanvas = class {
    constructor(width, height) {
      this.width = width;
      this.height = height;
    }
    getContext() {
      return { drawImage: () => {} };
    }
    async convertToBlob({ type } = {}) {
      const typ = koennen.includes(type) ? type : 'image/png';
      return new Blob(['x'], { type: typ });
    }
  };
  globalThis.createImageBitmap = async () => ({ width: 1000, height: 500, close: () => {} });
}

async function ladeCompressor() {
  // Der Support-Cache lebt im Modul-Scope - pro Test frisch importieren
  vi.resetModules();
  return import('../core/ImageCompressor.js');
}

describe('ImageCompressor: Formatpruefung', () => {
  const original = new File(['abc'], 'foto.jpg', { type: 'image/jpeg' });

  afterEach(() => {
    delete globalThis.OffscreenCanvas;
    delete globalThis.createImageBitmap;
  });

  it('liefert AVIF, wenn der Browser es encodieren kann', async () => {
    stubCanvas(['image/avif', 'image/webp']);
    const { compressImage } = await ladeCompressor();

    const datei = await compressImage(original, { format: 'image/avif', fallbackFormat: 'image/webp' });

    expect(datei.type).toBe('image/avif');
    expect(datei.name).toBe('foto.avif');
  });

  it('weicht auf WebP aus, wenn AVIF still zu PNG wird', async () => {
    stubCanvas(['image/webp']);
    const { compressImage } = await ladeCompressor();

    const datei = await compressImage(original, { format: 'image/avif', fallbackFormat: 'image/webp' });

    expect(datei.type).toBe('image/webp');
    expect(datei.name).toBe('foto.webp');
  });

  it('nimmt PNG erst, wenn auch das Ersatzformat scheitert', async () => {
    stubCanvas([]);
    const { compressImage } = await ladeCompressor();

    const datei = await compressImage(original, { format: 'image/avif', fallbackFormat: 'image/webp' });

    expect(datei.type).toBe('image/png');
    expect(datei.name).toBe('foto.png');
  });

  it('prueft die Encoder-Faehigkeit nur einmal', async () => {
    stubCanvas(['image/webp']);
    const { compressImage } = await ladeCompressor();
    const spy = vi.spyOn(globalThis.OffscreenCanvas.prototype, 'convertToBlob');

    await compressImage(original, { format: 'image/avif', fallbackFormat: 'image/webp' });
    const nachErstem = spy.mock.calls.length;
    await compressImage(original, { format: 'image/avif', fallbackFormat: 'image/webp' });

    // Zweiter Durchlauf ohne erneute AVIF-Probe: genau ein Encode mehr
    expect(spy.mock.calls.length).toBe(nachErstem + 1);
  });

  it('leitet die Endung aus dem MIME-Type ab', async () => {
    const { extensionForType } = await ladeCompressor();

    expect(extensionForType('image/avif')).toBe('avif');
    expect(extensionForType('image/jpeg')).toBe('jpg');
    expect(extensionForType('irgendwas')).toBe('webp');
  });
});

describe('UploaderField: Masse und Dateigroesse', () => {
  let root;
  let uploader;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);

    uploader = new UploaderField({
      multiple: true,
      variant: 'table',
      warnFileSize: 200 * 1024,
      primarySelectable: true
    });
    uploader.mount(root);
  });

  afterEach(() => {
    root.remove();
  });

  it('rendert Maße- und Größe-Spalte', () => {
    uploader.setExistingFiles([{ id: 'a1', name: 'Produktbild 1', url: 'https://cdn.test/a1.avif' }]);

    const kopf = [...root.querySelectorAll('th')].map(th => th.textContent.trim());
    expect(kopf).toContain('Maße');
    expect(kopf).toContain('Größe');
  });

  it('zeigt zunaechst einen Platzhalter und danach die gelesenen Werte', () => {
    uploader.setExistingFiles([{ id: 'a1', name: 'Produktbild 1', url: 'https://cdn.test/a1.avif' }]);

    expect(root.querySelector('td.col-dimension').textContent).toContain('…');

    uploader.meta.set('e:a1', { status: 'ready', width: 1200, height: 800, bytes: 150 * 1024 });
    uploader.refreshMetaCells();

    expect(root.querySelector('td.col-dimension').textContent).toBe('1200×800');
    expect(root.querySelector('td.col-size').textContent).toContain('150.0 KB');
  });

  it('markiert Dateien ueber der Warnschwelle und bietet Reduzieren an', () => {
    uploader.setExistingFiles([
      { id: 'klein', name: 'Klein', url: 'https://cdn.test/klein.avif' },
      { id: 'gross', name: 'Groß', url: 'https://cdn.test/gross.avif' }
    ]);

    uploader.meta.set('e:klein', { status: 'ready', width: 800, height: 800, bytes: 199 * 1024 });
    uploader.meta.set('e:gross', { status: 'ready', width: 800, height: 800, bytes: 201 * 1024 });
    uploader.refreshMetaCells();

    const zeilen = [...root.querySelectorAll('tr[data-row-key]')];
    const klein = zeilen.find(tr => tr.dataset.rowKey === 'existing:klein');
    const gross = zeilen.find(tr => tr.dataset.rowKey === 'existing:gross');

    expect(klein.querySelector('.uploader-badge--warn')).toBeNull();
    expect(klein.querySelector('.uploader-shrink')).toBeNull();
    expect(gross.querySelector('.uploader-badge--warn').textContent).toBe('Große Datei');
    expect(gross.querySelector('.uploader-shrink')).not.toBeNull();
  });

  it('blendet Badge und Button ohne warnFileSize aus', () => {
    const ohne = new UploaderField({ multiple: true, variant: 'table' });
    const eigenerRoot = document.createElement('div');
    document.body.appendChild(eigenerRoot);
    ohne.mount(eigenerRoot);

    ohne.setExistingFiles([{ id: 'x', name: 'Bild', url: 'https://cdn.test/x.avif' }]);
    ohne.meta.set('e:x', { status: 'ready', width: 800, height: 800, bytes: 5 * 1024 * 1024 });
    ohne.refreshMetaCells();

    expect(eigenerRoot.querySelector('.uploader-shrink')).toBeNull();
    eigenerRoot.remove();
  });

  it('haengt die verkleinerte Fassung als Ersatz an das gespeicherte Bild', async () => {
    const eintrag = { id: 'a1', name: 'Produktbild 1', url: 'https://cdn.test/a1.avif' };
    uploader.setExistingFiles([eintrag]);
    uploader.meta.set('e:a1', { status: 'ready', width: 2000, height: 2000, bytes: 400 * 1024 });
    uploader.refreshMetaCells();

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['gross'.repeat(100)], { type: 'image/avif' })
    }));
    stubCanvas(['image/avif']);

    const btn = root.querySelector('.uploader-shrink');
    await uploader.shrinkRow(btn.dataset.shrinkKey, btn);

    expect(eintrag.replacementFile).toBeInstanceOf(File);
    expect(eintrag.replacementFile.type).toBe('image/avif');
    // Der Ersatz laeuft erst beim Speichern - der Eintrag bleibt an Ort und Stelle
    expect(uploader.getKeptExistingFiles()).toHaveLength(1);
    expect(uploader.getDeletedFileIds()).toHaveLength(0);

    delete globalThis.fetch;
  });

  it('behaelt das Original, wenn das Verkleinern nichts bringt', async () => {
    const eintrag = { id: 'a1', name: 'Produktbild 1', url: 'https://cdn.test/a1.avif' };
    uploader.setExistingFiles([eintrag]);
    uploader.meta.set('e:a1', { status: 'ready', width: 400, height: 400, bytes: 400 * 1024 });
    uploader.refreshMetaCells();

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['x'], { type: 'image/avif' })
    }));
    stubCanvas(['image/avif']);

    const btn = root.querySelector('.uploader-shrink');
    await uploader.shrinkRow(btn.dataset.shrinkKey, btn);

    expect(eintrag.replacementFile).toBeUndefined();
    expect(uploader.errorMessage).toContain('nicht weiter verkleinern');

    delete globalThis.fetch;
  });
});

describe('UploaderField: Vorschau', () => {
  let root;
  let uploader;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    uploader = new UploaderField({ multiple: true, variant: 'table' });
    uploader.mount(root);
    uploader.setExistingFiles([
      { id: 'a1', name: 'Bild 1', url: 'https://cdn.test/a1.avif' },
      { id: 'a2', name: 'Bild 2', url: 'https://cdn.test/a2.avif' }
    ]);
  });

  afterEach(() => {
    root.remove();
  });

  it('macht Thumbnail und Dateiname zu Lightbox-Ausloesern statt zu externen Links', () => {
    expect(root.querySelector('a[target="_blank"]')).toBeNull();
    expect(root.querySelectorAll('[data-preview-index]')).toHaveLength(4);
  });

  it('sammelt die Bilder in Anzeigereihenfolge', () => {
    expect(uploader.previewItems.map(i => i.name)).toEqual(['Bild 1', 'Bild 2']);
  });

  it('vergibt keinen Vorschau-Index fuer Nicht-Bilder', () => {
    uploader.setExistingFiles([{ id: 'p1', name: 'Vertrag', url: 'https://cdn.test/vertrag.pdf' }]);
    expect(uploader.previewItems).toHaveLength(0);
  });
});

describe('saveBilder: Ersatzdateien', () => {
  let uploader;
  let root;
  let payload;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    uploader = new UploaderField({ multiple: true, variant: 'table', primarySelectable: true });
    uploader.mount(root);

    payload = null;
    vi.spyOn(ProduktService, 'saveBilder').mockImplementation(async (_id, daten) => {
      payload = daten;
    });
  });

  afterEach(() => {
    root.remove();
    vi.restoreAllMocks();
  });

  /** saveBilder braucht nur den Uploader - der Rest der Seite bleibt aussen vor. */
  function speichern() {
    return ProduktForm.prototype.saveBilder.call(
      { getBilderUploader: () => uploader },
      'produkt-1'
    );
  }

  it('reicht die verkleinerte Fassung eines gespeicherten Bildes als ersatzFile durch', async () => {
    const ersatz = new File(['klein'], 'bild.avif', { type: 'image/avif' });
    uploader.setExistingFiles([
      { id: 'a1', name: 'Bild 1', url: 'https://cdn.test/a1.avif', replacementFile: ersatz },
      { id: 'a2', name: 'Bild 2', url: 'https://cdn.test/a2.avif' }
    ]);

    await speichern();

    expect(payload.bestehende).toEqual([
      { id: 'a1', position: 0, ist_hauptbild: true, ersatzFile: ersatz },
      { id: 'a2', position: 1, ist_hauptbild: false, ersatzFile: null }
    ]);
  });

  it('laedt ein verkleinertes Extraktionsbild neu hoch statt die Temp-Datei zu verschieben', async () => {
    const ersatz = new File(['klein'], 'bild.avif', { type: 'image/avif' });
    uploader.setExistingFiles([
      {
        id: 'temp:_temp/x/1.avif',
        name: 'Von der Produktseite 1',
        url: 'https://cdn.test/1.avif',
        isTemporary: true,
        storagePfad: '_temp/x/1.avif',
        quelleUrl: 'https://shop.test/bild.jpg',
        replacementFile: ersatz
      }
    ]);

    await speichern();

    expect(payload.temp).toHaveLength(0);
    expect(payload.neue).toEqual([
      { file: ersatz, quelle_url: 'https://shop.test/bild.jpg', position: 0, ist_hauptbild: true }
    ]);
  });

  it('zaehlt die Positionen ueber alle Gruppen durch', async () => {
    uploader.setExistingFiles([
      { id: 'a1', name: 'Bild 1', url: 'https://cdn.test/a1.avif' },
      {
        id: 'temp:_temp/x/1.avif',
        name: 'Extrahiert',
        url: 'https://cdn.test/1.avif',
        isTemporary: true,
        storagePfad: '_temp/x/1.avif'
      }
    ]);
    uploader.files = [new File(['neu'], 'neu.png', { type: 'image/png' })];

    await speichern();

    expect(payload.bestehende[0].position).toBe(0);
    expect(payload.temp[0].position).toBe(1);
    expect(payload.neue[0].position).toBe(2);
  });
});

describe('ImageLightbox', () => {
  const bilder = [
    { url: 'https://cdn.test/1.avif', name: 'Eins' },
    { url: 'https://cdn.test/2.avif', name: 'Zwei' },
    { url: 'https://cdn.test/3.avif', name: 'Drei' }
  ];

  afterEach(() => {
    document.querySelectorAll('.media-lightbox-overlay').forEach(el => el.remove());
  });

  // Die Shell rendert den Body ueber einen await-Hook, also erst im naechsten Tick
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));

  it('startet beim gewaehlten Bild', async () => {
    const lb = new ImageLightbox();
    lb.open(bilder, 1);
    await tick();

    expect(lb.current().name).toBe('Zwei');
    expect(document.querySelector('.image-lightbox__img').src).toBe('https://cdn.test/2.avif');
    lb.close();
  });

  it('laeuft nicht ueber die Grenzen hinaus', () => {
    const lb = new ImageLightbox();
    lb.open(bilder, 0);

    lb.step(-1);
    expect(lb.index).toBe(0);

    lb.step(1);
    lb.step(1);
    lb.step(1);
    expect(lb.index).toBe(2);
    lb.close();
  });

  it('oeffnet nichts ohne Bilder', () => {
    const lb = new ImageLightbox();
    lb.open([]);
    expect(lb.isOpen()).toBe(false);
  });

  it('zeigt Navigation nur bei mehreren Bildern', () => {
    const lb = new ImageLightbox();
    lb.open([bilder[0]]);
    expect(document.querySelector('.media-lightbox-prev')).toBeNull();
    lb.close();

    lb.open(bilder);
    expect(document.querySelector('.media-lightbox-prev')).not.toBeNull();
    lb.close();
  });
});
