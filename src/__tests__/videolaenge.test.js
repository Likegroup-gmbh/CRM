import { describe, it, expect } from 'vitest';
import {
  anzeigeWert,
  clampSekunde,
  commitZahl,
  formatVideolaenge,
  formatVideoLaengeSchluessel,
  sekundeAnPosition,
  skriptSchluessel,
  spreize,
  videolaengeAusAlt,
  videolaengeAusBriefing,
  zieheGriff
} from '../modules/briefing/videolaenge.js';

describe('clampSekunde', () => {
  it('klemmt auf 1–180 und rundet', () => {
    expect(clampSekunde(0)).toBe(1);
    expect(clampSekunde(1)).toBe(1);
    expect(clampSekunde(8.4)).toBe(8);
    expect(clampSekunde(8.6)).toBe(9);
    expect(clampSekunde(180)).toBe(180);
    expect(clampSekunde(200)).toBe(180);
    expect(clampSekunde('12')).toBe(12);
  });

  it('liefert null bei Text ohne Zahl', () => {
    expect(clampSekunde('abc')).toBe(null);
    expect(clampSekunde(NaN)).toBe(null);
  });
});

describe('formatVideolaenge / skriptSchluessel', () => {
  it('zeigt eine Sekunde oder eine Spanne', () => {
    expect(formatVideolaenge(15, 15)).toBe('15 Sek.');
    expect(formatVideolaenge(8, 17)).toBe('8–17 Sek.');
    expect(formatVideolaenge(null, 4)).toBe(null);
  });

  it('schreibt den Skript-Schlüssel mit Bindestrich', () => {
    expect(skriptSchluessel(8, 17)).toBe('8-17');
    expect(skriptSchluessel(12, 12)).toBe('12-12');
    expect(skriptSchluessel(null, 12)).toBe(null);
  });

  it('formatiert neue Schlüssel und lässt alte Eimer unter 1 Sekunde roh', () => {
    expect(formatVideoLaengeSchluessel('8-17')).toBe('8–17 Sek.');
    expect(formatVideoLaengeSchluessel('15-15')).toBe('15 Sek.');
    expect(formatVideoLaengeSchluessel('0-15')).toBe('0-15');
  });
});

describe('videolaengeAusAlt', () => {
  it('nimmt konkrete Tokens von der kleinsten bis zur größten Sekunde', () => {
    expect(videolaengeAusAlt({ videolaengen: ['15s', '60s'] })).toEqual({ von: 15, bis: 60 });
    expect(videolaengeAusAlt({ videolaengen: ['30s'] })).toEqual({ von: 30, bis: 30 });
  });

  it('fällt auf die nächste Quelle, wenn die vorherige keine Sekunde hat', () => {
    expect(videolaengeAusAlt({
      videolaengen: ['individuell'],
      pa_videolaengen: ['agenturempfehlung'],
      videolaenge_text: '30–60 Sek.'
    })).toEqual({ von: 30, bis: 60 });
    expect(videolaengeAusAlt({
      videolaenge_text: 'so lang wie nötig',
      formatText: 'max. 45'
    })).toEqual({ von: 45, bis: 45 });
  });

  it('klemmt und lässt Unlesbares leer', () => {
    expect(videolaengeAusAlt({ videolaenge_text: '200' })).toEqual({ von: 180, bis: 180 });
    expect(videolaengeAusAlt({ videolaengen: ['individuell', 'agenturempfehlung'] })).toBe(null);
    expect(videolaengeAusAlt({ videolaenge_text: 'offen' })).toBe(null);
  });

  it('bevorzugt videolaengen vor pa_videolaengen', () => {
    expect(videolaengeAusAlt({
      videolaengen: ['10s'],
      pa_videolaengen: ['60s']
    })).toEqual({ von: 10, bis: 10 });
  });
});

describe('videolaengeAusBriefing / anzeigeWert', () => {
  it('nimmt gespeicherte Spalten vor dem Altbestand', () => {
    const briefing = {
      videolaenge_von: 8,
      videolaenge_bis: 17,
      videolaengen: ['60s']
    };
    expect(videolaengeAusBriefing(briefing)).toEqual({ von: 8, bis: 17 });
    expect(anzeigeWert(briefing)).toEqual({ art: 'intervall', von: 8, bis: 17 });
  });

  it('übersetzt im Editor und zeigt in der Ansicht die alten Tokens', () => {
    const briefing = { bereich: 'paid_creator_ads', videolaengen: ['15s', '30s'] };
    expect(videolaengeAusBriefing(briefing)).toEqual({ von: 15, bis: 30 });
    expect(anzeigeWert(briefing)).toEqual({ art: 'tokens', values: ['15s', '30s'] });
  });

  it('liest Formatvorgaben nur für Organic und Influencer', () => {
    expect(videolaengeAusBriefing({
      bereich: 'owned_social',
      os_formatvorgaben: { videolaenge: '12-14' }
    })).toEqual({ von: 12, bis: 14 });
    expect(anzeigeWert({
      bereich: 'influencer_marketing',
      im_formatvorgaben: { videolaenge: 'ca. 20' }
    })).toEqual({ art: 'text', text: 'ca. 20' });
  });
});

describe('Slider-Gesten', () => {
  it('legt die Sekunde über die Schiene', () => {
    expect(sekundeAnPosition(0)).toBe(1);
    expect(sekundeAnPosition(1)).toBe(180);
    expect(sekundeAnPosition(0.5)).toBe(91);
  });

  it('spreizt vom Klickpunkt und lässt Griffe nicht kreuzen', () => {
    expect(spreize(12, 14)).toEqual({ von: 12, bis: 14 });
    expect(spreize(12, 8)).toEqual({ von: 8, bis: 12 });
    expect(zieheGriff({ von: 8, bis: 17, seite: 'von', sekunde: 20 })).toEqual({ von: 17, bis: 17 });
    expect(zieheGriff({ von: 8, bis: 17, seite: 'bis', sekunde: 3 })).toEqual({ von: 8, bis: 8 });
  });

  it('spiegelt die andere Zahl nur, wenn sie leer ist, und leert bei leerem Feld', () => {
    expect(commitZahl({ von: null, bis: null, seite: 'von', roh: '12' })).toEqual({ von: 12, bis: 12 });
    expect(commitZahl({ von: 8, bis: 17, seite: 'von', roh: '12' })).toEqual({ von: 12, bis: 17 });
    expect(commitZahl({ von: 8, bis: 17, seite: 'bis', roh: '' })).toBe(null);
    expect(commitZahl({ von: 8, bis: 17, seite: 'von', roh: '200' })).toEqual({ von: 17, bis: 17 });
    expect(commitZahl({ von: 8, bis: 17, seite: 'von', roh: 'abc' })).toEqual({ von: 8, bis: 17 });
  });
});
