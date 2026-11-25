import { describe, it, expect, beforeEach } from 'vitest';
import { renderCreatorInner } from '../modules/kampagne/videoTableKoopCells.js';
import { renderVideoTypInner } from '../modules/kampagne/videoTableFieldCells.js';
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
    const img = doc.querySelector('.table-identity .table-identity__media img.table-avatar-img');
    expect(img.getAttribute('src')).toBe('https://cdn/thumb.avif');
  });

  it('nimmt das Hauptbild, wenn kein Thumb existiert', () => {
    const doc = zelle({ id: 'c1', vorname: 'Mia', profilbild_url: 'https://cdn/gross.avif' });
    expect(doc.querySelector('img.table-avatar').getAttribute('src')).toBe('https://cdn/gross.avif');
  });

  it('zeigt ohne Bild den Initial des Vornamens', () => {
    const doc = zelle({ id: 'c1', vorname: 'mia', nachname: 'Muster' });
    expect(doc.querySelector('span.table-avatar').textContent).toBe('M');
  });

  it('stellt Name-Link und Socials rechts neben das Bild', () => {
    const doc = zelle({ id: 'c1', vorname: 'Mia', nachname: 'Muster', instagram: '@mia' });
    const identitaet = doc.querySelector('.table-identity');
    expect(identitaet.firstElementChild.classList.contains('table-identity__media')).toBe(true);
    const text = identitaet.querySelector('.table-identity__text');
    expect(text.querySelector('a.table-link.verknuepfung-pill').textContent.trim()).toBe('Mia Muster');
    expect(text.querySelector('.creator-social-links')).not.toBeNull();
  });

  it('zeigt ohne zugeordneten Creator kein Bild', () => {
    const doc = zelle({});
    expect(doc.querySelector('.table-avatar')).toBeNull();
    expect(doc.querySelector('.table-identity__text').textContent).toBe('Unbekannt');
  });
});

describe('Kooperationen-Tabelle: Typ als Badge', () => {
  const typ = (video) => new DOMParser().parseFromString(renderVideoTypInner(video), 'text/html');

  it('zeigt die Kampagnenart als Tag', () => {
    expect(typ({ kampagnenart: 'UGC' }).querySelector('.tag.tag--kampagne-art').textContent).toBe('UGC');
  });

  it('zeigt ohne Kampagnenart nur den Strich', () => {
    const doc = typ({});
    expect(doc.querySelector('.tag')).toBeNull();
    expect(doc.querySelector('.video-typ-text').textContent).toBe('—');
  });
});
