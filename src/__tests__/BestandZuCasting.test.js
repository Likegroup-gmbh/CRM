import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../core/filters/ModularFilterSystem.js', () => ({
  modularFilterSystem: {
    getFilters: vi.fn(() => ({})),
    applyFilters: vi.fn(),
    resetFilters: vi.fn()
  }
}));

import {
  castingHandle,
  bestandKey,
  bestandName,
  teileNachDuplikat,
  bestandErgebnisText
} from '../modules/creator-auswahl/bestandZuCasting.js';
import { creatorAuswahlService } from '../modules/creator-auswahl/CreatorAuswahlService.js';
import { CastingBestandList } from '../modules/creator-casting/CastingBestandList.js';

describe('castingHandle', () => {
  it('liest Handles aus Links und nackten Handles, lowercase ohne @', () => {
    expect(castingHandle('https://www.instagram.com/Lina.Muster/')).toBe('lina.muster');
    expect(castingHandle('instagram.com/lina?hl=de')).toBe('lina');
    expect(castingHandle('@Lina_M')).toBe('lina_m');
    expect(castingHandle(' lina ')).toBe('lina');
  });

  it('liefert null für andere Links, reservierte Pfade und leere Werte', () => {
    expect(castingHandle('https://tiktok.com/@lina')).toBeNull();
    expect(castingHandle('https://www.instagram.com/reel/ABC')).toBeNull();
    expect(castingHandle('')).toBeNull();
    expect(castingHandle(null)).toBeNull();
  });
});

describe('bestandKey', () => {
  it('nimmt zuerst die creator_id, dann den Handle, dann den Namen', () => {
    expect(bestandKey({ id: 'c1', instagram: 'lina' })).toBe('c:c1');
    expect(bestandKey({ id: null, instagram: '@Lina', vorname: 'A', nachname: 'B' })).toBe('h:lina');
    expect(bestandKey({ id: null, instagram: null, vorname: 'Lina', nachname: ' Muster ' })).toBe('n:lina muster');
  });

  it('liefert null ohne Creator, Handle und Namen', () => {
    expect(bestandKey({ id: null, instagram: null, vorname: null, nachname: null })).toBeNull();
  });

  it('baut den Namen aus Vor- und Nachname', () => {
    expect(bestandName({ vorname: 'Lina', nachname: 'Muster' })).toBe('Lina Muster');
    expect(bestandName({ vorname: null, nachname: 'Polina' })).toBe('Polina');
  });
});

describe('teileNachDuplikat', () => {
  const gruen = { id: 'c1', vorname: 'Lina', nachname: 'Muster', instagram: 'lina.muster' };
  const rotMitHandle = { id: null, vorname: 'Max', nachname: 'Neu', instagram: 'max.neu' };
  const rotNurName = { id: null, vorname: 'Nur', nachname: 'Name', instagram: null };

  it('legt alles an, wenn das Casting leer ist', () => {
    const { anlegen, ueberspringen } = teileNachDuplikat([gruen, rotMitHandle, rotNurName], []);
    expect(anlegen).toHaveLength(3);
    expect(ueberspringen).toHaveLength(0);
  });

  it('überspringt Creator über creator_id', () => {
    const { anlegen, ueberspringen } = teileNachDuplikat([gruen], [{ creator_id: 'c1', name: 'Lina Muster' }]);
    expect(anlegen).toHaveLength(0);
    expect(ueberspringen).toEqual([gruen]);
  });

  it('überspringt einen Creator, dessen Handle an einem Eintrag ohne creator_id hängt', () => {
    const { ueberspringen } = teileNachDuplikat([gruen], [
      { creator_id: null, name: 'Lina M.', link_instagram: 'https://instagram.com/Lina.Muster' }
    ]);
    expect(ueberspringen).toEqual([gruen]);
  });

  it('überspringt Zeilen ohne Creator über den Handle', () => {
    const { anlegen, ueberspringen } = teileNachDuplikat([rotMitHandle, rotNurName], [
      { creator_id: null, name: 'Anderer Name', link_instagram: 'https://instagram.com/max.neu' }
    ]);
    expect(ueberspringen).toEqual([rotMitHandle]);
    expect(anlegen).toEqual([rotNurName]);
  });

  it('vergleicht ohne Handle den normalisierten Namen, aber nur mit Einträgen ohne Handle und Creator', () => {
    expect(teileNachDuplikat([rotNurName], [{ creator_id: null, name: ' nur NAME ', link_instagram: null }]).ueberspringen)
      .toEqual([rotNurName]);
    expect(teileNachDuplikat([rotNurName], [{ creator_id: null, name: 'Nur Name', link_instagram: 'https://instagram.com/x' }]).anlegen)
      .toEqual([rotNurName]);
    expect(teileNachDuplikat([rotNurName], [{ creator_id: 'c9', name: 'Nur Name', link_instagram: null }]).anlegen)
      .toEqual([rotNurName]);
  });
});

