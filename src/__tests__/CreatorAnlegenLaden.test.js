import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/tiktok/tiktokProfil.js', () => ({
  tiktokProfilAbrufen: vi.fn(),
}));

const { tiktokProfilAbrufen } = await import('../core/tiktok/tiktokProfil.js');
const { creatorAuswahlService } = await import('../modules/creator-auswahl/CreatorAuswahlService.js');
const { ladeProfileInsFormular } = await import('../modules/creator/creatorProfilLaden.js');

const IG = 'https://www.instagram.com/anna.schmidt/';
const TT = 'https://www.tiktok.com/@kitchen.melda';
const STUFEN = ['0-2500', '10000-25000', '50000-100000'];

function offen() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const igVorschau = (fields) => ({ username: 'anna.schmidt', source: 'pool', fields });
const ttVorschau = (fields) => ({ username: 'kitchen.melda', source: 'pool', fields, item: null });

function formular() {
  const text = (name, label, value = '') => `
    <div class="form-field"><label>${label}</label><input name="${name}" value="${value}"></div>`;
  const stufe = (name, label) => `
    <div class="form-field"><label>${label}</label><select name="${name}">
      <option value="">Bitte wählen...</option>
      ${STUFEN.map((s) => `<option value="${s}">${s}</option>`).join('')}
    </select></div>`;
  document.body.innerHTML = `
    <div class="form-page">
      <form id="creator-form">
        ${text('vorname', 'Vorname')}
        ${text('nachname', 'Nachname')}
        ${text('mail', 'Mail')}
        ${text('telefonnummer', 'Telefon')}
        ${text('lieferadresse_stadt', 'Stadt')}
        ${text('instagram', 'Instagram', 'anna.schmidt')}
        ${stufe('instagram_follower', 'Instagram Follower')}
        ${text('tiktok', 'TikTok', 'kitchen.melda')}
        ${stufe('tiktok_follower', 'TikTok Follower')}
        ${text('geschlecht', 'Geschlecht')}
        <button type="submit" class="mdc-btn mdc-btn--create"><span class="mdc-btn__label">Anlegen</span></button>
      </form>
    </div>`;
  return document.getElementById('creator-form');
}

