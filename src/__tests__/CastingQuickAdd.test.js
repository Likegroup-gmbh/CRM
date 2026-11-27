import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CreatorAuswahlDetail } from '../modules/creator-auswahl/CreatorAuswahlDetail.js';
import { creatorAuswahlService } from '../modules/creator-auswahl/CreatorAuswahlService.js';
import {
  findeQuickAddDuplikat,
  leseQuickAddLink
} from '../modules/creator-auswahl/CastingDetailQuickAdd.js';
import { leererCastingEintrag } from '../modules/creator-auswahl/leererCastingEintrag.js';

describe('leseQuickAddLink', () => {
  it('liest Instagram-Profile und normalisiert den Link', () => {
    expect(leseQuickAddLink('https://instagram.com/Paulinemary?igsh=x')).toEqual({
      platform: 'instagram',
      handle: 'paulinemary',
      field: 'link_instagram',
      value: 'https://www.instagram.com/paulinemary/'
    });
  });

  it('nimmt einen Instagram-Handle mit und ohne @', () => {
    expect(leseQuickAddLink('@Pauline.Mary')).toEqual({
      platform: 'instagram',
      handle: 'pauline.mary',
      field: 'link_instagram',
      value: 'https://www.instagram.com/pauline.mary/'
    });
    expect(leseQuickAddLink('paulinemary').handle).toBe('paulinemary');
  });

  it('lehnt Reels, Freitext und leere Eingaben ab', () => {
    expect(leseQuickAddLink('https://www.instagram.com/reel/DABC123/').error).toBeTruthy();
    expect(leseQuickAddLink('kein Link').error).toBeTruthy();
    expect(leseQuickAddLink('reel').error).toBeTruthy();
    expect(leseQuickAddLink('').error).toBeTruthy();
  });

  it('nimmt TikTok nur bei TikTok-Liste', () => {
    const link = 'https://www.tiktok.com/@Creator.x';
    expect(leseQuickAddLink(link).error).toBe('Diese Liste hat kein TikTok');
    expect(leseQuickAddLink(link, { tiktok: true })).toMatchObject({
      platform: 'tiktok', handle: 'creator.x', field: 'link_tiktok'
    });
  });

  it('nimmt TikTok nur per Link: ein Handle in einer reinen TikTok-Liste gibt einen Hinweis', () => {
    expect(leseQuickAddLink('@creator.x', { tiktok: true, instagram: false }).error)
      .toBe('Für TikTok bitte den Profil-Link einfügen');
    expect(leseQuickAddLink('@creator.x', { tiktok: true }).platform).toBe('instagram');
  });
});

describe('findeQuickAddDuplikat', () => {
  it('findet den Eintrag mit gleichem Handle, auch bei anderer Schreibweise', () => {
    const items = [{ id: 'a', link_instagram: 'https://instagram.com/Anna/' }, { id: 'b', link_instagram: null }];
    const link = leseQuickAddLink('https://www.instagram.com/anna');
    expect(findeQuickAddDuplikat(items, link).id).toBe('a');
    expect(findeQuickAddDuplikat(items, leseQuickAddLink('@anna')).id).toBe('a');
    expect(findeQuickAddDuplikat(items, leseQuickAddLink('https://instagram.com/bert'))).toBeNull();
  });
});

describe('leererCastingEintrag', () => {
  it('setzt Liste, Sortierung und Overrides', () => {
    const eintrag = leererCastingEintrag('l1', 4, { link_instagram: 'x' });
    expect(eintrag).toMatchObject({ creator_auswahl_id: 'l1', sortierung: 4, link_instagram: 'x', name: null, absage: false });
  });
});

