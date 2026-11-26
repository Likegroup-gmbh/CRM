import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../core/tiktok/tiktokProfil.js', () => ({
  tiktokProfilAbrufen: vi.fn(),
}));

const { tiktokProfilAbrufen } = await import('../core/tiktok/tiktokProfil.js');
const { renderCell } = await import('./sourcingZelleKit.js');
const { openCastingDetailDrawer, closeCastingDetailDrawer } = await import('../modules/creator-auswahl/castingDetailDrawer.js');
const { castingDetailProfilAbrufMethods } = await import('../modules/creator-auswahl/CastingDetailProfilAbruf.js');
const { castingDetailRowActionsMethods } = await import('../modules/creator-auswahl/CastingDetailRowActions.js');
const { creatorAuswahlService } = await import('../modules/creator-auswahl/CreatorAuswahlService.js');

const TT_URL = 'https://www.tiktok.com/@lea.m';

describe('TikTok im Casting – Views- und Preiszelle', () => {
  const item = {
    tt_views_12: 1000,
    tt_stats: { outliers_12: [{ side: 'high', views: 90000 }], skipped_ads: 1, skipped_pinned: 2 },
  };

  it('rechnet den Preis aus dem 12er-Schnitt der Videos', () => {
    const cell = renderCell('cp-col-cpm-tt-12', item);

    expect(cell.querySelector('.cpm-auto-price').textContent).toBe('25,00 €');
    expect(cell.querySelector('.cpm-auto-reach--clean')).toBeNull();
  });

  it('erklärt im Views-Tooltip Ausreißer, Werbung und angepinnte Videos', () => {
    const cell = renderCell('cp-col-views-tt-12', item);
    const title = cell.querySelector('.cpm-auto-value').getAttribute('title');

    expect(cell.querySelector('.cpm-auto-views').textContent).toBe('1,0K');
    expect(title).toContain('1 Ausreißer entfernt');
    expect(title).toContain('nach oben: 90.000 Views');
    expect(title).toContain('1 Video mit Werbe-Kennzeichnung ausgeschlossen');
    expect(title).toContain('2 angepinnte Videos ausgeschlossen');
    expect(title).not.toContain('Reel');
  });
});

describe('TikTok im Casting – Drawer', () => {
  const detail = (liste, item) => ({ isKunde: false, canEdit: true, gastReadonly: false, liste, items: [{ id: 'i1', ...item }] });
  afterEach(() => closeCastingDetailDrawer({ immediate: true }));

  it('zeigt Engagement, Preis 12/30, Gesamtpreis TikTok und den Abruf-Button am TikTok-Link', () => {
    openCastingDetailDrawer(detail({ plattformen: 'instagram,tiktok' }, {
      link_tiktok: TT_URL, tt_views_12: 2000, tt_stats: { engagement_rate: 4.5 },
      pricing: '1.500', pricing_tiktok: '1.200',
    }), 'i1');
    const drawer = document.getElementById('casting-detail-drawer');

    expect(drawer.textContent).toContain('Engagement TikTok');
    expect(drawer.textContent).toContain('4,5 %');
    expect(drawer.textContent).toContain('Preis 12 Videos TikTok');
    expect(drawer.textContent).toContain('50,00 €');
    expect(drawer.textContent).toContain('Gesamtpreis Instagram');
    expect(drawer.textContent).toContain('Gesamtpreis TikTok');
    expect(drawer.querySelector('input[data-field="pricing"]').value).toBe('1.500');
    expect(drawer.querySelector('input[data-field="pricing_tiktok"]').value).toBe('1.200');
    const btn = drawer.querySelector('.casting-detail-link [data-profil-abruf="tiktok"]');
    expect(btn.hidden).toBe(false);
    expect(drawer.querySelector('.casting-detail-link input').dataset.field).toBe('link_tiktok');
  });

  it('lässt die TikTok-Zeilen in reinen Instagram-Listen weg', () => {
    openCastingDetailDrawer(detail({ plattformen: 'instagram' }, { tt_views_12: 2000 }), 'i1');
    const drawer = document.getElementById('casting-detail-drawer');

    expect(drawer.textContent).not.toContain('Preis 12 Videos TikTok');
    expect(drawer.textContent).not.toContain('Gesamtpreis TikTok');
    expect(drawer.querySelector('input[data-field="pricing_tiktok"]')).toBeNull();
    expect(drawer.querySelector('[data-profil-abruf="tiktok"]')).toBeNull();
  });
});

