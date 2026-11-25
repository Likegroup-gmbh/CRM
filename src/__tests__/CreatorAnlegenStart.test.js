import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../core/tiktok/tiktokProfil.js', () => ({
  tiktokProfilAbrufen: vi.fn(),
}));
vi.mock('../core/ActionsDropdownEffects.js', () => ({
  connectInstagramSilent: vi.fn(async () => ({ ok: true })),
}));

const { tiktokProfilAbrufen } = await import('../core/tiktok/tiktokProfil.js');
const { connectInstagramSilent } = await import('../core/ActionsDropdownEffects.js');
const { creatorAuswahlService } = await import('../modules/creator-auswahl/CreatorAuswahlService.js');
const { CreatorList } = await import('../modules/creator/CreatorListCore.js');
await import('../modules/creator/CreatorListForm.js');
await import('../modules/creator/CreatorListFormStart.js');

const IG = 'https://www.instagram.com/anna.schmidt/';
const TT = 'https://www.tiktok.com/@kitchen.melda';

const IG_VORSCHAU = {
  username: 'anna.schmidt',
  fields: {
    name: 'Anna Schmidt',
    email: 'anna@example.com',
    follower_instagram: 12000,
    profile_image_url: 'https://cdn.example/ig.avif',
    profile_image_thumb_url: 'https://cdn.example/ig-thumb.avif'
  }
};
const TT_VORSCHAU = { username: 'kitchen.melda', fields: { name: 'Melda Yilmaz', wohnort: 'Berlin', follower_tiktok: 93300 } };

function creatorFormular() {
  const text = (name) => `<div class="form-field"><label>${name}</label><input name="${name}"></div>`;
  const stufe = (name) => `<div class="form-field"><label>${name}</label><select name="${name}">
    <option value="">Bitte wählen...</option>
    <option value="10000-25000">10.000 - 25.000</option>
    <option value="50000-100000">50.000 - 100.000</option>
  </select></div>`;
  return `<form id="creator-form">
    ${['vorname', 'nachname', 'mail', 'telefonnummer', 'lieferadresse_stadt', 'instagram'].map(text).join('')}
    ${stufe('instagram_follower')}
    ${text('tiktok')}
    ${stufe('tiktok_follower')}
    <button type="submit" class="mdc-btn mdc-btn--create"><span class="mdc-btn__label">Anlegen</span></button>
  </form>`;
}

function supabaseStub(creators = []) {
  const updates = [];
  return {
    updates,
    from(tabelle) {
      return {
        select: () => ({
          ilike: (spalte, muster) => ({
            limit: async () => {
              const suche = muster.replace(/%/g, '').toLowerCase();
              return { data: creators.filter((c) => String(c[spalte] || '').toLowerCase().includes(suche)), error: null };
            }
          }),
          eq: async () => ({ data: [], error: null })
        }),
        update: (patch) => ({
          eq: async (spalte, wert) => {
            updates.push({ tabelle, patch, [spalte]: wert });
            return { error: null };
          }
        })
      };
    }
  };
}

const feld = (name) => document.querySelector(`#creator-form [name="${name}"]`);
const gesperrt = (name) => feld(name).closest('.form-field').hasAttribute('inert');