describe('bestandErgebnisText', () => {
  it('nennt hinzugefügte und übersprungene Personen', () => {
    expect(bestandErgebnisText({ added: 4, skipped: 0 })).toBe('4 Creator hinzugefügt');
    expect(bestandErgebnisText({ added: 4, skipped: 2 })).toBe('4 Creator hinzugefügt, 2 schon auf dem Casting');
    expect(bestandErgebnisText({ added: 0, skipped: 3 })).toBe('3 schon auf dem Casting, nichts hinzugefügt');
  });
});

describe('addBestandPersonen', () => {
  let inserted;

  /** Minimaler Supabase-Stub: eine Tabelle pro Name, Ergebnis fix. */
  const stub = ({ items = [], creators = [] } = {}) => {
    inserted = null;
    window.currentUser = { id: 'u1' };
    window.supabase = {
      from: vi.fn((table) => {
        const chain = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          then: (resolve) => resolve({ data: table === 'creator' ? creators : items, error: null }),
          insert: (rows) => {
            inserted = rows;
            return Promise.resolve({ error: null });
          }
        };
        return chain;
      })
    };
  };

  afterEach(() => {
    delete window.supabase;
    delete window.currentUser;
  });

  const gruen = { id: 'c1', vorname: 'Lina', nachname: 'Muster', instagram: 'lina.muster' };
  const rot = {
    id: null, vorname: 'Max', nachname: 'Neu', instagram: 'max.neu', tiktok: 'https://tiktok.com/@maxneu',
    instagram_follower: 12000, tiktok_follower: 3000, lieferadresse_stadt: 'Köln',
    profilbild_url: 'https://cdn.test/p.jpg', profilbild_thumb_url: 'https://cdn.test/t.avif'
  };

  it('legt grüne Zeilen mit creator_id und Stammdaten an, rote ohne', async () => {
    stub({
      items: [{ creator_id: 'x', name: 'Vorhanden', link_instagram: null, sortierung: 4 }],
      creators: [{ ...gruen, mail: 'lina@test.de', telefonnummer: '0123', instagram_follower: 5000 }]
    });

    const { added, skipped } = await creatorAuswahlService.addBestandPersonen('l1', [gruen, rot], 'Food');

    expect(added).toHaveLength(2);
    expect(skipped).toHaveLength(0);
    expect(inserted).toHaveLength(2);

    const [g, r] = inserted;
    expect(g).toMatchObject({
      creator_auswahl_id: 'l1', creator_id: 'c1', name: 'Lina Muster', typ: 'Influencer',
      kategorie: 'Food', email: 'lina@test.de', telefon: '0123', sortierung: 5, created_by: 'u1'
    });
    expect(g).not.toHaveProperty('persona_id');
    expect(r).toMatchObject({
      creator_id: null, name: 'Max Neu', typ: 'Influencer', kategorie: 'Food', sortierung: 6,
      link_instagram: 'https://instagram.com/max.neu', link_tiktok: 'https://tiktok.com/@maxneu',
      follower_instagram: 12000, follower_tiktok: 3000, wohnort: 'Köln',
      profile_image_url: 'https://cdn.test/p.jpg', profile_image_thumb_url: 'https://cdn.test/t.avif'
    });
  });

  it('legt ohne Kategorie ohne Kategorie an und überspringt Duplikate', async () => {
    stub({ items: [{ creator_id: 'c1', name: 'Lina Muster', link_instagram: null, sortierung: 0 }] });

    const { added, skipped } = await creatorAuswahlService.addBestandPersonen('l1', [gruen, rot], null);

    expect(skipped).toEqual([gruen]);
    expect(added).toEqual([rot]);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].kategorie).toBeNull();
    expect(inserted[0].sortierung).toBe(1);
  });

  it('schreibt nichts, wenn alle schon auf dem Casting stehen', async () => {
    stub({ items: [{ creator_id: 'c1', name: 'Lina Muster', link_instagram: null, sortierung: 0 }] });

    const { added, skipped } = await creatorAuswahlService.addBestandPersonen('l1', [gruen], null);

    expect(added).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(inserted).toBeNull();
  });
});

