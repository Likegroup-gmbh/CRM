import { describe, it, expect } from 'vitest';
import {
  DEFAULT_KALENDER,
  kalenderFromSearch,
  kalenderToSearch,
  showcaseFromSearch,
  showcaseToSearch
} from '../modules/video-browser/videoBrowserSelection.js';

describe('Kalender im Videos-Tab: URL', () => {
  it('lässt Standardwerte weg und liest sie wieder als Standard', () => {
    const qs = kalenderToSearch('?k=1', { ...DEFAULT_KALENDER });
    expect(qs).toBe('?k=1&ansicht=kalender');
    expect(kalenderFromSearch(qs)).toEqual(DEFAULT_KALENDER);
  });

  it('schreibt Umfang, Modus und Datum und liest sie zurück', () => {
    const state = { umfang: 'kampagne', modus: 'woche', datum: '2026-11-16' };
    const qs = kalenderToSearch('', state);
    expect(kalenderFromSearch(qs)).toEqual(state);
  });

  it('fällt bei unbekannten Werten auf den Standard zurück', () => {
    expect(kalenderFromSearch('?ansicht=kalender&umfang=alles&modus=jahr&datum=morgen')).toEqual(DEFAULT_KALENDER);
    expect(kalenderFromSearch('?ansicht=showcase')).toBeNull();
  });

  it('räumt beim Verlassen auf und lässt den Showcase stehen', () => {
    const kalender = kalenderToSearch('?k=1', { umfang: 'kampagne', modus: 'woche', datum: '2026-11-16' });
    expect(kalenderToSearch(kalender, null)).toBe('?k=1');

    const showcase = showcaseToSearch('', { inhalt: 'final', group: 'creator', status: 'alle', size: 'M', typ: null, tag: null });
    const beide = kalenderToSearch(showcase, null);
    expect(showcaseFromSearch(beide)).not.toBeNull();
    expect(kalenderFromSearch(beide)).toBeNull();
  });

  it('überschreibt eine Showcase-URL, wenn der Kalender offen ist', () => {
    const showcase = showcaseToSearch('', { inhalt: 'final', group: 'creator', status: 'alle', size: 'M', typ: null, tag: null });
    const qs = kalenderToSearch(showcaseToSearch(showcase, null), { ...DEFAULT_KALENDER, umfang: 'kampagne' });
    expect(showcaseFromSearch(qs)).toBeNull();
    expect(kalenderFromSearch(qs)).toMatchObject({ umfang: 'kampagne' });
  });
});
