import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { auswerten, reelAusItem, captionMentions } = require('../../netlify/functions/_shared/instagram-reels/ergebnis.js');

const ENV = { APIFY_TOKEN: 'tok' };
const STUNDE = 60 * 60 * 1000;
const vor = (stunden) => new Date(Date.parse('2026-11-27T12:00:00.000Z') - stunden * STUNDE).toISOString();

let nr = 0;
const item = (extra = {}) => {
  nr += 1;
  return {
    id: String(nr), shortCode: `S${nr}`, type: 'Video', productType: 'clips',
    ownerUsername: 'lea', ownerFullName: 'Lea', timestamp: vor(nr * 24),
    caption: 'Mein Tag heute', mentions: [], taggedUsers: [], sponsors: [], coauthorProducers: [],
    videoPlayCount: 200000, videoViewCount: 80000, likesCount: 5000, commentsCount: 120,
    displayUrl: 'https://scontent.cdninstagram.com/v/a.jpg', isPinned: false, paidPartnership: false,
    ...extra,
  };
};
const reel = (extra) => reelAusItem(item(extra), ENV);

describe('Instagram-Reels: Vorfilter', () => {
  it('Anzeige ohne Verlinkung bleibt drin und trägt den Marker', () => {
    const r = reel({ caption: 'Neues Serum ausprobiert #anzeige' });
    expect(r.filter).toBeNull();
    expect(r.werbung).toBe('#anzeige');
    expect(r.verlinkt).toEqual([]);
  });

  it('Anzeige mit @mention, Tag oder Sponsor fliegt raus', () => {
    expect(reel({ caption: 'Danke @brand #anzeige', mentions: ['brand'] }).filter).toBe('werbung_verlinkt');
    expect(reel({ caption: 'Danke @brand #werbung' }).filter).toBe('werbung_verlinkt');
    expect(reel({ caption: '#ad', taggedUsers: [{ username: 'brand' }] }).filter).toBe('werbung_verlinkt');
    const paid = reel({ paidPartnership: true, sponsors: [{ username: 'sephora' }] });
    expect(paid).toMatchObject({ filter: 'werbung_verlinkt', werbung: 'paid partnership', verlinkt: ['sephora'] });
  });

  it('eigener Account und E-Mail-Adressen zählen nicht als Verlinkung', () => {
    expect(reel({ caption: 'Folgt @lea #anzeige', mentions: ['lea'] }).filter).toBeNull();
    expect(reel({ caption: 'Anfragen an info@lea.de #anzeige' }).filter).toBeNull();
    expect(captionMentions('Hi @a.b. und x@y.de')).toEqual(['a.b']);
  });

  it('Mention ohne Werbung zählt mit', () => {
    expect(reel({ caption: 'Mit @freundin unterwegs', mentions: ['freundin'] }).filter).toBeNull();
  });

  it('Collab fliegt raus, auch ohne Werbung', () => {
    const r = reel({ coauthorProducers: [{ username: 'andere' }] });
    expect(r.filter).toBe('collab');
    expect(r.collab).toEqual(['andere']);
    expect(reel({ coauthorProducers: [{ username: 'lea' }] }).filter).toBeNull();
  });

  it('angepinnte Reels, Bilder und Reels ohne Views fliegen raus', () => {
    expect(reel({ isPinned: true }).filter).toBe('angepinnt');
    expect(reel({ type: 'Image', productType: 'feed' }).filter).toBe('kein_video');
    expect(reel({ videoPlayCount: null, videoViewCount: null }).filter).toBe('keine_views');
  });

  it('Views sind die Plays, Video-Views bleiben als Zusatzwert', () => {
    expect(reel({})).toMatchObject({ views: 200000, viewsAlt: 80000, kommentare: 120, likes: 5000 });
    expect(reel({ videoPlayCount: undefined }).views).toBe(80000);
  });

  it('Thumbnail läuft signiert über instagram-bild', () => {
    expect(reel({}).bild).toMatch(/^\/\.netlify\/functions\/instagram-bild\?u=https%3A%2F%2Fscontent/);
    expect(reel({ displayUrl: 'https://evil.com/a.jpg' }).bild).toBeNull();
  });
});

describe('Instagram-Reels: auswerten', () => {
  it('neueste zuerst, das neueste Reel (1 Stunde alt) bleibt Kandidat', () => {
    const alt = item({ timestamp: vor(200) });
    const frisch = item({ timestamp: vor(1) });
    const r = auswerten([alt, frisch, item({ isPinned: true })], ENV);
    expect(r.reels.map((x) => x.id)).toEqual([frisch.id, alt.id]);
    expect(r.gefiltert).toHaveLength(1);
    expect(r.profil).toEqual({ name: 'lea', vollName: 'Lea', url: 'https://www.instagram.com/lea/' });
  });

  it('trennt Fehler-Items und doppelte Reels', () => {
    const a = item();
    const r = auswerten([a, { ...a }, { error: 'no_items', errorDescription: 'Empty or private data', input: 'privat' }, null], ENV);
    expect(r.reels).toHaveLength(1);
    expect(r.fehler).toEqual([{ eingabe: 'privat', code: 'no_items', text: 'Empty or private data' }]);
  });
});