describe('CastingBestandList Auswahlmodus', () => {
  let list;
  let controller;

  const gruen = { id: 'c1', vorname: 'Lina', nachname: 'Muster', instagram: 'lina.muster', hat_creator: true };
  const rot = { id: null, vorname: 'Max', nachname: 'Neu', instagram: 'max.neu', hat_creator: false };

  const setup = async ({ kunde = false } = {}) => {
    window.isKunde = () => kunde;
    window.permissionSystem = { can: vi.fn(() => true) };
    window.supabase = { rpc: vi.fn() };
    list = new CastingBestandList();
    vi.spyOn(creatorAuswahlService, 'getListenFuerPicker').mockResolvedValue([]);
    document.body.innerHTML = list.renderShellContent();
    controller = new AbortController();
    list.loadDataDebounced = vi.fn();
    list.bindAdditionalEvents(controller.signal);
    list._rows = [gruen, rot];
    list.auswahl.remember(list._rows);
    // updateTable ist animiert; für den Test reicht das direkte Rendern der Zeilen
    list.updateTable = vi.fn(async (items) => {
      document.querySelector('tbody').innerHTML = items.map(i => list.renderSingleRow(i)).join('');
      list.auswahl.afterRender();
    });
    await list.updateTable(list._rows);
  };

  afterEach(() => {
    controller?.abort();
    list?.auswahl.destroy();
    document.body.innerHTML = '';
    delete window.isKunde;
    delete window.permissionSystem;
    delete window.supabase;
  });

  it('zeigt den Button nur mit Berechtigung', async () => {
    await setup();
    expect(document.getElementById('btn-casting-bestand-auswahl')).not.toBeNull();
    controller.abort();
    await setup({ kunde: true });
    expect(document.getElementById('btn-casting-bestand-auswahl')).toBeNull();
  });

  it('rendert die Checkbox-Spalte immer, sichtbar wird sie erst mit der Klasse is-auswahl', async () => {
    await setup();
    const table = document.querySelector('.data-table');
    const heads = document.querySelectorAll('thead th').length;

    expect(table.classList.contains('is-auswahl')).toBe(false);
    expect(document.querySelector('thead .col-auswahl')).not.toBeNull();
    expect(document.querySelectorAll('.bestand-check')).toHaveLength(2);
    expect(document.querySelector('tbody tr').querySelectorAll('td')).toHaveLength(heads);
    expect(list.options.tableColspan).toBe(heads);
    expect(document.querySelector('a.table-link')).not.toBeNull();
  });

  it('schaltet den Modus synchron per Klasse, ohne Neurender und ohne auf Castings zu warten', async () => {
    await setup();
    list.updateTable.mockClear();
    const tbody = document.querySelector('tbody');
    const table = document.querySelector('.data-table');
    // Castings laden nie fertig: der Modus darf trotzdem sofort stehen
    creatorAuswahlService.getListenFuerPicker.mockReturnValue(new Promise(() => {}));

    document.getElementById('btn-casting-bestand-auswahl').click();

    expect(list.auswahl.modus).toBe(true);
    expect(table.classList.contains('is-auswahl')).toBe(true);
    expect(document.querySelector('tbody')).toBe(tbody);
    expect(list.updateTable).not.toHaveBeenCalled();
    expect(document.getElementById('btn-casting-bestand-auswahl').textContent).toBe('Auswahl beenden');

    const select = document.getElementById('casting-bestand-bar-casting');
    expect(select.disabled).toBe(true);
    expect(select.options[0].textContent).toBe('Castings werden geladen…');
  });

  it('füllt das Casting-Select, sobald die Castings da sind', async () => {
    await setup();
    creatorAuswahlService.getListenFuerPicker.mockResolvedValue([
      { id: 'l1', name: 'Alpha Casting', teilbereich: null, kampagne: null }
    ]);

    list.auswahl.toggle();
    await list.auswahl.ladeListen();

    const select = document.getElementById('casting-bestand-bar-casting');
    expect(select.disabled).toBe(false);
    expect([...select.options].map(o => o.value)).toEqual(['', 'l1']);
  });

  it('ignoriert Zeilenklicks, solange der Modus aus ist', async () => {
    await setup();
    document.querySelector('tr[data-auswahl-key="h:max.neu"] td:nth-child(3)').click();
    expect(list.auswahl.selected.size).toBe(0);
  });

  it('wählt per Zeilenklick, hält Snapshots und überlebt ein Neurendern', async () => {
    await setup();
    list.auswahl.toggle();

    const rotRow = document.querySelector('tr[data-auswahl-key="h:max.neu"]');
    rotRow.querySelector('td:nth-child(3)').click();

    expect([...list.auswahl.selected.keys()]).toEqual(['h:max.neu']);
    expect(list.auswahl.selected.get('h:max.neu')).toBe(rot);
    expect(rotRow.classList.contains('row-selected')).toBe(true);

    // andere Seite: Zeile weg, Auswahl bleibt
    await list.updateTable([gruen]);
    expect(list.auswahl.selected.has('h:max.neu')).toBe(true);

    // zurück: Häkchen wieder gesetzt
    await list.updateTable([gruen, rot]);
    expect(document.querySelector('.bestand-check[data-key="h:max.neu"]').checked).toBe(true);
  });

  it('Select-All wählt die sichtbare Seite und lässt andere Seiten stehen', async () => {
    await setup();
    list.auswahl.toggle();
    list.auswahl.selected.set('c:andere', { id: 'andere' });

    const all = document.querySelector('.bestand-select-all');
    all.checked = true;
    all.dispatchEvent(new Event('change', { bubbles: true }));

    expect([...list.auswahl.selected.keys()].sort()).toEqual(['c:andere', 'c:c1', 'h:max.neu']);

    all.checked = false;
    all.dispatchEvent(new Event('change', { bubbles: true }));
    expect([...list.auswahl.selected.keys()]).toEqual(['c:andere']);
  });

  it('Auswahl beenden leert Auswahl und Modus', async () => {
    await setup();
    list.auswahl.toggle();
    list.auswahl.selected.set('c:c1', gruen);

    document.getElementById('btn-casting-bestand-auswahl').click();
    expect(list.auswahl.modus).toBe(false);
    expect(list.auswahl.selected.size).toBe(0);
    expect(document.querySelector('.data-table').classList.contains('is-auswahl')).toBe(false);
  });
});

