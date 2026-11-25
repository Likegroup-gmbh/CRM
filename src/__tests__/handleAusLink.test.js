import { describe, it, expect } from 'vitest';
import { handleAusLink } from '../modules/creator-auswahl/CreatorAuswahlService.js';

describe('handleAusLink', () => {
  it('zieht den Handle aus einer Profil-URL', () => {
    expect(handleAusLink('https://www.instagram.com/max.muster/')).toBe('max.muster');
    expect(handleAusLink('https://www.tiktok.com/@maxtt?lang=de')).toBe('maxtt');
    expect(handleAusLink('instagram.com/foo_bar')).toBe('foo_bar');
  });

  it('akzeptiert auch nackte Handles', () => {
    expect(handleAusLink('@foo')).toBe('foo');
    expect(handleAusLink('bar')).toBe('bar');
  });

  it('liefert null bei leeren oder unbrauchbaren Werten', () => {
    expect(handleAusLink(null)).toBeNull();
    expect(handleAusLink('')).toBeNull();
    expect(handleAusLink('https://www.instagram.com/')).toBeNull();
  });
});
