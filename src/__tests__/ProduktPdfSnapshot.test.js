import { describe, it, expect, vi } from 'vitest';
import {
  bilderAusUploader,
  collectProduktPdfSnapshot,
  ladeKundenstamm,
} from '../modules/produkt/ProduktPdfSnapshot.js';

function uploader(files, primary = null) {
  return {
    getKeptExistingFiles: () => files,
    effectivePrimaryKey: () => primary ?? (files[0] ? `existing:${files[0].id}` : null),
  };
}

describe('bilderAusUploader', () => {
  it('behaelt die Reihenfolge der Seite, markiert das Hauptbild und nimmt den Namen mit', () => {
    const bilder = bilderAusUploader(uploader(
      [
        { id: 'a', url: 'a.jpg', name: 'Produktbild 1' },
        { id: 'b', url: 'b.jpg', name: 'Produktbild 2' },
        { id: 'c', url: '', name: 'ohne URL' },
      ],
      'existing:b'
    ));
    expect(bilder).toEqual([
      { url: 'a.jpg', name: 'Produktbild 1', primary: false },
      { url: 'b.jpg', name: 'Produktbild 2', primary: true },
    ]);
  });

  it('liefert [] ohne Uploader', () => {
    expect(bilderAusUploader(null)).toEqual([]);
  });
});

describe('collectProduktPdfSnapshot', () => {
  it('nimmt den Live-Stand aus den Formdaten und holt Kunde nach', async () => {
    const lade = vi.fn(async () => ({
      unternehmen: { firmenname: 'Glow GmbH' },
      marken: [{ markenname: 'Glow' }],
    }));
    const snapshot = await collectProduktPdfSnapshot({
      data: { name: 'Neu getippt', usp: 'a\nb', unbekannt: 'x' },
      varianten: [{ name: 'Sand' }],
      useCases: [{ name: 'Morgens' }],
      uploader: uploader([{ id: 'a', url: 'a.jpg' }]),
      unternehmenId: 'u1',
      markeIds: ['m1'],
    }, lade);

    expect(lade).toHaveBeenCalledWith({ unternehmenId: 'u1', markeIds: ['m1'] });
    expect(snapshot.name).toBe('Neu getippt');
    expect(snapshot.kurzbeschreibung).toBe('');
    expect(snapshot.unbekannt).toBeUndefined();
    expect(snapshot.unternehmen.firmenname).toBe('Glow GmbH');
    expect(snapshot.varianten).toHaveLength(1);
    expect(snapshot.bilder).toEqual([{ url: 'a.jpg', name: '', primary: true }]);
  });

  it('nimmt die Firma aus dem Formularfeld, wenn der Kontext keine hat', async () => {
    const lade = vi.fn(async () => ({ unternehmen: null, marken: [] }));
    await collectProduktPdfSnapshot({ data: { unternehmen_id: 'u9' }, unternehmenId: null }, lade);
    expect(lade).toHaveBeenCalledWith({ unternehmenId: 'u9', markeIds: [] });
  });

  it('exportiert trotzdem, wenn der Kunden-Lookup scheitert', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const snapshot = await collectProduktPdfSnapshot(
      { data: { name: 'X' }, unternehmenId: 'u1' },
      async () => { throw new Error('RLS'); }
    );
    expect(snapshot.name).toBe('X');
    expect(snapshot.unternehmen).toBeNull();
    expect(snapshot.marken).toEqual([]);
    warn.mockRestore();
  });
});

describe('ladeKundenstamm', () => {
  it('fragt nichts ab, wenn keine IDs da sind', async () => {
    const client = { from: vi.fn() };
    const result = await ladeKundenstamm({ unternehmenId: null, markeIds: [] }, client);
    expect(client.from).not.toHaveBeenCalled();
    expect(result).toEqual({ unternehmen: null, marken: [] });
  });
});
