import { describe, expect, it } from 'vitest';
import { formularAusTiktokVorschau, tiktokProfilHandle } from '../modules/creator/creatorTiktokPrefill.js';
import { linksZuordnen } from '../modules/creator/CreatorListFormStart.js';

const TT = 'https://www.tiktok.com/@kitchen.melda';

describe('tiktokProfilHandle', () => {
  it('liest den Handle aus Profil-, Video- und Share-Link sowie @handle', () => {
    expect(tiktokProfilHandle('https://www.tiktok.com/@Kitchen.Melda')).toBe('kitchen.melda');
    expect(tiktokProfilHandle('https://www.tiktok.com/@Jana.Fellice/video/7634987669591690528')).toBe('jana.fellice');
    expect(tiktokProfilHandle('https://www.tiktok.com/@angymkvb?_r=1&_t=ZG-98IoZ6RUrIm')).toBe('angymkvb');
    expect(tiktokProfilHandle('@Lea.M')).toBe('lea.m');
    expect(tiktokProfilHandle('lea_m')).toBe('lea_m');
  });

  it('lehnt Kurzlinks, fremde Links und ungültige Handles ab', () => {
    expect(tiktokProfilHandle('https://vm.tiktok.com/ZMabc123/')).toBeNull();
    expect(tiktokProfilHandle('https://www.instagram.com/lea/')).toBeNull();
    expect(tiktokProfilHandle('https://linktr.ee/lea')).toBeNull();
    expect(tiktokProfilHandle('a')).toBeNull();
    expect(tiktokProfilHandle('')).toBeNull();
  });
});

describe('formularAusTiktokVorschau', () => {
  const vorschau = (fields, username = 'kitchen.melda') => ({ username, fields });

  it('füllt Name, Kontakt, Stadt, Followerstufe und Profilbild', () => {
    expect(formularAusTiktokVorschau(TT, vorschau({
      name: 'Melda Yilmaz',
      email: 'melda@example.com',
      telefon: '+49 170 7654321',
      wohnort: 'Berlin',
      follower_tiktok: 93300,
      profile_image_url: 'https://cdn.example/m.avif',
      profile_image_thumb_url: 'https://cdn.example/m-thumb.avif'
    }))).toEqual({
      geladen: true,
      tiktok: 'kitchen.melda',
      vorname: 'Melda',
      nachname: 'Yilmaz',
      mail: 'melda@example.com',
      telefonnummer: '+49 170 7654321',
      lieferadresse_stadt: 'Berlin',
      tiktok_follower: '50000-100000',
      profilbild_url: 'https://cdn.example/m.avif',
      profilbild_thumb_url: 'https://cdn.example/m-thumb.avif'
    });
  });

  it('lässt einen Spitznamen ohne Vor- und Nachnamen leer', () => {
    const werte = formularAusTiktokVorschau(TT, vorschau({ name: 'Kitchen Melda 🍳 Rezepte' }));
    expect(werte.vorname).toBe('');
    expect(werte.nachname).toBe('');
    expect(werte.geladen).toBe(true);
  });

  it('nimmt bei einem fremden Profil nur den Handle', () => {
    expect(formularAusTiktokVorschau(TT, vorschau({ name: 'Bob Anders' }, 'bob'))).toMatchObject({
      geladen: false,
      tiktok: 'kitchen.melda',
      vorname: '',
      tiktok_follower: ''
    });
  });
});

describe('linksZuordnen', () => {
  it('baut Profil-URLs aus Links und Handles', () => {
    expect(linksZuordnen('https://instagram.com/Lea.M?igsh=abc', '@Kitchen.Melda')).toEqual({
      instagram: 'https://www.instagram.com/lea.m/',
      tiktok: TT,
      fehler: null
    });
    expect(linksZuordnen('@lea', '')).toEqual({ instagram: 'https://www.instagram.com/lea/', tiktok: null, fehler: null });
  });

  it('ordnet einen Link im falschen Feld seiner Plattform zu und kürzt Video-Links', () => {
    expect(linksZuordnen('https://www.tiktok.com/@kitchen.melda/video/7634987669591690528', 'https://www.instagram.com/lea/'))
      .toEqual({ instagram: 'https://www.instagram.com/lea/', tiktok: TT, fehler: null });
  });

  it('meldet zwei Links derselben Plattform, Beiträge, Kurzlinks und leere Eingaben', () => {
    expect(linksZuordnen(TT, 'https://www.tiktok.com/@andere').fehler).toBe('Zwei TikTok-Links eingetragen');
    expect(linksZuordnen('https://www.instagram.com/reel/DWtx7hWjFuH/', '').fehler).toMatch(/Profil-Link/);
    expect(linksZuordnen('', 'https://vm.tiktok.com/ZMabc123/').fehler).toMatch(/Kurzlinks/);
    expect(linksZuordnen('https://linktr.ee/lea', '').fehler).toMatch(/kein Profil-Link/);
    expect(linksZuordnen(' ', '').fehler).toMatch(/Mindestens einen Link/);
  });
});
