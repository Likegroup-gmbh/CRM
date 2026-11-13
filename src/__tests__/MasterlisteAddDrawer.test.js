import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MasterlisteAddDrawer } from '../modules/creator/masterlisteAddDrawer.js';
import { linkZaehlerText } from '../modules/creator/masterliste.js';

function detailStub() {
  return {
    members: [],
    addLinks: vi.fn().mockResolvedValue(true),
    addMember: vi.fn().mockResolvedValue(true),
    closeDrawers: vi.fn()
  };
}

describe('MasterlisteAddDrawer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.formSystem = undefined;
  });

  it('zeigt drei Tabs und startet mit Neuer Creator', () => {
    new MasterlisteAddDrawer(detailStub()).open();
    const tabs = [...document.querySelectorAll('#masterliste-add-drawer .view-toggle .mdc-btn')];
    expect(tabs.map(tab => tab.textContent)).toEqual(['Neuer Creator', 'Aus Datenbank', 'Mehrere Links']);
    expect(tabs[0].classList.contains('active')).toBe(true);
    expect(document.getElementById('masterliste-ig-link')).toBeTruthy();
  });

  it('hat im Tab Neuer Creator die Profilfelder wie im Casting', () => {
    new MasterlisteAddDrawer(detailStub()).open();
    const namen = [...document.querySelectorAll('#masterliste-add-form [name]')].map(el => el.name);
    expect(namen).toEqual([
      'typ', 'name', 'link_instagram', 'follower_instagram',
      'link_tiktok', 'follower_tiktok', 'wohnort', 'email', 'telefon'
    ]);
    expect(document.getElementById('masterliste-ig-link').required).toBe(false);
    expect(document.querySelector('#masterliste-creator-typ option[value="Influencer"]')).toBeTruthy();
  });

  it('reicht die Formularwerte an addEintrag weiter', async () => {
    const detail = detailStub();
    detail.addEintrag = vi.fn().mockResolvedValue(true);
    new MasterlisteAddDrawer(detail).open();
    const form = document.getElementById('masterliste-add-form');
    form.querySelector('[name="typ"]').value = 'Model';
    form.querySelector('[name="name"]').value = 'Ada';
    form.querySelector('[name="wohnort"]').value = 'Wien';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    expect(detail.addEintrag).toHaveBeenCalledWith(expect.objectContaining({ typ: 'Model', name: 'Ada', wohnort: 'Wien', link_instagram: '' }));
  });

  it('wechselt auf Aus Datenbank mit Suchfeld', () => {
    new MasterlisteAddDrawer(detailStub()).open();
    document.querySelector('[data-mode="database"]').click();
    expect(document.getElementById('masterliste-creator-select')).toBeTruthy();
    expect(document.getElementById('masterliste-ig-link')).toBeNull();
    expect(document.querySelector('[data-mode="database"]').classList.contains('active')).toBe(true);
  });

  it('zählt erkannte Links und reicht den Text an addLinks weiter', async () => {
    const detail = detailStub();
    new MasterlisteAddDrawer(detail).open('links');
    const textarea = document.getElementById('masterliste-links');
    const confirm = document.getElementById('masterliste-add-confirm');
    expect(confirm.disabled).toBe(true);

    textarea.value = 'https://instagram.com/ada, https://instagram.com/lina.k\nhttps://www.instagram.com/reel/XYZ/';
    textarea.dispatchEvent(new Event('input'));
    expect(document.getElementById('masterliste-links-zaehler').textContent)
      .toBe('2 Instagram-Profile erkannt, 1 kein Profil-Link');
    expect(confirm.disabled).toBe(false);

    document.getElementById('masterliste-add-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    expect(detail.addLinks).toHaveBeenCalledWith(textarea.value);
  });

  it('gibt den Button wieder frei, wenn nichts angelegt wurde', async () => {
    const detail = detailStub();
    detail.addLinks.mockResolvedValue(false);
    new MasterlisteAddDrawer(detail).open('links');
    const textarea = document.getElementById('masterliste-links');
    textarea.value = 'https://instagram.com/ada';
    textarea.dispatchEvent(new Event('input'));
    const drawer = document.getElementById('masterliste-add-form');
    drawer.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.getElementById('masterliste-add-confirm').disabled).toBe(false);
  });

  it('meldet bei einem Reel-Link im Tab Neuer Creator einen Fehler', async () => {
    new MasterlisteAddDrawer(detailStub()).open();
    const input = document.getElementById('masterliste-ig-link');
    input.value = 'https://www.instagram.com/reel/XYZ/';
    input.dispatchEvent(new Event('blur'));
    const status = document.getElementById('masterliste-ig-status');
    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain('Profil-Link');
  });
});

describe('Leiste unten in der Masterliste', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.canEdit = (entity) => entity === 'creator-lists';
  });

  it('zeigt das Link-Feld wie im Casting und öffnet „Aus Datenbank“ im passenden Tab', async () => {
    const { CreatorListDetail } = await import('../modules/creator/CreatorListDetail.js');
    const detail = new CreatorListDetail();
    detail.mountLinkBar();
    const bar = document.getElementById('masterliste-link-bar');
    expect(bar.classList.contains('is-idle')).toBe(true);
    expect(bar.querySelector('#masterliste-link-input').placeholder).toBe('Instagram-Link(s) einfügen');

    bar.querySelector('[data-selection-action="masterliste-aus-db"]').click();
    expect(document.querySelector('#masterliste-add-drawer [data-mode="database"]').classList.contains('active')).toBe(true);
    detail.destroy();
    expect(document.getElementById('masterliste-link-bar')).toBeNull();
  });

  it('leert das Feld nur, wenn etwas angelegt wurde', async () => {
    const { CreatorListDetail } = await import('../modules/creator/CreatorListDetail.js');
    const detail = new CreatorListDetail();
    detail.mountLinkBar();
    const input = document.getElementById('masterliste-link-input');
    detail.addLinks = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    input.value = 'https://instagram.com/ada';
    await detail.submitLinkBar(input);
    expect(input.value).toBe('https://instagram.com/ada');
    await detail.submitLinkBar(input);
    expect(input.value).toBe('');
    detail.destroy();
  });
});

describe('linkZaehlerText', () => {
  it('beschreibt erkannte und ungültige Links', () => {
    expect(linkZaehlerText({ handles: ['a'], ungueltig: [] })).toBe('1 Instagram-Profil erkannt');
    expect(linkZaehlerText({ handles: [], ungueltig: ['x', 'y'] })).toBe('2 keine Profil-Links');
    expect(linkZaehlerText({ handles: [], ungueltig: [] })).toBe('');
  });
});
