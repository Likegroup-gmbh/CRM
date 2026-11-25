import { describe, it, expect } from 'vitest';
import {
  getStickyClasses,
  migrateHiddenColumns
} from '../modules/creator-auswahl/sourcingSpaltenSichtbarkeit.js';
import { baseCtx, cell, tableDoc } from './sourcingTabelleTestKit.js';

const media = (item, ctx) => cell('cp-col-name', item, ctx).querySelector('.table-identity__media');

describe('Sourcing – Profilbild in der Namenszelle', () => {
  it('zeigt das Profilbild links vom Namen', () => {
    const name = cell('cp-col-name', { name: 'Mia', profile_image_url: 'https://cdn.test/p.avif' });
    const img = name.querySelector('.table-identity__media img.table-avatar-img');

    expect(img.getAttribute('src')).toBe('https://cdn.test/p.avif');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(name.querySelector('.table-identity__text textarea[data-field="name"]').value).toBe('Mia');
  });

  it('nimmt fuer den kleinen Avatar das Thumbnail, wenn es vorhanden ist', () => {
    const img = media({
      name: 'Mia',
      profile_image_url: 'https://cdn.test/p.avif',
      profile_image_thumb_url: 'https://cdn.test/p_thumb.avif'
    }).querySelector('img');

    expect(img.getAttribute('src')).toBe('https://cdn.test/p_thumb.avif');
  });

  it('faellt ohne Bild auf den Initial des Namens zurueck', () => {
    const bild = media({ name: 'mia mueller' });

    expect(bild.querySelector('img')).toBeNull();
    expect(bild.querySelector('span.table-avatar').textContent.trim()).toBe('M');
  });

  it('zeigt ohne Namen ein Fragezeichen', () => {
    expect(media({}).querySelector('span.table-avatar').textContent.trim()).toBe('?');
  });

  it('ist auch fuer Kunden sichtbar', () => {
    expect(media({ profile_image_url: 'https://cdn.test/p.webp' }, { isKunde: true }).querySelector('img')).not.toBeNull();
  });

  it('setzt den gruenen Punkt bei vorhandener creator_id', () => {
    const dot = media({ creator_id: 'c1' }).querySelector('.sourcing-avatar__dot');

    expect(dot.classList.contains('status-dot--active')).toBe(true);
    expect(dot.getAttribute('title')).toBe('Als Creator angelegt');
  });

  it('setzt den roten Punkt nur bei Prio plus Zusage ohne Creator', () => {
    expect(media({ prio_1: true, zusage: true }).querySelector('.sourcing-avatar__dot').classList.contains('status-dot--inactive')).toBe(true);
    expect(media({ zusage: true }).querySelector('.sourcing-avatar__dot')).toBeNull();
    expect(media({ prio_1: true }).querySelector('.sourcing-avatar__dot')).toBeNull();
  });

  it('zeigt Kunden und Vorschlaegen keinen Punkt', () => {
    expect(media({ creator_id: 'c1' }, { isKunde: true }).querySelector('.sourcing-avatar__dot')).toBeNull();
    expect(media({ isVorschlag: true, creator_id: 'c1', prio_1: true, zusage: true })
      .querySelector('.sourcing-avatar__dot')).toBeNull();
  });

  it('streicht die alte Bild-Spalte aus gespeicherten hidden_columns', () => {
    expect(migrateHiddenColumns(['cp-col-bild', 'cp-col-mail'])).toEqual(['cp-col-mail']);
  });
});

describe('Sourcing – Sticky-Positionen', () => {
  it('setzt intern den Namen auf Position 2 hinter die Checkbox', () => {
    expect(getStickyClasses(baseCtx())).toEqual({ name: 'col-sticky-2' });
  });

  it('rueckt in der Kundenansicht ohne Drag-Spalte auf Position 1', () => {
    expect(getStickyClasses(baseCtx({ isKunde: true }))).toEqual({ name: 'col-sticky-1' });
  });

  it('rueckt auch fuer view-only Interne ohne Drag-Spalte auf Position 1', () => {
    expect(getStickyClasses(baseCtx({ canEdit: false }))).toEqual({ name: 'col-sticky-1' });
  });

  it('vergibt die Klassen in Kopf und Zeile identisch', () => {
    const doc = tableDoc([{ id: 'i1' }]);

    expect(doc.querySelector('thead th.cp-col-name').classList.contains('col-sticky-2')).toBe(true);
    expect(doc.querySelector('tbody td.cp-col-name').classList.contains('col-sticky-2')).toBe(true);
    expect(doc.querySelector('.cp-col-bild')).toBeNull();
  });
});
