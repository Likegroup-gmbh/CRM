import { describe, it, expect, beforeEach } from 'vitest';
import { renderCreatorInner } from '../modules/kampagne/videoTableKoopCells.js';
import { CREATOR_SELECT } from '../modules/kampagne/videoTableQueries.js';

function zelle(creator, extra = {}) {
  const html = renderCreatorInner({ creator, canViewCreator: true, ...extra });
  return new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
}

beforeEach(() => {
  window.validatorSystem = { sanitizeUrl: (url) => url };
});

describe('Kooperationen-Tabelle: Creator-Profilbild', () => {
  it('laedt die Profilbild-Felder mit', () => {
    expect(CREATOR_SELECT).toContain('profilbild_url');
    expect(CREATOR_SELECT).toContain('profilbild_thumb_url');
  });

  it('bevorzugt das Thumb vor dem Hauptbild', () => {
    const doc = zelle({
      id: 'c1', vorname: 'Mia', nachname: 'Muster',
      profilbild_url: 'https://cdn/gross.avif',
      profilbild_thumb_url: 'https://cdn/thumb.avif'
    });
    const img = doc.querySelector('.koop-creator-cell img.koop-creator-avatar');
    expect(img.getAttribute('src')).toBe('https://cdn/thumb.avif');
    expect(img.getAttribute('alt')).toBe('Mia Muster');
  });

  it('nimmt das Hauptbild, wenn kein Thumb existiert', () => {
    const doc = zelle({ id: 'c1', vorname: 'Mia', profilbild_url: 'https://cdn/gross.avif' });
    expect(doc.querySelector('img.koop-creator-avatar').getAttribute('src')).toBe('https://cdn/gross.avif');
  });

  it('zeigt ohne Bild den Initial des Vornamens', () => {
    const doc = zelle({ id: 'c1', vorname: 'mia', nachname: 'Muster' });
    expect(doc.querySelector('span.koop-creator-avatar').textContent).toBe('M');
  });

  it('behaelt Name-Link und Socials neben dem Bild', () => {
    const doc = zelle({ id: 'c1', vorname: 'Mia', nachname: 'Muster', instagram: '@mia' });
    const text = doc.querySelector('.koop-creator-cell .koop-creator-text');
    expect(text.querySelector('a.table-link').textContent).toBe('Mia Muster');
    expect(text.querySelector('.creator-social-links')).not.toBeNull();
  });

  it('zeigt ohne zugeordneten Creator kein Bild', () => {
    const doc = zelle({});
    expect(doc.querySelector('.koop-creator-avatar')).toBeNull();
    expect(doc.querySelector('.koop-creator-text').textContent).toBe('Unbekannt');
  });
});
