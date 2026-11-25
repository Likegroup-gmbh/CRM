import { afterEach, describe, expect, it, vi } from 'vitest';
import { formularAusInstagramVorschau, followerZumSpeichern } from '../modules/creator/creatorInstagramPrefill.js';
import { creatorAuswahlService } from '../modules/creator-auswahl/CreatorAuswahlService.js';
import { CreatorList } from '../modules/creator/CreatorListCore.js';
import '../modules/creator/CreatorListForm.js';

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
      instagram_follower: '10000-25000'
    });
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

describe('Weiter füllt das Creator-Formular', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    delete window.supabase;
    delete window.formSystem;
    delete window.content;
    delete window.toastSystem;
  });

  function formularBereit() {
    document.body.innerHTML = `
      <form id="creator-instagram-start"></form>
      <div id="content"></div>
    `;
    window.content = document.getElementById('content');
    window.toastSystem = { show: vi.fn() };
    window.formSystem = {
      renderFormOnly() {
        return `
          <form id="creator-form">
            <input name="vorname">
            <input name="nachname">
            <input name="mail">
            <input name="telefonnummer">
            <input name="lieferadresse_stadt">
            <input name="instagram">
            <select name="instagram_follower">
              <option value="">Bitte wählen...</option>
              <option value="10000-25000">10.000 - 25.000</option>
            </select>
          </form>
        `;
      },
      bindFormEvents() {}
    };
  }

  it('schreibt die Vorschau in die Felder', async () => {
    formularBereit();
    vi.spyOn(creatorAuswahlService, 'previewInstagramStats').mockResolvedValue(vorschau({
      name: 'Anna Schmidt',
      email: 'anna@example.com',
      telefon: '+49 170 1234567',
      wohnort: 'Köln',
      follower_instagram: 12000
    }));

    const list = Object.create(CreatorList.prototype);
    await list.continueFromInstagram(link);

    const form = document.getElementById('creator-form');
    const wert = (name) => form.querySelector(`[name="${name}"]`).value;
    expect(wert('vorname')).toBe('Anna');
    expect(wert('nachname')).toBe('Schmidt');
    expect(wert('mail')).toBe('anna@example.com');
    expect(wert('telefonnummer')).toBe('+49 170 1234567');
    expect(wert('lieferadresse_stadt')).toBe('Köln');
    expect(wert('instagram')).toBe('anna.schmidt');
    expect(wert('instagram_follower')).toBe('10000-25000');
    expect(list._instagramFollowerZahl).toBe(12000);
    expect(window.toastSystem.show).not.toHaveBeenCalled();
  });

  it('öffnet das Formular mit dem Link, wenn der Abruf scheitert', async () => {
    formularBereit();
    vi.spyOn(creatorAuswahlService, 'previewInstagramStats').mockRejectedValue(new Error('offline'));

    const list = Object.create(CreatorList.prototype);
    await list.continueFromInstagram(link);

    const form = document.getElementById('creator-form');
    expect(form.querySelector('[name="instagram"]').value).toBe(link);
    expect(form.querySelector('[name="vorname"]').value).toBe('');
    expect(window.toastSystem.show).toHaveBeenCalledWith('Instagram konnte nicht geladen werden', 'error');
  });
});
