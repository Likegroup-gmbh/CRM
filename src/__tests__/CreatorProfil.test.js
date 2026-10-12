import { describe, it, expect } from 'vitest';
import {
  groesseFromCount,
  groesseOf,
  generationOf,
  ageLabel,
  matchesTokens,
  searchTokens,
  rankByName,
  normalizeFirmenname,
  sanitizeCreatorWrite
} from '../modules/creator/creatorProfil.js';

describe('Größe', () => {
  it('grenzt die Briefing-Bänder', () => {
    expect(groesseFromCount(0)).toBe('Nano');
    expect(groesseFromCount(9999)).toBe('Nano');
    expect(groesseFromCount(10000)).toBe('Micro');
    expect(groesseFromCount(100000)).toBe('Mid-Tier');
    expect(groesseFromCount(500000)).toBe('Macro');
    expect(groesseFromCount(1000000)).toBe('Hero');
    expect(groesseFromCount(null)).toBeNull();
    expect(groesseFromCount('10000-25000')).toBeNull();
  });

  it('nimmt bei Gleichstand Instagram und erlaubt die gesetzte Plattform', () => {
    expect(groesseOf({ instagram_follower: 20000, tiktok_follower: 20000 })).toBe('Micro');
    expect(groesseOf({ instagram_follower: 20000, tiktok_follower: 800000, hauptplattform: 'instagram' })).toBe('Micro');
    expect(groesseOf({ instagram_follower: 5000, tiktok_follower: 120000 })).toBe('Mid-Tier');
  });
});

describe('Generation', () => {
  it('liest die Generation aus dem Geburtsdatum', () => {
    expect(generationOf({ geburtsdatum: '1999-04-02', geschlecht: 'weiblich' })).toBe('Generation Z');
    expect(generationOf({ geburtsdatum: '2010-01-01', geschlecht: 'männlich' })).toBe('Generation Alpha');
    expect(generationOf({ geburtsdatum: '1920-01-01', geschlecht: 'divers' })).toBeNull();
  });

  it('nimmt die gesetzte Generation vor dem Geburtsdatum', () => {
    expect(generationOf({
      geburtsdatum: '1999-04-02',
      geschlecht: 'weiblich',
      generation_override: 'Millennials'
    })).toBe('Millennials');
    expect(generationOf({
      geburtsdatum: '1999-04-02',
      geschlecht: 'paar',
      generation_override: 'Millennials'
    })).toBeNull();
  });

  it('gibt Paar, Familie und Tier-Account keine Generation', () => {
    expect(generationOf({ geburtsdatum: '1999-04-02', geschlecht: 'paar' })).toBeNull();
    expect(generationOf({ geburtsdatum: '1999-04-02', geschlecht: 'Familie' })).toBeNull();
    expect(generationOf({ geburtsdatum: '2015-01-01', geschlecht: 'tier' })).toBeNull();
  });

  it('zeigt bei einer Person das Alter aus dem Datum', () => {
    expect(ageLabel({ geschlecht: 'weiblich', geburtsdatum: '2000-01-01' }, new Date('2026-10-02'))).toBe('26 Jahre');
    expect(ageLabel({ geschlecht: 'paar', alter_min: 25, alter_max: 30 })).toBe('25–30 Jahre');
  });
});

describe('Namenssuche', () => {
  const tanjaAlina = { vorname: 'Tanja', nachname: 'Alina', instagram: 'tanjaalina' };
  const tanjaAngst = { vorname: 'Tanja', nachname: 'Angst', instagram: '@tanja.angst' };
  const tanjaMueller = { vorname: 'Tanja', nachname: 'Müller', mail: 'angst@example.com' };

  it('trifft jedes Wort als Präfix, ohne Mail', () => {
    const tokens = searchTokens('Tanja A');
    expect(matchesTokens(tanjaAlina, tokens)).toBe(true);
    expect(matchesTokens(tanjaAngst, tokens)).toBe(true);
    expect(matchesTokens(tanjaMueller, tokens)).toBe(false);
    expect(matchesTokens({ vorname: 'Max', instagram: '@TanjaA' }, searchTokens('@tanja'))).toBe(true);
  });

  it('sortiert den besten Treffer nach oben', () => {
    const ranked = rankByName([tanjaMueller, tanjaAngst, tanjaAlina], 'Tanja Angst');
    expect(ranked[0].nachname).toBe('Angst');
  });
});

describe('Schreiben', () => {
  it('normalisiert den Firmennamen und löscht das Datum bei Accounts', () => {
    expect(normalizeFirmenname('  Like  Base ')).toBe('like base');
    expect(sanitizeCreatorWrite({ geschlecht: 'tier', geburtsdatum: '2015-01-01' }).geburtsdatum).toBeNull();
    expect(sanitizeCreatorWrite({ geschlecht: 'weiblich', alter_min: 20, alter_max: 25 }).alter_min).toBeNull();
    expect(sanitizeCreatorWrite({ geschlecht: 'paar', alter_min: 20, geburtsdatum: '1990-01-01' }).alter_min).toBe(20);
    expect(sanitizeCreatorWrite({ telefon_nicht_vorhanden: true, telefonnummer: '' }).telefonnummer).toBeNull();
    expect(sanitizeCreatorWrite({
      geschlecht: 'weiblich',
      geburtsdatum: '1999-04-02',
      generation_override: 'Generation Z'
    }).generation_override).toBeNull();
    expect(sanitizeCreatorWrite({
      geschlecht: 'weiblich',
      geburtsdatum: '1999-04-02',
      generation_override: 'Millennials'
    }).generation_override).toBe('Millennials');
    expect(sanitizeCreatorWrite({ geschlecht: 'weiblich', rezension_schnitt: 4.5 }).rezension_schnitt).toBeUndefined();
  });
});
