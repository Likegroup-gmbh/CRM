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

  it('lehnt Reels, Freitext und leere Eingaben ab', () => {
    expect(leseQuickAddLink('https://www.instagram.com/reel/DABC123/').error).toBeTruthy();
    expect(leseQuickAddLink('irgendwas').error).toBeTruthy();
    expect(leseQuickAddLink('').error).toBeTruthy();
  });

  it('nimmt TikTok nur bei TikTok-Liste', () => {
    const link = 'https://www.tiktok.com/@Creator.x';
    expect(leseQuickAddLink(link).error).toBe('Diese Liste hat kein TikTok');
    expect(leseQuickAddLink(link, { tiktok: true })).toMatchObject({
      platform: 'tiktok', handle: 'creator.x', field: 'link_tiktok'
    });
  });
});

describe('findeQuickAddDuplikat', () => {
  it('findet den Eintrag mit gleichem Handle, auch bei anderer Schreibweise', () => {
    const items = [{ id: 'a', link_instagram: 'https://instagram.com/Anna/' }, { id: 'b', link_instagram: null }];
    const link = leseQuickAddLink('https://www.instagram.com/anna');
    expect(findeQuickAddDuplikat(items, link).id).toBe('a');
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
    expect(bar.querySelector('#quick-add-link')).not.toBeNull();
  });

  it('legt Eintrag an, holt die Instagram-Daten und leert das Feld', async () => {
    const create = vi.spyOn(creatorAuswahlService, 'createItem').mockResolvedValue({ id: 'neu' });
    document.getElementById('root').innerHTML = '<button class="ig-fetch-btn" data-item-id="neu"></button>';

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