describe('Casting-Detail Quick-Add', () => {
  let detail;

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    window.toastSystem = { show: vi.fn() };
    window.permissionSystem = { can: () => true };
    detail = new CreatorAuswahlDetail();
    detail.root = document.getElementById('root');
    detail.listeId = 'l1';
    detail.liste = { plattformen: 'instagram' };
    detail.items = [{ id: 'vorhanden', link_instagram: 'https://www.instagram.com/anna/' }];
    detail.rerenderTable = vi.fn();
    detail.ensureNewItemVisible = vi.fn();
    detail._meldeBekanntenCreator = vi.fn().mockResolvedValue([]);
    detail.handleInstagramFetch = vi.fn().mockResolvedValue();
    detail.renderBulkBar();
  });

  afterEach(() => {
    detail.selectionBar?.destroy();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    delete window.toastSystem;
    delete window.permissionSystem;
  });

  it('zeigt die Leiste mit Link-Feld schon ohne Auswahl', () => {
    const bar = document.getElementById('sourcing-bulk-bar');
    expect(bar.style.display).toBe('flex');
    const input = bar.querySelector('#quick-add-link');
    expect(input).not.toBeNull();
    expect(input.type).toBe('text');
    expect(input.placeholder).toBe('Instagram-Link oder @Handle einfügen');
  });

  it('legt Eintrag an, holt die Instagram-Daten und leert das Feld', async () => {
    const create = vi.spyOn(creatorAuswahlService, 'createItem').mockResolvedValue({ id: 'neu' });
    document.getElementById('root').innerHTML = '<button class="profil-abruf-btn" data-profil-abruf="instagram" data-item-id="neu"></button>';

    await detail.handleQuickAdd('https://instagram.com/bert');

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      creator_auswahl_id: 'l1',
      sortierung: 1,
      link_instagram: 'https://www.instagram.com/bert/'
    }));
    expect(detail.items.map(i => i.id)).toEqual(['vorhanden', 'neu']);
    expect(detail._meldeBekanntenCreator).toHaveBeenCalled();
    expect(detail.handleInstagramFetch).toHaveBeenCalledWith('neu', expect.any(HTMLElement));
  });

  it('startet bei einem TikTok-Link den TikTok-Abruf, ohne die Leiste zu blockieren', async () => {
    detail.liste = { plattformen: 'instagram,tiktok' };
    vi.spyOn(creatorAuswahlService, 'createItem').mockResolvedValue({ id: 'tt' });
    detail.handleTiktokFetch = vi.fn(() => new Promise(() => {}));

    await detail.handleQuickAdd('https://www.tiktok.com/@Lea.M?lang=de');

    expect(creatorAuswahlService.createItem).toHaveBeenCalledWith(expect.objectContaining({ link_tiktok: 'https://www.tiktok.com/@lea.m' }));
    expect(detail.handleTiktokFetch).toHaveBeenCalledWith('tt', expect.any(HTMLElement));
    expect(detail.handleInstagramFetch).not.toHaveBeenCalled();
    expect(detail._quickAddBusy).toBe(false);
  });

  it('passt den Platzhalter an die Plattformen der Liste an', () => {
    const platzhalter = (plattformen) => {
      detail.selectionBar.destroy();
      detail.selectionBar = null;
      detail.liste = { plattformen };
      detail.renderBulkBar();
      return document.querySelector('#quick-add-link').placeholder;
    };
    expect(platzhalter('instagram,tiktok')).toBe('Instagram-Link, @Handle oder TikTok-Link einfügen');
    expect(platzhalter('tiktok')).toBe('TikTok-Link einfügen');
  });

  it('legt bei Reel-Link und Duplikat nichts an', async () => {
    const create = vi.spyOn(creatorAuswahlService, 'createItem').mockResolvedValue({ id: 'neu' });

    await detail.handleQuickAdd('https://www.instagram.com/reel/DABC123/');
    await detail.handleQuickAdd('https://instagram.com/Anna');

    expect(create).not.toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledTimes(2);
  });

  it('bietet Kunden und Nutzern ohne create-Recht kein Link-Feld an', () => {
    detail.selectionBar.destroy();
    window.permissionSystem = { can: (_, verb) => verb !== 'create' };
    detail.selectionBar = null;
    detail.renderBulkBar();
    const bar = document.getElementById('sourcing-bulk-bar');
    expect(bar.style.display).toBe('none');
    expect(bar.querySelector('#quick-add-link')).toBeNull();
  });
});