const feld = (name) => document.querySelector(`[name="${name}"]`);
const huelle = (name) => feld(name).closest('.form-field');
const gesperrt = (name) => huelle(name).hasAttribute('inert');
const hinweis = (name) => huelle(name).querySelector('.form-field__laedt')?.textContent || '';
const status = () => document.querySelector('.creator-profil-status__text')?.textContent || '';
const submitWartet = () => document.querySelector('.mdc-btn--create').getAttribute('aria-disabled') === 'true';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Creator anlegen lädt Instagram und TikTok ins offene Formular', () => {
  let ig;
  let tt;

  beforeEach(() => {
    ig = offen();
    tt = offen();
    window.toastSystem = { show: vi.fn() };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(creatorAuswahlService, 'previewInstagramStats').mockImplementation(() => ig.promise);
    tiktokProfilAbrufen.mockReset();
    tiktokProfilAbrufen.mockImplementation(() => tt.promise);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.toastSystem;
    document.body.innerHTML = '';
  });

  it('sperrt nur die Felder, die ein Abruf füllen kann', () => {
    const laden = ladeProfileInsFormular(formular(), { instagram: IG, tiktok: TT });

    expect(gesperrt('vorname')).toBe(true);
    expect(huelle('vorname').getAttribute('aria-busy')).toBe('true');
    expect(huelle('vorname').classList.contains('form-field--laedt')).toBe(true);
    expect(hinweis('vorname')).toBe('lädt aus Instagram und TikTok');
    expect(hinweis('instagram_follower')).toBe('lädt aus Instagram');
    expect(hinweis('tiktok_follower')).toBe('lädt aus TikTok');
    for (const name of ['geschlecht', 'instagram', 'tiktok']) expect(gesperrt(name)).toBe(false);
    expect(laden.laeuft()).toBe(true);
    expect(submitWartet()).toBe(true);
    expect(status()).toBe('Instagram wird geladen… · TikTok wird geladen…');
    expect(tiktokProfilAbrufen).toHaveBeenCalledWith(expect.objectContaining({ link: TT }));
  });

  it('nimmt Stammdaten von Instagram, auch wenn TikTok zuerst fertig ist, und TikTok füllt die Lücken', async () => {
    const laden = ladeProfileInsFormular(formular(), { instagram: IG, tiktok: TT });

    tt.resolve(ttVorschau({
      name: 'Melda Yilmaz',
      email: 'melda@example.com',
      wohnort: 'Berlin',
      follower_tiktok: 93300,
      profile_image_url: 'https://cdn.example/tt.avif'
    }));
    await flush();
    expect(feld('tiktok_follower').value).toBe('50000-100000');
    expect(gesperrt('tiktok_follower')).toBe(false);
    expect(feld('vorname').value).toBe('');
    expect(gesperrt('vorname')).toBe(true);

    ig.resolve(igVorschau({
      name: 'Anna Schmidt',
      email: 'anna@example.com',
      follower_instagram: 12000,
      profile_image_url: 'https://cdn.example/ig.avif',
      profile_image_thumb_url: 'https://cdn.example/ig-thumb.avif'
    }));
    const ergebnis = await laden.fertig;

    expect(feld('vorname').value).toBe('Anna');
    expect(feld('nachname').value).toBe('Schmidt');
    expect(feld('mail').value).toBe('anna@example.com');
    expect(feld('lieferadresse_stadt').value).toBe('Berlin');
    expect(feld('instagram_follower').value).toBe('10000-25000');
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    expect(document.querySelectorAll('.form-field__laedt')).toHaveLength(0);
    expect(document.querySelector('.creator-profil-status')).toBeNull();
    expect(submitWartet()).toBe(false);
    expect(laden.laeuft()).toBe(false);
    expect(ergebnis).toEqual({
      instagramFollower: 12000,
      tiktokFollower: 93300,
      profilbild: { url: 'https://cdn.example/ig.avif', thumbUrl: 'https://cdn.example/ig-thumb.avif' }
    });
  });

  it('gibt bei "Nicht abwarten" alles frei und lässt späte Ergebnisse liegen', async () => {
    const laden = ladeProfileInsFormular(formular(), { instagram: IG, tiktok: TT });

    document.querySelector('.creator-profil-status__abbrechen').click();
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    expect(document.querySelector('.creator-profil-status')).toBeNull();
    expect(submitWartet()).toBe(false);
    expect(laden.laeuft()).toBe(false);
    expect(tiktokProfilAbrufen.mock.calls[0][0].istAbgebrochen()).toBe(true);

    feld('vorname').value = 'Selbst';
    ig.resolve(igVorschau({ name: 'Anna Schmidt', email: 'anna@example.com', follower_instagram: 12000 }));
    tt.resolve(null);
    const ergebnis = await laden.fertig;

    expect(feld('vorname').value).toBe('Selbst');
    expect(feld('mail').value).toBe('');
    expect(ergebnis.instagramFollower).toBeNull();
  });

  it('gibt nach einem Fehler die Felder der Plattform frei, TikTok füllt weiter', async () => {
    const laden = ladeProfileInsFormular(formular(), { instagram: IG, tiktok: TT });

    ig.reject(Object.assign(new Error('Profil nicht abrufbar'), { hint: 'später erneut' }));
    await flush();
    expect(gesperrt('instagram_follower')).toBe(false);
    expect(gesperrt('vorname')).toBe(true);
    expect(hinweis('vorname')).toBe('lädt aus TikTok');
    expect(status()).toBe('TikTok wird geladen…');
    expect(window.toastSystem.show).toHaveBeenCalledWith(
      'Instagram konnte nicht geladen werden. Profil nicht abrufbar. später erneut',
      'error'
    );

    tt.resolve(ttVorschau({ name: 'Melda Yilmaz', follower_tiktok: 500 }));
    await laden.fertig;
    expect(feld('vorname').value).toBe('Melda');
    expect(feld('tiktok_follower').value).toBe('0-2500');
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  });

  it('sagt an, wenn TikTok einen frischen Lauf braucht', () => {
    tiktokProfilAbrufen.mockImplementation(({ beimWarten }) => {
      beimWarten();
      return tt.promise;
    });
    ladeProfileInsFormular(formular(), { tiktok: TT });

    expect(status()).toBe('TikTok wird geladen, das kann bis zu einer Minute dauern');
    expect(hinweis('vorname')).toBe('lädt aus TikTok');
    expect(gesperrt('instagram_follower')).toBe(false);
    expect(creatorAuswahlService.previewInstagramStats).not.toHaveBeenCalled();
  });

  it('schreibt nach dem Verlassen der Seite nichts mehr', async () => {
    const form = formular();
    const laden = ladeProfileInsFormular(form, { instagram: IG, tiktok: TT });
    form.remove();

    expect(tiktokProfilAbrufen.mock.calls[0][0].istAbgebrochen()).toBe(true);
    ig.resolve(igVorschau({ name: 'Anna Schmidt', email: 'anna@example.com' }));
    tt.resolve(null);
    await laden.fertig;

    expect(form.querySelector('[name="vorname"]').value).toBe('');
    expect(window.toastSystem.show).not.toHaveBeenCalled();
  });
});
