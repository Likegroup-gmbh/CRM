import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../core/tiktok/tiktokProfil.js', () => ({
  tiktokProfilAbrufen: vi.fn(),
}));

const { tiktokProfilAbrufen } = await import('../core/tiktok/tiktokProfil.js');
const { linkZiel, profilUrl } = await import('../modules/creator-auswahl/sourcingProfilPlattformen.js');
const { mitPlattformenDerEintraege, plattformenDerEintraege } = await import('../modules/creator-auswahl/sourcingSpaltenSichtbarkeit.js');
const { berechneHiddenColumns } = await import('../modules/creator-auswahl/sourcingSpaltenPreset.js');
const { migrateHiddenColumns } = await import('../modules/creator-auswahl/sourcingSpaltenSichtbarkeit.js');
const { renderItemRow } = await import('../modules/creator-auswahl/castingItemRow.js');
const { applyCastingRowUpdate } = await import('../modules/creator-auswahl/castingRealtime.js');
const { castingDetailRowActionsMethods } = await import('../modules/creator-auswahl/CastingDetailRowActions.js');
const { castingDetailProfilAbrufMethods } = await import('../modules/creator-auswahl/CastingDetailProfilAbruf.js');
const { creatorAuswahlService } = await import('../modules/creator-auswahl/CreatorAuswahlService.js');

const TT = 'https://www.tiktok.com/@kitchen.melda';
const UGC_HIDDEN = migrateHiddenColumns(berechneHiddenColumns({ liste_typ: 'ugc' }));

describe('TikTok-Link erkennen – linkZiel', () => {
  it('zieht einen TikTok-Link aus dem Instagram-Feld ins TikTok-Feld', () => {
    expect(linkZiel('link_instagram', TT)).toEqual({ feld: 'link_tiktok', wert: TT, plattform: 'tiktok' });
  });

  it('zieht einen Instagram-Link aus dem TikTok-Feld ins Instagram-Feld', () => {
    expect(linkZiel('link_tiktok', 'https://instagram.com/Lea.M?igsh=abc'))
      .toEqual({ feld: 'link_instagram', wert: 'https://www.instagram.com/lea.m/', plattform: 'instagram' });
  });

  it('kürzt TikTok-Video- und Share-Links auf das Profil', () => {
    expect(linkZiel('link_tiktok', 'https://www.tiktok.com/@Jana.Fellice/video/7634987669591690528').wert)
      .toBe('https://www.tiktok.com/@jana.fellice');
    expect(linkZiel('link_instagram', 'https://www.tiktok.com/@angymkvb?_r=1&_t=ZG-98IoZ6RUrIm'))
      .toMatchObject({ feld: 'link_tiktok', wert: 'https://www.tiktok.com/@angymkvb' });
  });

  it('lässt Handles, Reels, fremde Links und andere Felder stehen', () => {
    expect(linkZiel('link_instagram', '@lea.m')).toMatchObject({ feld: 'link_instagram', wert: '@lea.m' });
    expect(linkZiel('link_instagram', 'https://www.instagram.com/reel/DWtx7hWjFuH/').wert)
      .toBe('https://www.instagram.com/reel/DWtx7hWjFuH/');
    expect(linkZiel('link_tiktok', 'https://linktr.ee/lea')).toMatchObject({ feld: 'link_tiktok' });
    expect(linkZiel('notiz', TT)).toEqual({ feld: 'notiz', wert: TT, plattform: null });
    expect(linkZiel('link_instagram', null)).toMatchObject({ feld: 'link_instagram', wert: null });
  });

  it('baut Profil-URLs wie die Schnelleingabe', () => {
    expect(profilUrl('tiktok', '@Lea')).toBe('https://www.tiktok.com/@lea');
    expect(profilUrl('instagram', 'Lea')).toBe('https://www.instagram.com/lea/');
  });
});

