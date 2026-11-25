import { describe, expect, it } from 'vitest';
import { formularAusInstagramVorschau, followerZumSpeichern } from '../modules/creator/creatorInstagramPrefill.js';

const link = 'https://www.instagram.com/anna.schmidt/';

function vorschau(fields, username = 'anna.schmidt') {
  return { username, fields };
}

describe('formularAusInstagramVorschau', () => {
  it('füllt Name, Mail, Telefon, Stadt und Followerstufe', () => {
    expect(formularAusInstagramVorschau(link, vorschau({
      name: 'Anna Schmidt',
      email: 'anna@example.com',
      telefon: '+49 170 1234567',
      wohnort: 'Köln',
      follower_instagram: 12000,
      notiz: 'Bio bleibt draussen'
    }))).toEqual({
      geladen: true,
      instagram: 'anna.schmidt',
      vorname: 'Anna',
      nachname: 'Schmidt',
      mail: 'anna@example.com',
      telefonnummer: '+49 170 1234567',
      lieferadresse_stadt: 'Köln',
      instagram_follower: '10000-25000',
      profilbild_url: '',
      profilbild_thumb_url: ''
    });
  });

  it('übernimmt das gesicherte Profilbild, aber keine unsichere URL', () => {
    const mitBild = formularAusInstagramVorschau(link, vorschau({
      profile_image_url: 'https://cdn.example/a.avif',
      profile_image_thumb_url: 'https://cdn.example/a-thumb.avif'
    }));
    expect(mitBild.profilbild_url).toBe('https://cdn.example/a.avif');
    expect(mitBild.profilbild_thumb_url).toBe('https://cdn.example/a-thumb.avif');

    const unsicher = formularAusInstagramVorschau(link, vorschau({ profile_image_url: 'javascript:alert(1)' }));
    expect(unsicher.profilbild_url).toBe('');
  });

  it('lässt den Namen leer, wenn er nicht aus zwei Teilen besteht', () => {
    const einer = formularAusInstagramVorschau(link, vorschau({ name: 'Anna' }));
    expect(einer.vorname).toBe('');
    expect(einer.nachname).toBe('');
    expect(einer.geladen).toBe(true);

    const drei = formularAusInstagramVorschau(link, vorschau({ name: 'Anna Maria Schmidt' }));
    expect(drei.vorname).toBe('');
    expect(drei.nachname).toBe('');
  });

  it('übernimmt einen Namen, wenn ein Emoji zwischen den Teilen steht', () => {
    const werte = formularAusInstagramVorschau(link, vorschau({ name: 'Anna 🌸 Schmidt' }));
    expect(werte.vorname).toBe('Anna');
    expect(werte.nachname).toBe('Schmidt');
  });

  it('ignoriert ungültige Mail und ein fremdes Profil', () => {
    const mail = formularAusInstagramVorschau(link, vorschau({
      name: 'Anna Schmidt',
      email: 'keine-mail'
    }));
    expect(mail.mail).toBe('');
    expect(mail.vorname).toBe('Anna');

    const fremd = formularAusInstagramVorschau(link, vorschau({
      name: 'Bob Anders',
      email: 'bob@example.com'
    }, 'bob'));
    expect(fremd).toMatchObject({
      geladen: false,
      instagram: link,
      vorname: '',
      mail: ''
    });
  });

  it('ordnet die Followerzahl der Stufe zu', () => {
    expect(formularAusInstagramVorschau(link, vorschau({ follower_instagram: 2499 })).instagram_follower)
      .toBe('0-2500');
    expect(formularAusInstagramVorschau(link, vorschau({ follower_instagram: 2500 })).instagram_follower)
      .toBe('2500-5000');
    expect(formularAusInstagramVorschau(link, vorschau({ follower_instagram: 1000000 })).instagram_follower)
      .toBe('1000000+');
  });
});

describe('followerZumSpeichern', () => {
  it('behält die genaue Zahl, solange die Stufe gleich bleibt', () => {
    expect(followerZumSpeichern('10000-25000', 12000)).toBe(12000);
    expect(followerZumSpeichern('25000-50000', 12000)).toBe('25000-50000');
    expect(followerZumSpeichern('', 12000)).toBe('');
  });
});
