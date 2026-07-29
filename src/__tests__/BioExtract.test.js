import { describe, it, expect } from 'vitest';
import {
  extractEmail,
  extractPhone,
  extractCity
} from '../../netlify/functions/_shared/bio-extract.js';

describe('extractEmail', () => {
  it('findet eine Adresse mitten in der Bio', () => {
    expect(extractEmail('Booking: hallo@creator.de | Reels & UGC'))
      .toBe('hallo@creator.de');
  });

  it('normalisiert auf Kleinschreibung', () => {
    expect(extractEmail('KONTAKT: Hallo@Creator.DE')).toBe('hallo@creator.de');
  });

  it('nimmt die erste von mehreren Adressen', () => {
    expect(extractEmail('booking@a.de oder privat@b.de')).toBe('booking@a.de');
  });

  it('loest (at)/(dot)-Verschleierung auf', () => {
    expect(extractEmail('kontakt (at) creator (dot) de')).toBe('kontakt@creator.de');
    expect(extractEmail('kontakt [at] creator.de')).toBe('kontakt@creator.de');
    expect(extractEmail('kontakt at creator.de')).toBe('kontakt@creator.de');
  });

  it('erkennt Adressen mit Punkt und Plus im lokalen Teil', () => {
    expect(extractEmail('max.mustermann+ig@agentur-xy.com'))
      .toBe('max.mustermann+ig@agentur-xy.com');
  });

  it('liefert null ohne Adresse', () => {
    expect(extractEmail('Content Creator aus Berlin')).toBeNull();
    expect(extractEmail('')).toBeNull();
    expect(extractEmail(null)).toBeNull();
  });

  it('faellt nicht auf einen Instagram-Handle herein', () => {
    expect(extractEmail('Kooperation via @meineagentur')).toBeNull();
  });
});

describe('extractPhone', () => {
  it('findet internationale Nummern', () => {
    expect(extractPhone('WhatsApp +49 170 1234567')).toBe('+49 170 1234567');
  });

  it('findet nationale Nummern mit fuehrender Null', () => {
    expect(extractPhone('Tel 0170 1234567')).toBe('0170 1234567');
  });

  it('normalisiert 00 zu Plus und raeumt Trennzeichen auf', () => {
    expect(extractPhone('0049 (170) 123-4567')).toBe('+49 170 123 4567');
  });

  it('ignoriert Ziffern aus E-Mails und Domains', () => {
    expect(extractPhone('kontakt@agentur24seven.de')).toBeNull();
    expect(extractPhone('shop: https://link.de/0123456789')).toBeNull();
  });

  it('ignoriert zu kurze und zu lange Ziffernfolgen', () => {
    expect(extractPhone('Rabattcode SAVE20 – 0123456')).toBeNull();
    expect(extractPhone('+4917012345678901234')).toBeNull();
  });

  it('ignoriert Jahres- und Follower-Zahlen', () => {
    expect(extractPhone('Seit 2019 dabei, 250000 Follower')).toBeNull();
  });

  it('liefert null ohne Nummer', () => {
    expect(extractPhone('Fitness Coach aus Hamburg')).toBeNull();
    expect(extractPhone(null)).toBeNull();
  });
});

describe('extractCity', () => {
  it('erkennt eine Stadt hinter dem Pin-Emoji', () => {
    expect(extractCity('Food Creator \u{1F4CD} Hamburg')).toBe('Hamburg');
  });

  it('erkennt eine Stadt ohne Marker', () => {
    expect(extractCity('Mama & Creator aus München')).toBe('München');
  });

  it('mappt englische Schreibweisen auf den deutschen Namen', () => {
    expect(extractCity('based in Munich')).toBe('München');
    expect(extractCity('Vienna based creator')).toBe('Wien');
    expect(extractCity('Living in Cologne')).toBe('Köln');
  });

  it('kommt mit Umlauten an der Wortgrenze klar', () => {
    expect(extractCity('\u{1F4CD} Zürich')).toBe('Zürich');
    expect(extractCity('Osnabrück | Lifestyle')).toBe('Osnabrück');
  });

  it('nimmt bei mehreren Staedten die erstgenannte', () => {
    expect(extractCity('Berlin & Hamburg')).toBe('Berlin');
  });

  it('akzeptiert mehrdeutige Namen nur mit Marker', () => {
    expect(extractCity('Ich liebe gutes Essen und Kaffee')).toBeNull();
    expect(extractCity('\u{1F4CD} Essen')).toBe('Essen');
  });

  it('laesst sich von einer Stadt im Wortinneren nicht taeuschen', () => {
    expect(extractCity('Berliner Luft Rezepte')).toBeNull();
  });

  it('bevorzugt den Abschnitt hinter dem Marker', () => {
    expect(extractCity('Rezepte aus aller Welt \u{1F4CD} Leipzig')).toBe('Leipzig');
  });

  it('liefert null ohne Ortsangabe', () => {
    expect(extractCity('UGC Creator & Model')).toBeNull();
    expect(extractCity(null)).toBeNull();
  });
});
