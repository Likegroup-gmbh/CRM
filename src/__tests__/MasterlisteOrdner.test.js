import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreatorListPage } from '../modules/creator/CreatorListPage.js';
import {
  OHNE_UNTERNEHMEN,
  baueOrdner,
  leseOrdnerQuery,
  listenImOrdner,
  masterlistenCrumbs,
  ordnerDerListe,
  ordnerUrl
} from '../modules/creator/masterlisteOrdner.js';
import { mapListRow } from '../modules/creator/masterliste.js';

const ROWS = [
  { id: 'l-1', name: 'Beauty DACH', unternehmen_id: 'u-1', unternehmen: { id: 'u-1', firmenname: 'Hautica', logo_url: '' }, members: [{ count: 3 }] },
  { id: 'l-2', name: 'Food', unternehmen_id: null, members: [{ count: 1 }] },
  { id: 'l-3', name: 'Sommer', unternehmen_id: 'u-2', unternehmen: { id: 'u-2', firmenname: 'Alpaka', logo_url: '' }, members: [] },
  { id: 'l-4', name: 'Pflege', unternehmen_id: 'u-1', unternehmen: { id: 'u-1', firmenname: 'Hautica', logo_url: '' }, members: [] }
];

describe('Masterlisten-Ordner', () => {
  const lists = ROWS.map(mapListRow);

  it('legt je Unternehmen einen Ordner an, „Ohne Unternehmen“ am Ende', () => {
    expect(baueOrdner(lists).map(o => [o.name, o.count])).toEqual([
      ['Alpaka', 1],
      ['Hautica', 2],
      ['Ohne Unternehmen', 1]
    ]);
  });

  it('ordnet eine Liste mit unlesbarem Unternehmen nicht dem Agentur-Ordner zu', () => {
    expect(ordnerDerListe({ unternehmenId: 'u-9', unternehmenName: '' })).toMatchObject({ id: 'u-9', name: 'Unternehmen', ohne: false });
    expect(ordnerDerListe({ unternehmenId: null }).id).toBe(OHNE_UNTERNEHMEN);
  });

  it('filtert die Listen eines Ordners', () => {
    expect(listenImOrdner(lists, 'u-1').map(l => l.id)).toEqual(['l-1', 'l-4']);
    expect(listenImOrdner(lists, OHNE_UNTERNEHMEN).map(l => l.id)).toEqual(['l-2']);
    expect(listenImOrdner(lists, null)).toHaveLength(4);
  });

  it('hält den Ordner in der URL, auch mit Sonderzeichen im Namen', () => {
    const url = ordnerUrl({ id: 'u-1', name: '50% Rabatt & Co' });
    expect(leseOrdnerQuery(url.split('?')[1])).toEqual({ id: 'u-1', name: '50% Rabatt & Co', ohne: false });
    expect(ordnerUrl({ id: OHNE_UNTERNEHMEN, name: 'Ohne Unternehmen' })).toBe('/creator-lists?unternehmen=ohne');
    expect(leseOrdnerQuery('unternehmen=ohne')).toMatchObject({ id: 'ohne', ohne: true });
    expect(leseOrdnerQuery('')).toBeNull();
    expect(ordnerUrl(null)).toBe('/creator-lists');
  });

  it('baut die Breadcrumb über den Ordner bis zur Liste', () => {
    const ordner = { id: 'u-1', name: 'Hautica' };
    expect(masterlistenCrumbs({ ordner }).map(c => [c.label, c.clickable])).toEqual([
      ['Masterlisten', true],
      ['Hautica', false]
    ]);
    const detail = masterlistenCrumbs({ ordner, detailLabel: 'Beauty DACH', detailUrl: '/creator-lists/l-1' });
    expect(detail.map(c => c.label)).toEqual(['Masterlisten', 'Hautica', 'Beauty DACH']);
    expect(detail[1]).toMatchObject({ url: ordnerUrl(ordner), clickable: true });
    expect(masterlistenCrumbs()).toEqual([{ label: 'Masterlisten', url: '/creator-lists', clickable: false }]);
  });
});

