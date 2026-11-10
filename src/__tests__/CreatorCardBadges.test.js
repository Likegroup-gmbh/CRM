// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderGroesseBadge, renderCreatorCard, renderCreatorZeile } from '../modules/creator/creatorCardRender.js';

afterEach(() => {
  delete window.currentUser;
});

function dom(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('renderGroesseBadge', () => {
  it('zeigt nur das Label, ohne Icon', () => {
    const el = dom(renderGroesseBadge('Mid-Tier'));
    expect(el.textContent).toBe('Mid-Tier');
    expect(el.querySelector('svg')).toBeNull();
  });

  it('ist leer ohne bekannte Groesse', () => {
    expect(renderGroesseBadge(null)).toBe('');
    expect(renderGroesseBadge('Unbekannt')).toBe('');
  });
});

describe('Creator-Karte', () => {
  const list = { sanitize: (v) => v, renderLocationTag: (v) => `<span>${v}</span>` };
  const creator = { id: 'c1', vorname: 'A', nachname: 'B', instagram_follower: 722000, favoriten: [] };

  it('legt Groesse und Favorit ins Bild, nicht in den Header', () => {
    const el = dom(renderCreatorCard(creator, list));
    expect(el.querySelector('.creator-card__media .creator-card__groesse')).not.toBeNull();
    expect(el.querySelector('.creator-card__media .creator-favorit')).not.toBeNull();
    expect(el.querySelector('.creator-card__actions .creator-favorit')).toBeNull();
  });

  it('Listen-Zeile behaelt den Favorit im Header', () => {
    const el = dom(renderCreatorZeile(creator));
    expect(el.querySelector('.creator-card__header .creator-favorit')).not.toBeNull();
    expect(el.querySelector('.creator-card__badges')).toBeNull();
  });
});
