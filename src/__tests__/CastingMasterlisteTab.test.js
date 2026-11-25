import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CreatorAuswahlAddDrawer } from '../modules/creator-auswahl/CreatorAuswahlAddDrawer.js';
import { mapMember } from '../modules/creator/masterliste.js';
import { personenFuerCasting, personLabel } from '../modules/creator-auswahl/masterlisteZuCasting.js';

const GRUEN = {
  id: 'm-ada',
  ig_username: 'ada',
  creator: {
    id: 'c-ada', vorname: 'Ada', nachname: 'Lovelace', instagram: 'ada',
    instagram_follower: 1000, tiktok: '', tiktok_follower: null,
    lieferadresse_stadt: 'Wien', mail: 'ada@example.com', telefonnummer: '',
    profilbild_url: '', profilbild_thumb_url: '',
    creator_types: [{ creator_type: { name: 'Influencer' } }]
  }
};

const ROT = {
  id: 'm-lina',
  ig_username: 'lina.k',
  name: 'Lina K',
  typ: 'Model',
  follower_instagram: 500,
  link_tiktok: 'https://www.tiktok.com/@lina',
  follower_tiktok: 200,
  wohnort: 'Graz',
  email: 'l@k.at',
  telefon: '',
  pool: {
    name: 'Lina K',
    link_instagram: 'https://instagram.com/lina.k',
    follower_instagram: 800,
    profile_image_url: 'https://cdn.test/p.jpg',
    profile_image_thumb_url: 'https://cdn.test/t.jpg',
    email: '', telefon: '', wohnort: ''
  }
};

const VORHANDEN = [{ creator_id: 'c-ada', name: 'Ada Lovelace', link_instagram: 'https://instagram.com/ada', sortierung: 2 }];

describe('personenFuerCasting', () => {
  const personen = personenFuerCasting([GRUEN, ROT].map(mapMember), VORHANDEN);

  it('markiert den Creator, der schon auf dem Casting steht, und übernimmt die Creator Art der roten Zeile', () => {
    const ada = personen.find(person => person.id === 'c-ada');
    const lina = personen.find(person => person.memberId === 'm-lina');
    expect(ada.schonDa).toBe(true);
    expect(lina.schonDa).toBe(false);
    expect(lina.typ).toBe('Model');
    expect(lina.id).toBeNull();
    expect(lina.instagram_follower).toBe(800);
    expect(personLabel(lina)).toBe('Lina K · @lina.k');
    expect(personen.map(person => person.memberId)).toEqual(['m-lina', 'm-ada']);
  });
});

describe('Tab Aus Masterliste', () => {
  let inserted;
  let drawer;

  beforeEach(() => {
    inserted = null;
    document.body.innerHTML = '';
    window.currentUser = { id: 'u1' };
    window.formSystem = undefined;
    window.toastSystem = { show: vi.fn() };
    window.supabase = {
      from(table) {
        const ergebnis = () => {
          if (table === 'creator_list') {
            return { data: [{ id: 'ml-1', name: 'Beauty DACH', unternehmen: { firmenname: 'Hautica' } }], error: null };
          }
          if (table === 'creator_list_member') return { data: [GRUEN, ROT], error: null };
          if (table === 'creator') return { data: [], error: null };
          return { data: VORHANDEN, error: null };
        };
        const kette = new Proxy({}, {
          get(_ziel, prop) {
            if (prop === 'then') return (resolve) => resolve(ergebnis());
            if (prop === 'insert') return (rows) => {
              inserted = rows;
              return Promise.resolve({ error: null });
            };
            return () => kette;
          }
        });
        return kette;
      }
    };
  });

  afterEach(() => {
    drawer?.remove();
    delete window.supabase;
    delete window.currentUser;
    delete window.toastSystem;
    delete window.formSystem;
  });

  it('übernimmt angehakte Creator und lässt aus, wer schon auf dem Casting steht', async () => {
    const detail = {
      listeId: 'liste-1',
      liste: { teilbereich: 'Food, Sport' },
      items: VORHANDEN,
      getTeilbereiche: () => ['Food', 'Sport'],
      hiddenColumns: [],
      customColumns: { loadValues: vi.fn() },
      rerenderTable: vi.fn()
    };
    drawer = new CreatorAuswahlAddDrawer(detail);
    drawer.open();

    const tabs = [...document.querySelectorAll('#add-creator-drawer .view-toggle .mdc-btn')].map(tab => tab.textContent);
    expect(tabs).toEqual(['Neuer Creator', 'Aus Datenbank', 'Aus Masterliste']);
    document.querySelector('[data-mode="masterliste"]').click();

    const select = document.getElementById('masterliste-quelle');
    await vi.waitFor(() => expect(select.options).toHaveLength(2));
    expect(select.options[1].textContent).toBe('Beauty DACH · Hautica');
    expect(document.getElementById('masterliste-kategorie')).toBeTruthy();

    select.value = 'ml-1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('[data-member-id="m-lina"]')).toBeTruthy());

    const ada = document.querySelector('[data-member-id="m-ada"]');
    const lina = document.querySelector('[data-member-id="m-lina"]');
    expect(ada.disabled).toBe(true);
    expect(ada.closest('label').textContent).toContain('schon auf diesem Casting');
    expect(lina.disabled).toBe(false);

    document.getElementById('masterliste-alle').click();
    expect(document.querySelector('[data-member-id="m-lina"]').checked).toBe(true);
    expect(document.querySelector('[data-member-id="m-ada"]').checked).toBe(false);
    expect(document.getElementById('masterliste-submit').textContent).toContain('1 hinzufügen');

    document.getElementById('masterliste-kategorie').value = 'Food';
    document.getElementById('masterliste-casting-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    await vi.waitFor(() => expect(inserted).toHaveLength(1));
    expect(inserted[0]).toMatchObject({
      creator_auswahl_id: 'liste-1',
      creator_id: null,
      name: 'Lina K',
      typ: 'Model',
      kategorie: 'Food',
      follower_instagram: 800,
      profile_image_url: 'https://cdn.test/p.jpg',
      sortierung: 3
    });
    expect(window.toastSystem.show).toHaveBeenCalledWith('1 Creator hinzugefügt', 'success');
    expect(detail.rerenderTable).toHaveBeenCalled();
    expect(document.getElementById('add-creator-drawer').classList.contains('show')).toBe(false);
  });
});
