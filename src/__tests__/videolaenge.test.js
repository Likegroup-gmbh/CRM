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
  videolaengeFuerStufe,
  funnelIntervall,
  funnelMapAusFormData,
  funnelFormDataAusMap,
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

describe('Videolänge je Funnel-Stufe', () => {
  const paid = {
    bereich: 'paid_creator_ads',
    videolaenge_von: 15,
    videolaenge_bis: 20,
    videolaenge_funnel: { upper: { von: 6, bis: 10 }, lower: { von: 30, bis: 45 } }
  };

  it('nimmt bei Paid das Intervall der Stufe', () => {
    expect(videolaengeFuerStufe(paid, 'upper')).toEqual({ von: 6, bis: 10 });
    expect(videolaengeFuerStufe(paid, 'lower')).toEqual({ von: 30, bis: 45 });
  });

  it('fällt ohne Stufe, ohne Intervall der Stufe und ohne Spalte auf das allgemeine zurück', () => {
    expect(videolaengeFuerStufe(paid, null)).toEqual({ von: 15, bis: 20 });
    expect(videolaengeFuerStufe(paid, 'mid')).toEqual({ von: 15, bis: 20 });
    expect(videolaengeFuerStufe({ ...paid, videolaenge_funnel: null }, 'upper')).toEqual({ von: 15, bis: 20 });
  });

  it('kennt nur upper/mid/lower: der Skript-Schlüssel trifft nichts', () => {
    expect(videolaengeFuerStufe(paid, 'top')).toEqual({ von: 15, bis: 20 });
    expect(videolaengeFuerStufe(paid, 'bottom')).toEqual({ von: 15, bis: 20 });
    expect(funnelIntervall(paid.videolaenge_funnel, 'top')).toBe(null);
  });

  it('Organic und Influencer ignorieren die Map', () => {
    expect(videolaengeFuerStufe({ ...paid, bereich: 'owned_social' }, 'upper')).toEqual({ von: 15, bis: 20 });
    expect(videolaengeFuerStufe({ ...paid, bereich: 'influencer_marketing' }, 'lower')).toEqual({ von: 15, bis: 20 });
  });

  it('ohne beides ist keine Videolänge vorgegeben', () => {
    expect(videolaengeFuerStufe({ bereich: 'paid_creator_ads', videolaenge_funnel: { mid: { von: 9, bis: 3 } } }, 'upper')).toBe(null);
    expect(videolaengeFuerStufe(null, 'upper')).toBe(null);
  });

  it('funnelMapAusFormData nimmt nur angehakte Stufen mit Intervall', () => {
    const formData = {
      videolaenge_funnel_upper: { von: 6, bis: 10 },
      videolaenge_funnel_mid: { von: 12, bis: 14 },
      videolaenge_funnel_lower: null
    };
    expect(funnelMapAusFormData(formData, ['upper', 'lower'])).toEqual({ upper: { von: 6, bis: 10 } });
    expect(funnelMapAusFormData(formData, [])).toBe(null);
    expect(funnelMapAusFormData(formData, null)).toBe(null);
  });

  it('funnelFormDataAusMap übersetzt zurück in die Formularfelder', () => {
    expect(funnelFormDataAusMap({ mid: { von: 12, bis: 14 }, quatsch: { von: 1, bis: 2 } }))
      .toEqual({ videolaenge_funnel_mid: { von: 12, bis: 14 } });
    expect(funnelFormDataAusMap(null)).toEqual({});
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
