// IdeenSplit.test.js
// Fixtures sind gekuerzte Formen aus echten Briefings (Renewal Black Weeks,
// Shark, Liebherr, Telekom, Kenwood, Ninja).

import { describe, it, expect } from 'vitest';
import { splitIdeen, ideenListe } from '../modules/briefing/ideenSplit.js';

describe('splitIdeen', () => {
  it('trennt Bullets und verwirft die Ueberschrift davor', () => {
    expect(splitIdeen('UGC-Ideen:\n• Finanz-Hack statt Shopping-Hack\n• Mein bester Deal\n• Black Week vs. Reality'))
      .toEqual(['Finanz-Hack statt Shopping-Hack', 'Mein bester Deal', 'Black Week vs. Reality']);
  });

  it('trennt Bindestrich- und Nummernlisten, Folgezeilen gehoeren zur Idee', () => {
    expect(splitIdeen('1. 15-Minuten Feierabend-Küche: schnell\n2. No-Knife-Challenge: Meal Prep\nohne Schnippeln'))
      .toEqual(['15-Minuten Feierabend-Küche: schnell', 'No-Knife-Challenge: Meal Prep ohne Schnippeln']);
    expect(splitIdeen('- Eins\n- Zwei')).toEqual(['Eins', 'Zwei']);
  });

  it('trennt Absaetze', () => {
    expect(splitIdeen('Storyline Hundebesitzer: Code am Anfang.\n\nStoryline Couples: Mann im Hintergrund.'))
      .toEqual(['Storyline Hundebesitzer: Code am Anfang.', 'Storyline Couples: Mann im Hintergrund.']);
  });

  it('trennt reine Zeilenlisten ohne Marker', () => {
    expect(splitIdeen('Idee A\nIdee B\r\nIdee C')).toEqual(['Idee A', 'Idee B', 'Idee C']);
  });

  it('trennt Inline-Nummerierung (1) ... (2) ... in einer Zeile', () => {
    expect(splitIdeen('Stories: (1) Heiligabend = Peak. (2) Sommer-Party. (3) Brunch Time.'))
      .toEqual(['Heiligabend = Peak.', 'Sommer-Party.', 'Brunch Time.']);
  });

  it('laesst Inline-Klammern ohne lueckenlose Nummerierung in Ruhe', () => {
    const text = 'Variante (2) und (5) funktionieren am besten';
    expect(splitIdeen(text)).toEqual([text]);
  });

  it('schneidet nicht an Kommas und nicht an Dezimalzahlen', () => {
    expect(splitIdeen('Vorher-Nachher, Problem-Lösung in 20 Sekunden')).toEqual(['Vorher-Nachher, Problem-Lösung in 20 Sekunden']);
    expect(splitIdeen('1.5 Mio Views als Ziel')).toEqual(['1.5 Mio Views als Ziel']);
  });

  it('laesst eine einzelne Idee als einen Eintrag stehen', () => {
    expect(splitIdeen('Beispiel-Storyline: Vom letzten Abend sind Pommes übrig.'))
      .toEqual(['Beispiel-Storyline: Vom letzten Abend sind Pommes übrig.']);
  });

  it('gibt bei leer/null ein leeres Array', () => {
    expect(splitIdeen('')).toEqual([]);
    expect(splitIdeen('  \n ')).toEqual([]);
    expect(splitIdeen(null)).toEqual([]);
  });
});

describe('ideenListe', () => {
  it('teilt jedes Array-Element nochmal und ignoriert Nicht-Strings', () => {
    expect(ideenListe(['- A\n- B', 'C', null, 4])).toEqual(['A', 'B', 'C']);
  });

  it('akzeptiert einen String', () => {
    expect(ideenListe('- A\n- B')).toEqual(['A', 'B']);
  });
});