describe('TikTok im Casting – Abruf aus der Zeile', () => {
  let detail;
  let button;

  beforeEach(() => {
    tiktokProfilAbrufen.mockReset();
    window.toastSystem = { show: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const fn of ['groupCollapsed', 'groupEnd', 'log', 'table']) vi.spyOn(console, fn).mockImplementation(() => {});
    document.body.innerHTML = `<div id="root"><div class="chip-cell">
      <input data-field="link_tiktok" data-item-id="i1" value="${TT_URL}">
      <span data-chip-cell-action><button class="profil-abruf-btn" data-profil-abruf="tiktok" data-item-id="i1"></button></span>
    </div></div>`;
    button = document.querySelector('button');
    detail = {
      items: [{ id: 'i1', link_tiktok: TT_URL }],
      _q: (sel) => document.getElementById('root').querySelector(sel),
      _tornDown: false,
      ...castingDetailRowActionsMethods,
      ...castingDetailProfilAbrufMethods,
      refreshItemRow: vi.fn(),
      rerenderTable: vi.fn(),
      _meldeBekanntenCreator: vi.fn(async () => []),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.toastSystem;
    document.body.innerHTML = '';
  });

  it('übernimmt die Zeile aus dem Abruf und meldet den Schnitt', async () => {
    tiktokProfilAbrufen.mockResolvedValue({
      item: { id: 'i1', follower_tiktok: 5000, tt_views_12: 900, tt_views_30: 1100, tt_fetched_at: '2026-11-25T12:00:00Z' },
      source: 'apify',
      username: 'lea.m',
    });

    await detail.handleTiktokFetch('i1', button);

    expect(tiktokProfilAbrufen).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'i1', force: false }));
    expect(detail.items[0]).toMatchObject({ follower_tiktok: 5000, tt_views_30: 1100 });
    expect(detail.refreshItemRow).toHaveBeenCalledWith('i1');
    expect(window.toastSystem.show).toHaveBeenCalledWith('TikTok-Daten aktualisiert (1.100 Views im Schnitt)', 'success');
  });

  it('speichert einen geänderten Link vorher und ruft beim zweiten Klick frisch ab', async () => {
    const update = vi.spyOn(creatorAuswahlService, 'updateItem').mockResolvedValue({});
    detail.items[0] = { id: 'i1', link_tiktok: 'https://www.tiktok.com/@alt', tt_fetched_at: '2026-11-20T10:00:00Z' };
    tiktokProfilAbrufen.mockResolvedValue({ item: {}, source: 'pool', poolFetchedAt: '2026-11-20T10:00:00Z' });

    await detail.handleTiktokFetch('i1', button);

    expect(update).toHaveBeenCalledWith('i1', { link_tiktok: TT_URL });
    expect(tiktokProfilAbrufen).toHaveBeenCalledWith(expect.objectContaining({ force: true }));
    expect(window.toastSystem.show.mock.calls[0][0]).toContain('Aus dem Creator-Pool übernommen (Stand 20.11.2026)');
  });

  it('schreibt den Fehler an die Zeile und zeigt den Hinweis', async () => {
    const err = Object.assign(new Error('Profil ist privat'), { hint: 'Link prüfen' });
    tiktokProfilAbrufen.mockRejectedValue(err);

    await detail.handleTiktokFetch('i1', button);

    expect(detail.items[0].tt_fetch_error).toBe('Profil ist privat');
    expect(detail.items[0].ig_fetch_error).toBeUndefined();
    expect(window.toastSystem.show).toHaveBeenCalledWith('Link prüfen', 'error');
  });
});