describe('Masterlisten-Übersicht mit Ordnern', () => {
  let inserted;

  beforeEach(() => {
    inserted = null;
    window.history.replaceState({}, '', '/creator-lists');
    document.body.innerHTML = '<div id="content"></div>';
    window.content = document.getElementById('content');
    window.setContentSafely = (_el, html) => { window.content.innerHTML = html; };
    window.setHeadline = () => {};
    window.canEdit = (entity) => entity === 'creator-lists';
    window.ActionsDropdown = { init() {} };
    window.breadcrumbSystem = { updateBreadcrumb: vi.fn() };
    window.navigateTo = vi.fn();
    window.formSystem = undefined;
    window.toastSystem = { show: vi.fn() };
    window.supabase = {
      from(table) {
        const data = table === 'unternehmen'
          ? [{ id: 'u-2', firmenname: 'Alpaka' }, { id: 'u-1', firmenname: 'Hautica' }]
          : ROWS;
        return {
          select() { return this; },
          order() { return Promise.resolve({ data, error: null }); },
          insert(row) {
            inserted = row;
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'neu' }, error: null }) }) };
          }
        };
      }
    };
  });

  it('hält das Firmenlogo in der Grid-Karte auf der Avatar-Größe', async () => {
    const mitLogo = ROWS.map((row) => row.unternehmen
      ? { ...row, unternehmen: { ...row.unternehmen, logo_url: 'https://cdn.example/logo.png' } }
      : row);
    window.supabase = {
      from() {
        return {
          select() { return this; },
          order() { return Promise.resolve({ data: mitLogo, error: null }); }
        };
      }
    };
    const page = new CreatorListPage();
    await page.init();
    const bilder = [...document.querySelectorAll('.folder-card img')];
    expect(bilder).toHaveLength(2);
    for (const img of bilder) {
      expect(img.classList.contains('table-avatar--logo')).toBe(true);
      expect(img.classList.contains('folder-logo')).toBe(false);
      expect(img.getAttribute('src')).toBe('https://cdn.example/logo.png');
    }
    expect(document.querySelector('.folder-card[data-ordner-id="ohne"] img')).toBeNull();
    page.destroy();
  });

  it('zeigt Ordner und öffnet einen Ordner mit seinen Listen', async () => {
    const page = new CreatorListPage();
    await page.init();
    const karten = [...document.querySelectorAll('.folder-card .folder-name')].map(el => el.textContent);
    expect(karten).toEqual(['Alpaka', 'Hautica', 'Ohne Unternehmen']);

    document.querySelector('.folder-card[data-ordner-id="u-1"]').click();
    const namen = [...document.querySelectorAll('#creator-lists-body tr[data-list-id]')].map(tr => tr.dataset.listId);
    expect(namen).toEqual(['l-1', 'l-4']);
    expect(window.location.search).toBe('?unternehmen=u-1&unternehmen_name=Hautica');
    expect(window.breadcrumbSystem.updateBreadcrumb).toHaveBeenLastCalledWith([
      { label: 'Masterlisten', url: '/creator-lists', clickable: true },
      { label: 'Hautica', url: '/creator-lists?unternehmen=u-1&unternehmen_name=Hautica', clickable: false }
    ]);

    document.getElementById('masterlisten-zurueck').click();
    expect(document.querySelectorAll('.folder-card')).toHaveLength(3);
    page.destroy();
  });

  it('öffnet den Ordner aus der URL', async () => {
    window.history.replaceState({}, '', '/creator-lists?unternehmen=ohne');
    const page = new CreatorListPage();
    await page.init();
    expect([...document.querySelectorAll('#creator-lists-body tr[data-list-id]')].map(tr => tr.dataset.listId)).toEqual(['l-2']);
    page.destroy();
  });

  it('sucht auf oberster Ebene über alle Ordner und zeigt das Unternehmen', async () => {
    const page = new CreatorListPage();
    await page.init();
    page.searchQuery = 'hautica';
    page.updateContent();
    const zeilen = [...document.querySelectorAll('#creator-lists-body tr[data-list-id]')];
    expect(zeilen.map(tr => tr.dataset.listId)).toEqual(['l-1', 'l-4']);
    expect(document.querySelector('#masterlisten-inhalt thead').textContent).toContain('Unternehmen');
    page.destroy();
  });

  it('legt im Ordner eine Liste für dieses Unternehmen an', async () => {
    const page = new CreatorListPage();
    await page.init();
    document.querySelector('.folder-card[data-ordner-id="u-1"]').click();
    document.querySelector('[data-action="create-masterliste"]').click();
    const select = document.getElementById('masterliste-unternehmen');
    await vi.waitFor(() => expect(select.options.length).toBe(3));
    expect(select.value).toBe('u-1');

    document.getElementById('masterliste-name').value = 'Neue Crew';
    document.getElementById('masterliste-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(window.navigateTo).toHaveBeenCalledWith('/creator-lists/neu'));
    expect(inserted).toMatchObject({ name: 'Neue Crew', beschreibung: null, unternehmen_id: 'u-1' });
    page.destroy();
  });

  it('legt auf oberster Ebene eine Liste ohne Unternehmen an', async () => {
    const page = new CreatorListPage();
    await page.init();
    document.querySelector('[data-action="create-masterliste"]').click();
    expect(document.getElementById('masterliste-unternehmen').value).toBe('');
    document.getElementById('masterliste-name').value = 'Pool';
    document.getElementById('masterliste-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(inserted).toMatchObject({ name: 'Pool', unternehmen_id: null }));
    page.destroy();
  });
});
