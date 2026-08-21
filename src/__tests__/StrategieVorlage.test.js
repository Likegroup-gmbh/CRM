import { describe, it, expect } from 'vitest';
import { applyStrategieItem, buildReferenzVideoPayload } from '../modules/skripte/strategieVorlage.js';

const ITEM = {
  id: 'i1',
  beschreibung: 'Morgenroutine mit Produkt X',
  transkript: 'Hook. Hauptteil. CTA.',
  caption: 'Original #ad',
  video_link: 'https://www.tiktok.com/@u/video/1',
  plattform: 'tiktok'
};

const IDEE_ITEM = {
  id: 'i2',
  beschreibung: 'Nur die Idee',
  transkript: '   ',
  caption: null,
  video_link: null,
  plattform: null
};

describe('applyStrategieItem', () => {
  it('fuellt leere Video-Idee aus der Beschreibung, Transkript bleibt in der Vorlage', () => {
    const next = applyStrategieItem(ITEM, { idee: '', previousIdeeFromItem: '' });
    expect(next.idee).toBe('Morgenroutine mit Produkt X');
    expect(next.ideeFromItem).toBe('Morgenroutine mit Produkt X');
    expect(next.transkript).toBe('Hook. Hauptteil. CTA.');
    expect(next.beschreibung).toBe('Morgenroutine mit Produkt X');
    expect(next.caption).toBe('Original #ad');
    expect(next.url).toBe('https://www.tiktok.com/@u/video/1');
    expect(next.hasVorlage).toBe(true);
    expect(next.idee).not.toContain('Hook. Hauptteil');
  });

  it('ueberschreibt die Idee nur wenn sie noch der vorherigen Item-Beschreibung entspricht', () => {
    const kept = applyStrategieItem(ITEM, {
      idee: 'Meine eigene Idee',
      previousIdeeFromItem: 'Alte Beschreibung'
    });
    expect(kept.idee).toBe('Meine eigene Idee');
    expect(kept.ideeFromItem).toBe('Alte Beschreibung');

    const replaced = applyStrategieItem(ITEM, {
      idee: 'Alte Beschreibung',
      previousIdeeFromItem: 'Alte Beschreibung'
    });
    expect(replaced.idee).toBe('Morgenroutine mit Produkt X');
    expect(replaced.ideeFromItem).toBe('Morgenroutine mit Produkt X');
  });

  it('reine Idee ohne Transkript: nur Idee, keine Vorlage', () => {
    const next = applyStrategieItem(IDEE_ITEM, { idee: '', previousIdeeFromItem: '' });
    expect(next.idee).toBe('Nur die Idee');
    expect(next.hasVorlage).toBe(false);
    expect(next.transkript).toBe('');
  });

  it('Clear setzt die Idee nur zurueck wenn sie noch vom Item stammt', () => {
    const cleared = applyStrategieItem(null, {
      idee: 'Morgenroutine mit Produkt X',
      previousIdeeFromItem: 'Morgenroutine mit Produkt X'
    });
    expect(cleared.idee).toBe('');
    expect(cleared.itemId).toBeNull();

    const kept = applyStrategieItem(null, {
      idee: 'Selbst geschrieben',
      previousIdeeFromItem: 'Morgenroutine mit Produkt X'
    });
    expect(kept.idee).toBe('Selbst geschrieben');
  });
});

describe('buildReferenzVideoPayload (Strategie-Item)', () => {
  it('liefert null ohne gewaehltes Item', () => {
    expect(buildReferenzVideoPayload({
      strategieItemId: '',
      transkript: '',
      url: ''
    })).toBeNull();
  });

  it('liefert null bei Item ohne Transkript (reine Idee)', () => {
    expect(buildReferenzVideoPayload({
      strategieItemId: 'i2',
      url: '',
      transkript: '   ',
      beschreibung: 'Nur die Idee'
    })).toBeNull();
  });

  it('liefert quelle strategie_item mit Client-Snapshot', () => {
    const ref = buildReferenzVideoPayload({
      strategieItemId: 'i1',
      url: ITEM.video_link,
      transkript: 'Korrigiertes Transkript der Vorlage.',
      beschreibung: 'Morgenroutine mit Produkt X',
      caption: 'Original #ad',
      platform: 'tiktok'
    });
    expect(ref).toEqual({
      quelle: 'strategie_item',
      strategie_item_id: 'i1',
      url: ITEM.video_link,
      transkript_verwendet: 'Korrigiertes Transkript der Vorlage.',
      beschreibung: 'Morgenroutine mit Produkt X',
      caption: 'Original #ad',
      platform: 'tiktok'
    });
  });
});
