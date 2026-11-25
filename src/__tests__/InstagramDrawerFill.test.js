import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreatorAuswahlAddDrawer } from '../modules/creator-auswahl/CreatorAuswahlAddDrawer.js';
import { creatorAuswahlService } from '../modules/creator-auswahl/CreatorAuswahlService.js';
import {
  applyPreviewToForm,
  instagramProfilHandle,
  leereIgOwners,
  markUserEdit,
  schuetzeGefuellte,
  stammdatenTreffer,
  statsForSave
} from '../modules/creator-auswahl/instagramDrawerFill.js';

function vorschau(handle, extra = {}) {
  return {
    username: handle,
    source: 'pool',
    fields: {
      name: handle === 'bob' ? 'Bob IG' : 'Ada IG',
      follower_instagram: handle === 'bob' ? 20 : 10,
      email: handle === 'bob' ? '' : 'ada@example.com',
      telefon: null,
      wohnort: 'Hamburg',
      notiz: 'Bio',
      sourcing_creator_id: 'pool-1',
      ig_views_8: 1000,
      ig_views_30: 2000,
      cpm_ig_8: 5,
      cpm_ig_30: 4,
      ig_stats: { username: handle, biography: 'Bio' },
      ig_fetched_at: '2026-10-12T00:00:00.000Z',
      profile_image_url: 'https://cdn.example/a.avif',
      profile_image_thumb_url: 'https://cdn.example/a-thumb.avif',
      ...extra
    }
  };
}

function neuerDrawer() {
  return new CreatorAuswahlAddDrawer({
    listeId: 'liste-1',
    liste: {},
    items: [],
    getTeilbereiche: () => [],
    ensureNewItemVisible() {},
    rerenderTable() {}
  });
}

describe('instagramDrawerFill', () => {
  it('erkennt nur Instagram-Profil-Links', () => {
    expect(instagramProfilHandle('https://instagram.com/Ada.Name')).toBe('ada.name');
    expect(instagramProfilHandle('https://www.instagram.com/ada/reel/ABC123/')).toBeNull();
    expect(instagramProfilHandle('ada')).toBeNull();
    expect(instagramProfilHandle('')).toBeNull();
  });

  it('laesst Handarbeit stehen und zieht Abruf-Felder nach', () => {
    const owners = markUserEdit(leereIgOwners(), 'name');
    const first = applyPreviewToForm(
      { name: 'Mein Name', email: '', telefon: '', wohnort: '', notiz: '' },
      owners,
      { name: 'Ada IG', email: 'ada@example.com', telefon: null, wohnort: 'Hamburg', notiz: 'Bio', follower_instagram: 10 }
    );
    expect(first.values.name).toBe('Mein Name');
    expect(first.values.email).toBe('ada@example.com');
    expect(first.values.follower_instagram).toBe('10');
    expect(first.owners.email).toBe('fetch');
    expect(first.owners.name).toBe('user');

    const second = applyPreviewToForm(first.values, first.owners, {
      name: 'Bob IG',
      email: '',
      telefon: '123',
      wohnort: 'Berlin',
      notiz: 'Neu',
      follower_instagram: 20
    });
    expect(second.values.name).toBe('Mein Name');
    expect(second.values.email).toBe('');
    expect(second.values.telefon).toBe('123');
    expect(second.values.follower_instagram).toBe('20');
  });

  it('schuetzt gefuellte Stammdaten und speichert Reichweite nur zum passenden Link', () => {
    const owners = schuetzeGefuellte(leereIgOwners(), {
      name: 'Ada',
      email: '',
      telefon: '',
      wohnort: 'Berlin',
      notiz: 'Hallo'
    });
    expect(owners.name).toBe('user');
    expect(owners.email).toBeNull();
    expect(owners.wohnort).toBe('user');

    const payload = { username: 'ada', ig_views_8: 1000, profile_image_url: 'https://cdn.example/a.avif' };
    expect(statsForSave(payload, 'https://www.instagram.com/ada/').ig_views_8).toBe(1000);
    expect(statsForSave(payload, 'https://www.instagram.com/bob/')).toBeNull();
    expect(statsForSave(payload, 'kein link')).toBeNull();
  });

  it('erkennt denselben Handle und markiert, wer schon auf dem Casting steht', () => {
    const creators = [
      { id: 'c1', vorname: 'Ada', nachname: 'Lovelace', instagram: '@Ada' },
      { id: 'c2', vorname: 'Ada', nachname: 'Zweite', instagram: 'https://instagram.com/ada/' },
      { id: 'c3', vorname: 'Bob', nachname: 'Anders', instagram: 'bob' }
    ];
    const treffer = stammdatenTreffer(creators, 'https://www.instagram.com/ADA', ['c1']);
    expect(treffer.map(t => t.id)).toEqual(['c1', 'c2']);
    expect(treffer[0].bereitsAufCasting).toBe(true);
    expect(treffer[1].bereitsAufCasting).toBe(false);
    expect(treffer[0].name).toBe('Ada Lovelace');
    expect(treffer[0].handle).toBe('ada');
  });
});