describe('TikTok-Zeilen folgen den Einträgen', () => {
  it('blendet in einer UGC-Liste Link, Follower und Engagement von TikTok ein, sobald ein Eintrag TikTok hat', () => {
    const hidden = mitPlattformenDerEintraege(UGC_HIDDEN, [{ link_instagram: 'x' }, { link_tiktok: TT }]);

    for (const key of ['cp-col-link-tt', 'cp-col-follower-tt', 'cp-col-engagement-tt']) expect(hidden).not.toContain(key);
    for (const key of ['cp-col-views-tt-12', 'cp-col-cpm-tt-12', 'cp-col-preis-tt-video', 'cp-col-preis-reels']) expect(hidden).toContain(key);
    expect(mitPlattformenDerEintraege(UGC_HIDDEN, [{ link_instagram: 'x' }])).toEqual(UGC_HIDDEN);
    expect(plattformenDerEintraege([{ link_tiktok: TT }, {}])).toEqual(['tiktok']);
  });

  it('zeigt Link, Follower und Engagement aus dem Abruf in der TikTok-Zeile', () => {
    const item = { id: 'i1', link_tiktok: TT, follower_tiktok: 93300, tt_stats: { engagement_rate: 4.5 } };
    const html = renderItemRow({ isKunde: false, canEdit: true, hiddenColumns: mitPlattformenDerEintraege(UGC_HIDDEN, [item]) }, item, 0);
    const doc = new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
    const tt = (spalte) => doc.querySelector(`td.${spalte} [data-plattform="tiktok"]`);

    expect(tt('cp-col-link').querySelector('input[data-field="link_tiktok"]').value).toBe(TT);
    expect(tt('cp-col-follower').textContent).toContain('93,3K');
    expect(tt('cp-col-engagement').textContent).toContain('4,5 %');
  });
});