describe('Creator anlegen: Startscreen mit Instagram und TikTok', () => {
  let list;

  beforeEach(() => {
    document.body.innerHTML = '<div id="content"></div>';
    window.content = document.getElementById('content');
    window.setHeadline = vi.fn();
    window.navigateTo = vi.fn();
    window.toastSystem = { show: vi.fn() };
    window.formSystem = { renderFormOnly: creatorFormular, bindFormEvents: vi.fn() };
    window.dataService = { createEntity: vi.fn(), updateEntity: vi.fn(async () => ({ success: true })) };
    window.supabase = supabaseStub();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(creatorAuswahlService, 'previewInstagramStats').mockResolvedValue(IG_VORSCHAU);
    tiktokProfilAbrufen.mockReset();
    tiktokProfilAbrufen.mockResolvedValue(TT_VORSCHAU);
    list = Object.create(CreatorList.prototype);
  });

  afterEach(() => {
    list._profilLaden?.abbrechen();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    for (const key of ['content', 'setHeadline', 'navigateTo', 'toastSystem', 'formSystem', 'dataService', 'supabase', 'validatorSystem']) {
      delete window[key];
    }
  });

  function weiter(instagram, tiktok) {
    list.showCreateForm();
    const start = document.getElementById('creator-links-start');
    start.elements.instagram.value = instagram;
    start.elements.tiktok.value = tiktok;
    start.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  it('öffnet das Formular sofort mit beiden Handles und füllt es im Hintergrund', async () => {
    let ttFertig;
    tiktokProfilAbrufen.mockImplementation(() => new Promise((resolve) => { ttFertig = resolve; }));
    weiter(IG, '@Kitchen.Melda');

    await vi.waitFor(() => expect(feld('instagram')).toBeTruthy());
    expect(feld('instagram').value).toBe('anna.schmidt');
    expect(feld('tiktok').value).toBe('kitchen.melda');
    await vi.waitFor(() => expect(feld('vorname').value).toBe('Anna'));
    expect(gesperrt('tiktok_follower')).toBe(true);
    expect(gesperrt('lieferadresse_stadt')).toBe(true);

    ttFertig(TT_VORSCHAU);
    await list._profilLaden.fertig;
    expect(feld('lieferadresse_stadt').value).toBe('Berlin');
    expect(feld('tiktok_follower').value).toBe('50000-100000');
    expect(gesperrt('lieferadresse_stadt')).toBe(false);
    expect(window.navigateTo).not.toHaveBeenCalled();
  });

  it('bleibt bei einem falschen Link auf dem Startscreen und sagt warum', () => {
    weiter('https://www.instagram.com/reel/DWtx7hWjFuH/', '');

    const fehler = document.getElementById('creator-links-fehler');
    expect(fehler.hidden).toBe(false);
    expect(fehler.textContent).toMatch(/Profil-Link/);
    expect(document.getElementById('creator-form')).toBeNull();
  });

  it('öffnet einen vorhandenen Creator über den TikTok-Handle und ergänzt den Instagram-Handle', async () => {
    window.supabase = supabaseStub([
      { id: 'c1', vorname: 'Melda', nachname: 'Yilmaz', instagram: null, tiktok: 'https://www.tiktok.com/@Kitchen.Melda' }
    ]);
    vi.spyOn(creatorAuswahlService, 'scrapeCreator').mockResolvedValue({});

    await list.continueFromLinks({ instagram: IG, tiktok: TT });

    expect(window.dataService.updateEntity).toHaveBeenCalledWith('creator', 'c1', { instagram: 'anna.schmidt' });
    expect(creatorAuswahlService.scrapeCreator).toHaveBeenCalledWith(IG);
    expect(window.navigateTo).toHaveBeenCalledWith('/creator/c1');
    expect(window.toastSystem.show).toHaveBeenCalledWith(expect.stringMatching(/gibt es schon/), 'info');
    expect(creatorAuswahlService.previewInstagramStats).not.toHaveBeenCalled();
  });

  it('öffnet ohne Link das leere Formular ohne Abruf', () => {
    list.showCreateForm();
    document.getElementById('creator-skip-links').click();

    expect(feld('vorname')).toBeTruthy();
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
    expect(creatorAuswahlService.previewInstagramStats).not.toHaveBeenCalled();
    expect(tiktokProfilAbrufen).not.toHaveBeenCalled();
  });

  it('sperrt Speichern, solange ein Profil lädt', async () => {
    tiktokProfilAbrufen.mockImplementation(() => new Promise(() => {}));
    list.renderCreatorForm({ tiktok: 'kitchen.melda' }, { tiktok: TT });

    await list.handleFormSubmit();

    expect(window.toastSystem.show).toHaveBeenCalledWith('Profil wird noch geladen', 'info');
    expect(window.dataService.createEntity).not.toHaveBeenCalled();
  });

  it('speichert die genauen Followerzahlen und das Profilbild', async () => {
    window.validatorSystem = { validateForm: () => ({ isValid: true, errors: {} }) };
    window.dataService.createEntity.mockResolvedValue({ success: true, id: 'neu' });
    list.renderCreatorForm({ instagram: 'anna.schmidt', tiktok: 'kitchen.melda' }, { instagram: IG, tiktok: TT });
    await list._profilLaden.fertig;
    feld('telefonnummer').value = '+49 170 1234567';

    await list.handleFormSubmit();

    const gespeichert = window.dataService.createEntity.mock.calls[0][1];
    expect(gespeichert).toMatchObject({
      vorname: 'Anna',
      instagram: 'anna.schmidt',
      tiktok: 'kitchen.melda',
      instagram_follower: 12000,
      tiktok_follower: 93300,
      lieferadresse_stadt: 'Berlin'
    });
    expect(window.supabase.updates).toContainEqual({
      tabelle: 'creator',
      patch: { profilbild_url: 'https://cdn.example/ig.avif', profilbild_thumb_url: 'https://cdn.example/ig-thumb.avif' },
      id: 'neu'
    });
    expect(connectInstagramSilent).toHaveBeenCalledWith('neu');
  });
});