describe('Creator hinzufuegen liest den Instagram-Link', () => {
  let drawer;

  afterEach(() => {
    drawer?.remove();
    document.body.innerHTML = '';
    delete window.supabase;
    vi.restoreAllMocks();
  });

  function oeffnen() {
    drawer = neuerDrawer();
    vi.spyOn(creatorAuswahlService, 'previewInstagramStats').mockImplementation(async (link) => {
      return vorschau(instagramProfilHandle(link));
    });
    vi.spyOn(creatorAuswahlService, 'createItem').mockResolvedValue({ id: 'neu' });
    window.toastSystem = { show: vi.fn() };
    drawer.open();
    return drawer;
  }

  async function linkVerlassen(url) {
    const input = document.querySelector('input[name="link_instagram"]');
    input.value = url;
    input.dispatchEvent(new FocusEvent('blur'));
    await vi.waitFor(() => {
      expect(document.getElementById('ig-link-status').hidden).toBe(true);
    });
  }

  it('fuellt leere Felder und speichert Reichweite und Bild mit', async () => {
    oeffnen();
    await linkVerlassen('https://instagram.com/ada');

    expect(document.getElementById('creator-name').value).toBe('Ada IG');
    expect(document.querySelector('[name="follower_instagram"]').value).toBe('10');
    expect(document.querySelector('[name="email"]').value).toBe('ada@example.com');
    expect(document.querySelector('[name="wohnort"]').value).toBe('Hamburg');
    expect(document.querySelector('[name="notiz"]').value).toBe('Bio');
    expect(document.querySelector('[name="link_instagram"]').value).toBe('https://www.instagram.com/ada/');
    expect(creatorAuswahlService.previewInstagramStats).toHaveBeenCalledTimes(1);

    document.querySelector('[name="typ"]').value = 'Influencer';
    document.querySelector('[name="follower_instagram"]').value = '55';
    document.getElementById('add-creator-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(creatorAuswahlService.createItem).toHaveBeenCalledTimes(1));
    const saved = creatorAuswahlService.createItem.mock.calls[0][0];
    expect(saved.name).toBe('Ada IG');
    expect(saved.follower_instagram).toBe(55);
    expect(saved.link_instagram).toBe('https://www.instagram.com/ada/');
    expect(saved.ig_views_8).toBe(1000);
    expect(saved.ig_views_30).toBe(2000);
    expect(saved.profile_image_url).toBe('https://cdn.example/a.avif');
    expect(saved.sourcing_creator_id).toBe('pool-1');
    expect(creatorAuswahlService.previewInstagramStats).toHaveBeenCalledTimes(1);
  });

  it('behaelt einen selbst getippten Namen und holt ein anderes Profil nach', async () => {
    oeffnen();
    const name = document.getElementById('creator-name');
    name.value = 'Mein Name';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    await linkVerlassen('https://www.instagram.com/ada/');
    expect(name.value).toBe('Mein Name');
    expect(document.querySelector('[name="email"]').value).toBe('ada@example.com');

    await linkVerlassen('https://instagram.com/bob');
    expect(name.value).toBe('Mein Name');
    expect(document.querySelector('[name="email"]').value).toBe('');
    expect(document.querySelector('[name="follower_instagram"]').value).toBe('20');
    expect(document.querySelector('[name="link_instagram"]').value).toBe('https://www.instagram.com/bob/');
  });

  it('startet beim Einfuegen und nicht bei einem Reel oder demselben Link', async () => {
    oeffnen();
    const input = document.querySelector('input[name="link_instagram"]');
    input.value = 'https://instagram.com/ada';
    input.dispatchEvent(new Event('paste'));
    await vi.waitFor(() => expect(document.getElementById('creator-name').value).toBe('Ada IG'));

    input.dispatchEvent(new FocusEvent('blur'));
    await Promise.resolve();
    expect(creatorAuswahlService.previewInstagramStats).toHaveBeenCalledTimes(1);

    input.value = 'https://www.instagram.com/ada/reel/ABC123/';
    input.dispatchEvent(new FocusEvent('blur'));
    await Promise.resolve();
    expect(creatorAuswahlService.previewInstagramStats).toHaveBeenCalledTimes(1);
  });

  it('sperrt Speichern waehrend des Abrufs und laesst ihn bei einem Fehler trotzdem zu', async () => {
    drawer = neuerDrawer();
    let resolveFetch;
    vi.spyOn(creatorAuswahlService, 'previewInstagramStats').mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; })
    );
    vi.spyOn(creatorAuswahlService, 'createItem').mockResolvedValue({ id: 'neu' });
    window.toastSystem = { show: vi.fn() };
    drawer.open();

    const input = document.querySelector('input[name="link_instagram"]');
    input.value = 'https://instagram.com/ada';
    input.dispatchEvent(new FocusEvent('blur'));
    expect(document.getElementById('submit-btn').disabled).toBe(true);
    expect(document.getElementById('ig-link-status').textContent).toMatch(/geladen/);

    resolveFetch(vorschau('ada'));
    await vi.waitFor(() => expect(document.getElementById('submit-btn').disabled).toBe(false));

    creatorAuswahlService.previewInstagramStats.mockRejectedValueOnce(
      Object.assign(new Error('Profil nicht abrufbar'), { hint: 'spaeter erneut' })
    );
    input.value = 'https://instagram.com/bob';
    input.dispatchEvent(new FocusEvent('blur'));
    await vi.waitFor(() => {
      expect(document.getElementById('ig-link-status').textContent).toMatch(/Profil nicht abrufbar/);
    });
    expect(document.getElementById('ig-link-status').textContent).toMatch(/spaeter erneut/);
    expect(document.getElementById('submit-btn').disabled).toBe(false);

    document.querySelector('[name="typ"]').value = 'Influencer';
    document.getElementById('add-creator-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(creatorAuswahlService.createItem).toHaveBeenCalledTimes(1));
    const saved = creatorAuswahlService.createItem.mock.calls[0][0];
    expect(saved.link_instagram).toBe('https://instagram.com/bob');
    expect(saved.ig_views_8).toBeUndefined();
    expect(saved.profile_image_url).toBeUndefined();
  });

  it('holt in der Datenbank Follower neu und laesst Stammdaten stehen', async () => {
    oeffnen();
    drawer.switchMode('database');
    drawer.fillFormFromDbCreator({
      vorname: 'Ada',
      nachname: 'Lovelace',
      instagram: 'ada',
      instagram_follower: 1000,
      lieferadresse_stadt: 'Berlin',
      notiz: 'Aus Stammdaten'
    });

    await vi.waitFor(() => {
      expect(document.querySelector('[name="follower_instagram"]').value).toBe('10');
    });
    expect(document.getElementById('creator-name').value).toBe('Ada Lovelace');
    expect(document.querySelector('[name="wohnort"]').value).toBe('Berlin');
    expect(document.querySelector('[name="notiz"]').value).toBe('Aus Stammdaten');
    expect(document.querySelector('[name="email"]').value).toBe('ada@example.com');
  });

  function mitStammdaten(creators) {
    window.supabase = {
      from: () => ({
        select: () => ({
          ilike: () => ({
            limit: () => Promise.resolve({ data: creators, error: null })
          })
        })
      })
    };
  }

  const ADA = {
    id: 'c1',
    vorname: 'Ada',
    nachname: 'Lovelace',
    instagram: '@ada',
    mail: 'ada@firma.de',
    telefonnummer: '+49111',
    lieferadresse_stadt: 'Berlin',
    notiz: 'Aus Stammdaten'
  };

  const BOB = {
    id: 'c2',
    vorname: 'Bob',
    nachname: 'Anders',
    instagram: 'bob',
    mail: 'bob@firma.de'
  };

  async function hinweisAbwarten(text) {
    await vi.waitFor(() => {
      expect(document.getElementById('ig-db-hinweis').textContent).toMatch(text);
    });
  }

  it('zeigt einen Treffer und uebernimmt ihn als Stammdaten', async () => {
    oeffnen();
    mitStammdaten([ADA]);
    document.querySelector('[name="typ"]').value = 'UGC Paid';
    await linkVerlassen('https://instagram.com/ada');
    await hinweisAbwarten(/Ada Lovelace \(@ada\) ist schon in der Datenbank/);

    document.querySelector('.ig-db-hinweis__action').click();
    await vi.waitFor(() => {
      expect(document.querySelector('#add-creator-drawer .view-toggle .mdc-btn.active').dataset.mode).toBe('database');
    });
    expect(document.getElementById('creator-name').value).toBe('Ada Lovelace');
    expect(document.querySelector('[name="email"]').value).toBe('ada@firma.de');
    expect(document.querySelector('[name="telefon"]').value).toBe('+49111');
    expect(document.querySelector('[name="typ"]').value).toBe('UGC Paid');
    expect(document.getElementById('ig-db-hinweis').hidden).toBe(true);
    expect(drawer.selectedCreatorFromDb.id).toBe('c1');

    document.getElementById('add-creator-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(creatorAuswahlService.createItem).toHaveBeenCalledTimes(1));
    const saved = creatorAuswahlService.createItem.mock.calls[0][0];
    expect(saved.creator_id).toBe('c1');
    expect(saved.typ).toBe('UGC Paid');
    expect(saved.name).toBe('Ada Lovelace');
    expect(saved.email).toBe('ada@firma.de');
  });

  it('speichert ohne Uebernehmen ohne Stammdaten-Verknuepfung', async () => {
    oeffnen();
    mitStammdaten([ADA]);
    await linkVerlassen('https://instagram.com/ada');
    await hinweisAbwarten(/ist schon in der Datenbank/);
    document.querySelector('[name="typ"]').value = 'Influencer';
    document.getElementById('add-creator-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(creatorAuswahlService.createItem).toHaveBeenCalledTimes(1));
    const saved = creatorAuswahlService.createItem.mock.calls[0][0];
    expect(saved.creator_id).toBeNull();
    expect(saved.name).toBe('Ada IG');
  });

  it('nennt einen schon verknuepften Creator ohne Uebernehmen-Aktion', async () => {
    oeffnen();
    drawer.detail.items = [{ creator_id: 'c1' }];
    mitStammdaten([ADA, BOB]);
    await linkVerlassen('https://instagram.com/ada');
    await hinweisAbwarten(/steht schon auf diesem Casting/);
    expect(document.querySelector('.ig-db-hinweis__action')).toBeNull();
  });

  it('listet mehrere Treffer und laesst einen waehlen', async () => {
    oeffnen();
    mitStammdaten([ADA, { ...ADA, id: 'c9', vorname: 'Ada', nachname: 'Zweite', instagram: 'ADA' }]);
    await linkVerlassen('https://instagram.com/ada');
    await vi.waitFor(() => {
      expect(document.querySelectorAll('.ig-db-hinweis__action')).toHaveLength(2);
    });
    document.querySelectorAll('.ig-db-hinweis__action')[1].click();
    expect(drawer.selectedCreatorFromDb.id).toBe('c9');
    expect(document.getElementById('creator-name').value).toBe('Ada Zweite');
  });

  it('nimmt die Verknuepfung per X zurueck und laesst das Formular stehen', async () => {
    oeffnen();
    mitStammdaten([ADA]);
    document.querySelector('[name="typ"]').value = 'UGC Paid';
    await linkVerlassen('https://instagram.com/ada');
    await hinweisAbwarten(/ist schon in der Datenbank/);
    document.querySelector('.ig-db-hinweis__action').click();
    await vi.waitFor(() => expect(drawer.selectedCreatorFromDb?.id).toBe('c1'));

    document.getElementById('btn-remove-db-creator').click();
    expect(drawer.selectedCreatorFromDb).toBeNull();
    expect(document.querySelector('#add-creator-drawer .view-toggle .mdc-btn.active').dataset.mode).toBe('new');
    expect(document.getElementById('creator-name').value).toBe('Ada Lovelace');
    expect(document.querySelector('[name="typ"]').value).toBe('UGC Paid');
    expect(document.querySelector('.ig-db-hinweis__action')).toBeTruthy();

    document.getElementById('add-creator-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(creatorAuswahlService.createItem).toHaveBeenCalledTimes(1));
    expect(creatorAuswahlService.createItem.mock.calls[0][0].creator_id).toBeNull();
    expect(creatorAuswahlService.createItem.mock.calls[0][0].name).toBe('Ada Lovelace');
  });

  it('hebt die Auswahl auf, wenn der Link auf ein anderes Profil wechselt', async () => {
    oeffnen();
    mitStammdaten([ADA, BOB]);
    await linkVerlassen('https://instagram.com/ada');
    await hinweisAbwarten(/Ada Lovelace/);
    document.querySelector('.ig-db-hinweis__action').click();
    await vi.waitFor(() => expect(drawer.selectedCreatorFromDb?.id).toBe('c1'));

    const input = document.querySelector('input[name="link_instagram"]');
    input.value = 'https://instagram.com/bob';
    input.dispatchEvent(new FocusEvent('blur'));
    await hinweisAbwarten(/Bob Anders \(@bob\)/);
    expect(drawer.selectedCreatorFromDb).toBeNull();
    expect(document.querySelector('#add-creator-drawer .view-toggle .mdc-btn.active').dataset.mode).toBe('new');
    expect(document.getElementById('creator-name').value).toBe('Ada Lovelace');
  });
});