describe('TikTok-Link erkennen – Speichern in der Zeile', () => {
  let detail;

  beforeEach(() => {
    window.toastSystem = { show: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const fn of ['groupCollapsed', 'groupEnd', 'log', 'table']) vi.spyOn(console, fn).mockImplementation(() => {});
    vi.spyOn(creatorAuswahlService, 'updateItem').mockResolvedValue({});
    tiktokProfilAbrufen.mockReset();
    document.body.innerHTML = `<div id="root"><div class="chip-cell">
      <input data-field="link_instagram" data-item-id="i1" value="">
      <span data-chip-cell-action><button class="profil-abruf-btn" data-profil-abruf="instagram" data-item-id="i1"></button></span>
    </div></div>`;
    detail = {
      items: [{ id: 'i1', link_instagram: null, link_tiktok: null }, { id: 'i2', link_instagram: 'https://www.instagram.com/a/' }],
      isKunde: false,
      _canSourcing: () => true,
      _q: (sel) => document.getElementById('root').querySelector(sel),
      ...castingDetailRowActionsMethods,
      ...castingDetailProfilAbrufMethods,
      _meldeBekanntenCreator: vi.fn(async () => []),
      refreshItemRow: vi.fn(),
      rerenderTable: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.toastSystem;
    document.body.innerHTML = '';
  });

  const einfuegen = async (wert) => {
    const input = document.querySelector('input');
    input.dataset.fieldBaseline = '';
    input.value = wert;
    await detail.handleFieldUpdate(input);
    return input;
  };

  it('speichert einen TikTok-Link aus der Instagram-Zeile bei TikTok und blendet die TikTok-Zeilen ein', async () => {
    const input = await einfuegen('https://www.tiktok.com/@Kitchen.Melda?_r=1');

    expect(creatorAuswahlService.updateItem).toHaveBeenCalledWith('i1', { link_tiktok: TT });
    expect(detail.items[0]).toMatchObject({ link_tiktok: TT, link_instagram: null });
    expect(input.value).toBe('');
    expect(detail.rerenderTable).toHaveBeenCalled();
    expect(detail._meldeBekanntenCreator).not.toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledWith('TikTok-Link erkannt und beim TikTok-Profil eingetragen', 'info');
  });

  it('zeichnet nur die Zeile neu, wenn die Liste schon TikTok-Einträge hat', async () => {
    detail.items[1].link_tiktok = 'https://www.tiktok.com/@b';
    await einfuegen(TT);

    expect(detail.rerenderTable).not.toHaveBeenCalled();
    expect(detail.refreshItemRow).toHaveBeenCalledWith('i1');
  });

  it('leert einen falsch abgelegten Altwert beim Umzug, ein richtiger bleibt', async () => {
    detail.items[0].link_instagram = TT;
    await einfuegen('https://www.tiktok.com/@neu');
    expect(creatorAuswahlService.updateItem).toHaveBeenLastCalledWith('i1', { link_tiktok: 'https://www.tiktok.com/@neu', link_instagram: null });

    detail.items[0] = { id: 'i1', link_instagram: 'https://www.instagram.com/lea/' };
    const input = await einfuegen(TT);
    expect(creatorAuswahlService.updateItem).toHaveBeenLastCalledWith('i1', { link_tiktok: TT });
    expect(input.value).toBe('https://www.instagram.com/lea/');
  });

  it('ruft über den Instagram-Button mit TikTok-Link gleich TikTok ab', async () => {
    tiktokProfilAbrufen.mockResolvedValue({ item: { follower_tiktok: 93300 }, source: 'apify', username: 'kitchen.melda' });
    const input = document.querySelector('input');
    input.value = TT;

    await detail.handleInstagramFetch('i1', document.querySelector('button'));

    expect(creatorAuswahlService.updateItem).toHaveBeenCalledWith('i1', { link_tiktok: TT });
    expect(tiktokProfilAbrufen).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'i1', force: false }));
    expect(detail.items[0]).toMatchObject({ link_tiktok: TT, follower_tiktok: 93300, link_instagram: null });
  });

  it('räumt einen gespeicherten TikTok-Link im Instagram-Feld beim Abruf um', async () => {
    tiktokProfilAbrufen.mockResolvedValue({ item: {}, source: 'pool' });
    detail.items[0].link_instagram = TT;
    document.querySelector('input').value = TT;

    await detail.handleInstagramFetch('i1', document.querySelector('button'));

    expect(creatorAuswahlService.updateItem).toHaveBeenCalledWith('i1', { link_tiktok: TT, link_instagram: null });
    expect(tiktokProfilAbrufen).toHaveBeenCalled();
  });

  it('überschreibt beim Umräumen keinen anderen TikTok-Link', async () => {
    detail.items[0] = { id: 'i1', link_instagram: TT, link_tiktok: 'https://www.tiktok.com/@andere' };
    document.querySelector('input').value = TT;

    await detail.handleInstagramFetch('i1', document.querySelector('button'));

    expect(creatorAuswahlService.updateItem).not.toHaveBeenCalled();
    expect(tiktokProfilAbrufen).not.toHaveBeenCalled();
    expect(window.toastSystem.show.mock.calls[0][0]).toContain('schon ein anderer eingetragen');
  });
});

describe('TikTok-Link erkennen – Realtime', () => {
  it('zeichnet die ganze Tabelle neu, wenn der erste TikTok-Link von außen kommt', () => {
    document.body.innerHTML = '<table class="table-container"><tbody><tr class="item-row" data-item-id="i1"></tr></tbody></table>';
    const detail = {
      items: [{ id: 'i1', link_tiktok: null }],
      _q: (sel) => document.querySelector(sel),
      refreshItemRow: vi.fn(),
      rerenderTable: vi.fn(),
    };

    expect(applyCastingRowUpdate(detail, { id: 'i1', link_tiktok: TT })).toBe('applied');
    expect(detail.rerenderTable).toHaveBeenCalled();
    expect(detail.refreshItemRow).not.toHaveBeenCalled();
    document.body.innerHTML = '';
  });
});
