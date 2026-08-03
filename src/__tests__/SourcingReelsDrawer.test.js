import { describe, it, expect, afterEach } from 'vitest';
import { SourcingReelsDrawer, sammleDrawerReels } from '../modules/creator-auswahl/SourcingReelsDrawer.js';
import { renderIgReelsButton, renderItemRow } from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';

function reel(permalink, views, tagen = 5, extra = {}) {
  return {
    permalink,
    views,
    timestamp: new Date(Date.now() - tagen * 24 * 60 * 60 * 1000).toISOString(),
    thumbnail_url: null,
    ...extra
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('sammleDrawerReels', () => {
  it('kombiniert verwendete und manuell ausgeschlossene Reels, neueste zuerst', () => {
    const reels = sammleDrawerReels({
      videos: [reel('https://ig/r/alt', 10000, 10), reel('https://ig/r/neu', 12000, 5)],
      skipped_videos: [
        { ...reel('https://ig/r/test', 999999, 7), reason: 'manually_excluded' },
        { ...reel('https://ig/r/frisch', 500, 1), reason: 'too_recent' }
      ]
    });

    expect(reels.map((r) => r.permalink)).toEqual([
      'https://ig/r/neu', 'https://ig/r/test', 'https://ig/r/alt'
    ]);
    expect(reels.find((r) => r.permalink === 'https://ig/r/test').excluded).toBe(true);
    expect(reels.find((r) => r.permalink === 'https://ig/r/neu').excluded).toBe(false);
  });

  it('liefert ohne ig_stats eine leere Liste', () => {
    expect(sammleDrawerReels(undefined)).toEqual([]);
    expect(sammleDrawerReels({})).toEqual([]);
  });
});

describe('SourcingReelsDrawer – Render', () => {
  function openDrawer(igStats) {
    const drawer = new SourcingReelsDrawer({
      item: { id: 'i1', name: 'Demo Creator', ig_stats: igStats },
      onSave: () => {}
    });
    drawer.open();
    return drawer;
  }

  it('rendert pro Reel Views, Link und Checkbox mit richtigem Zustand', () => {
    openDrawer({
      videos: [reel('https://ig/r/a', 12500, 5)],
      skipped_videos: [{ ...reel('https://ig/r/b', 999999, 7), reason: 'manually_excluded' }],
      excluded_media: ['https://ig/r/b']
    });

    const body = document.getElementById('sourcing-reels-drawer-body');
    const toggles = [...body.querySelectorAll('.reel-include-toggle')];

    expect(toggles).toHaveLength(2);
    expect(toggles.find((t) => t.dataset.permalink === 'https://ig/r/a').checked).toBe(true);
    expect(toggles.find((t) => t.dataset.permalink === 'https://ig/r/b').checked).toBe(false);
    expect(body.textContent).toContain('12.500');
    expect(body.querySelector('a[href="https://ig/r/a"]')).not.toBeNull();
  });

  it('zeigt ohne Videos einen Hinweis statt der Tabelle', () => {
    openDrawer({});

    const body = document.getElementById('sourcing-reels-drawer-body');
    expect(body.querySelector('.reel-include-toggle')).toBeNull();
    expect(body.textContent).toContain('Keine Reels vorhanden');
  });

  it('behält nicht angezeigte Ausschlüsse beim Auslesen bei', () => {
    const drawer = openDrawer({
      videos: [reel('https://ig/r/a', 12500, 5)],
      skipped_videos: [],
      excluded_media: ['https://ig/r/uralt']
    });

    const toggle = document.querySelector('.reel-include-toggle[data-permalink="https://ig/r/a"]');
    toggle.checked = false;

    expect(drawer.leseAusschluesse().sort()).toEqual(['https://ig/r/a', 'https://ig/r/uralt']);
  });

  it('nimmt wieder angehakte Reels aus der Ausschlussliste', () => {
    const drawer = openDrawer({
      videos: [],
      skipped_videos: [{ ...reel('https://ig/r/b', 999999, 7), reason: 'manually_excluded' }],
      excluded_media: ['https://ig/r/b']
    });

    const toggle = document.querySelector('.reel-include-toggle[data-permalink="https://ig/r/b"]');
    toggle.checked = true;

    expect(drawer.leseAusschluesse()).toEqual([]);
  });
});

describe('Sourcing – Reels-Auswahl-Button in der Tabelle', () => {
  it('erscheint nur, wenn Instagram-Daten mit Videos vorliegen', () => {
    expect(renderIgReelsButton({ id: 'i1' })).toBe('');
    expect(renderIgReelsButton({ id: 'i1', ig_stats: { videos: [] } })).toBe('');
    expect(renderIgReelsButton({ id: 'i1', ig_stats: { videos: [reel('https://ig/r/a', 1000)] } }))
      .toContain('data-ig-reels');
  });

  it('steht intern in der Zeile, für Kunden nicht', () => {
    const item = {
      id: 'i1',
      link_instagram: 'https://www.instagram.com/demo/',
      ig_stats: { videos: [reel('https://ig/r/a', 1000)] }
    };

    const intern = renderItemRow({ isKunde: false, hiddenColumns: [] }, item, 0);
    const kunde = renderItemRow({ isKunde: true, hiddenColumns: [] }, item, 0);

    expect(intern).toContain('data-ig-reels');
    expect(kunde).not.toContain('data-ig-reels');
  });
});
