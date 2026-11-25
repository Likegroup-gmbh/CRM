import { describe, it, expect } from 'vitest';
import {
  OHNE_LINIE,
  filterListe,
  kalenderEintraege,
  linieFarbe,
  mitPostingDatum
} from '../modules/video-browser/videoBrowserKalenderData.js';

const koop = (id, { produktion = 'p1', linie = 'l1', linieName = 'Herbst', vorname = 'Lea', nachname = 'Berg' } = {}) => ({
  id,
  name: `Koop ${id}`,
  produktion_id: produktion,
  briefing_id: linie,
  kampagne_id: 'k1',
  creator: { vorname, nachname },
  linie: linie ? { id: linie, aktivierung_name: linieName } : null
});

const video = (id, k, { position = 1, posting = null, titel = '', thema = '', created = '2026-10-01' } = {}) => ({
  id, kooperation_id: k.id, position, titel, thema, video_name: '', posting_datum: posting, created_at: created, kooperation: k
});

const lea = koop('ka');
const max = koop('kb', { linie: 'l2', linieName: 'Winter', vorname: 'Max', nachname: 'Adler' });
const alt = koop('kc', { linie: null, vorname: 'Zoe', nachname: '' });
const fremd = koop('kd', { produktion: 'p2', vorname: 'Anna', nachname: 'Fremd' });

const ROWS = [
  video('v1', lea, { position: 1, posting: '2026-11-20', titel: 'Herbst-Look' }),
  video('v2', lea, { position: 2 }),
  video('v3', max, { position: 1, posting: '2026-11-18' }),
  video('v4', max, { position: 2, thema: 'Unboxing' }),
  video('v5', alt, { position: null, posting: '2026-11-18T00:00:00' }),
  video('v6', fremd, { position: 1 })
];

const ids = (list) => list.map(e => e.id);

describe('Kalender im Videos-Tab: Einträge', () => {
  it('zeigt bei Gesamte Kampagne alle Produktionen', () => {
    const { events, ohneDatum } = kalenderEintraege(ROWS, { umfang: 'kampagne', produktionId: 'p1', linieId: 'l1' });
    expect(ids(events)).toEqual(['v3', 'v5', 'v1']);
    expect(ids(ohneDatum)).toEqual(['v6', 'v2', 'v4']);
  });

  it('grenzt auf die Produktion ein, wenn keine Linie gewählt ist', () => {
    const { events, ohneDatum } = kalenderEintraege(ROWS, { umfang: 'auswahl', produktionId: 'p1', linieId: null });
    expect(ids(events)).toEqual(['v3', 'v5', 'v1']);
    expect(ids(ohneDatum)).toEqual(['v2', 'v4']);
  });

  it('nimmt bei einer Linie auch Kooperationen ohne Linie mit', () => {
    const { events, ohneDatum } = kalenderEintraege(ROWS, { umfang: 'auswahl', produktionId: 'p1', linieId: 'l1' });
    expect(ids(events)).toEqual(['v5', 'v1']);
    expect(ids(ohneDatum)).toEqual(['v2']);
  });

  it('beschriftet Karten mit Creator und Video-Nummer, der Titel steht im Tooltip', () => {
    const { events } = kalenderEintraege(ROWS, { umfang: 'kampagne' });
    expect(events.find(e => e.id === 'v1')).toMatchObject({
      date: '2026-11-20', title: 'Lea Berg', sub: 'Video 1', tooltip: 'Herbst-Look', draggable: true
    });
    // Ohne Position zählt der Rang in der Kooperation, ohne Nachnamen nur der Vorname
    expect(events.find(e => e.id === 'v5')).toMatchObject({ date: '2026-11-18', title: 'Zoe', sub: 'Video 1' });
  });

  it('nennt in der Liste Linie und Farbe, ohne Linie grau', () => {
    const { ohneDatum } = kalenderEintraege(ROWS, { umfang: 'kampagne' });
    const v4 = ohneDatum.find(e => e.id === 'v4');
    expect(v4).toMatchObject({ creator: 'Max Adler', label: 'Video 2', titel: 'Unboxing' });
    expect(v4.linie).toEqual({ id: 'l2', name: 'Winter', farbe: linieFarbe('l2') });
    const ohne = kalenderEintraege([video('x', alt)], { umfang: 'kampagne' }).ohneDatum[0];
    expect(ohne.linie).toEqual({ id: null, name: OHNE_LINIE, farbe: 'var(--gray-400)' });
  });

  it('vergibt Linienfarben stabil über die ID', () => {
    expect(linieFarbe('l1')).toBe(linieFarbe('l1'));
    expect(linieFarbe('l1')).toMatch(/^var\(--/);
  });

  it('sucht in Creator, Titel und Thema', () => {
    const { ohneDatum } = kalenderEintraege(ROWS, { umfang: 'kampagne' });
    expect(ids(filterListe(ohneDatum, 'unbox'))).toEqual(['v4']);
    expect(ids(filterListe(ohneDatum, '  ADLER '))).toEqual(['v4']);
    expect(ids(filterListe(ohneDatum, ''))).toEqual(['v6', 'v2', 'v4']);
    expect(filterListe(ohneDatum, 'gibtsnicht')).toEqual([]);
  });

  it('setzt und entfernt das Posting-Datum eines Videos, ohne die anderen anzufassen', () => {
    const gesetzt = mitPostingDatum(ROWS, 'v2', '2026-11-25');
    expect(gesetzt.find(r => r.id === 'v2').posting_datum).toBe('2026-11-25');
    expect(gesetzt.find(r => r.id === 'v1')).toBe(ROWS[0]);
    expect(mitPostingDatum(gesetzt, 'v2', null).find(r => r.id === 'v2').posting_datum).toBeNull();
  });
});