describe('CastingBestandAuswahl Leiste', () => {
  let list;

  beforeEach(async () => {
    window.isKunde = () => false;
    window.permissionSystem = { can: () => true };
    window.supabase = { rpc: vi.fn() };
    window.toastSystem = { show: vi.fn() };
    list = new CastingBestandList();
    vi.spyOn(creatorAuswahlService, 'getListenFuerPicker').mockResolvedValue([
      { id: 'l1', name: 'Alpha Casting', teilbereich: 'Food, Sport', kampagne: null },
      { id: 'l2', name: 'Beta Casting', teilbereich: null, kampagne: null }
    ]);
    list.auswahl.mountBar();
    await list.auswahl.ladeListen();
  });

  afterEach(() => {
    list.auswahl.destroy();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    delete window.isKunde;
    delete window.permissionSystem;
    delete window.supabase;
    delete window.toastSystem;
  });

  it('listet die Castings und blendet Kategorien nur bei Castings mit Kategorien ein', () => {
    const casting = document.getElementById('casting-bestand-bar-casting');
    const kategorie = document.getElementById('casting-bestand-bar-kategorie');
    const hinzufuegen = document.querySelector('[data-selection-action="add"]');

    expect([...casting.options].map(o => o.value)).toEqual(['', 'l1', 'l2']);
    expect(hinzufuegen.disabled).toBe(true);
    expect(kategorie.hidden).toBe(true);

    casting.value = 'l1';
    casting.dispatchEvent(new Event('change', { bubbles: true }));
    expect(kategorie.hidden).toBe(false);
    expect([...kategorie.options].map(o => o.value)).toEqual(['', 'Food', 'Sport']);
    expect(hinzufuegen.disabled).toBe(false);

    casting.value = 'l2';
    casting.dispatchEvent(new Event('change', { bubbles: true }));
    expect(kategorie.hidden).toBe(true);
  });

  it('macht das Casting-Feld zum Suchfeld, sobald die Castings da sind', () => {
    const createSimpleSearchableSelect = vi.fn();
    window.formSystem = { createSimpleSearchableSelect };

    list.auswahl.fuelleCastings();

    const [select, optionen, config] = createSimpleSearchableSelect.mock.calls.at(-1);
    expect(select.id).toBe('casting-bestand-bar-casting');
    expect(optionen.map(o => o.value)).toEqual(['l1', 'l2']);
    expect(optionen[0].label).toBe('Alpha Casting');
    expect(config.placeholder).toBe('Casting suchen…');
    delete window.formSystem;
  });

  it('baut das Suchfeld erst, wenn die Castings geladen sind', () => {
    const createSimpleSearchableSelect = vi.fn();
    window.formSystem = { createSimpleSearchableSelect };

    list.auswahl.listenGeladen = false;
    list.auswahl.fuelleCastings();

    expect(createSimpleSearchableSelect).not.toHaveBeenCalled();
    delete window.formSystem;
  });

  it('sperrt Hinzufügen, wenn das Suchfeld geleert wird', () => {
    const casting = document.getElementById('casting-bestand-bar-casting');
    casting.value = 'l1';
    casting.dispatchEvent(new Event('change', { bubbles: true }));
    const hinzufuegen = document.querySelector('[data-selection-action="add"]');
    expect(hinzufuegen.disabled).toBe(false);

    const input = document.createElement('input');
    input.className = 'searchable-select-input';
    document.getElementById('casting-bestand-bar').appendChild(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(casting.value).toBe('');
    expect(hinzufuegen.disabled).toBe(true);
  });

  it('zeigt die Leiste ab einer Auswahl mit Zähler', () => {
    const bar = document.getElementById('casting-bestand-bar');
    expect(bar.style.display).toBe('none');
    list.auswahl.selected.set('c:c1', { id: 'c1' });
    list.auswahl.syncUi();
    expect(bar.style.display).toBe('flex');
    expect(bar.querySelector('.bulk-count').textContent).toBe('1 Personen ausgewählt');
  });

  it('legt die Auswahl aufs Casting, leert sie, lädt neu und meldet beides', async () => {
    const add = vi.spyOn(creatorAuswahlService, 'addBestandPersonen').mockResolvedValue({
      added: [{ id: 'c1' }], skipped: [{ id: null }]
    });
    const reload = vi.fn();
    list.auswahl.reload = reload;
    list.auswahl.selected.set('c:c1', { id: 'c1' });
    list.auswahl.selected.set('h:x', { id: null });

    const casting = document.getElementById('casting-bestand-bar-casting');
    casting.value = 'l1';
    casting.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('casting-bestand-bar-kategorie').value = 'Food';
    document.querySelector('[data-selection-action="add"]').click();

    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
    expect(add).toHaveBeenCalledWith('l1', [{ id: 'c1' }, { id: null }], 'Food');
    expect(list.auswahl.selected.size).toBe(0);
    expect(window.toastSystem.show).toHaveBeenCalledWith('1 Creator hinzugefügt, 1 schon auf dem Casting', 'success');
  });

  it('behält die Auswahl, wenn alle schon auf dem Casting stehen', async () => {
    vi.spyOn(creatorAuswahlService, 'addBestandPersonen').mockResolvedValue({ added: [], skipped: [{ id: 'c1' }] });
    list.auswahl.selected.set('c:c1', { id: 'c1' });

    const casting = document.getElementById('casting-bestand-bar-casting');
    casting.value = 'l2';
    casting.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-selection-action="add"]').click();

    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith(
      '1 schon auf dem Casting, nichts hinzugefügt', 'warning'
    ));
    expect(list.auswahl.selected.size).toBe(1);
  });
});
