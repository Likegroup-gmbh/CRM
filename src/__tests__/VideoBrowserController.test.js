import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RAW = {
  kooperationen: [
    { id: 'k1', name: 'Koop A', briefing_id: 'b1', creator: { vorname: 'Mia', nachname: 'Roth', instagram: 'https://instagram.com/mia.roth/' } },
    { id: 'k2', name: 'Koop B', briefing_id: null, creator: { vorname: 'Jan', nachname: 'Voss' } }
  ],
  linien: [],
  videos: [
    { id: 'v1', kooperation_id: 'k1', position: 1, titel: 'Hook', created_at: '2026-01-01' },
    { id: 'v3', kooperation_id: 'k2', position: 1, titel: 'Leer', created_at: '2026-01-03' }
  ],
  stories: [],
  videoAssets: [
    { id: 'a1', video_id: 'v1', version_number: 1, variant_name: 'A', is_final: false, created_at: '2026-02-01' }
  ],
  storyAssets: [],
  stillAssets: [],
  rohmaterial: [{ id: 'r1', kooperation_id: 'k1', file_name: 'clip.mov', file_size: 1024, created_at: '2026-01-10' }],
  slotNotes: [],
  zeitkommentare: []
};

vi.mock('../modules/video-browser/VideoBrowserAdapter.js', () => ({
  loadVideoBrowserData: vi.fn(async () => structuredClone(RAW)),
  saveZeitkommentar: vi.fn(async (input) => ({
    id: 'z-new', video_id: input.videoId, runde: input.runde, feedback_typ: input.isKunde ? 'kunde' : 'cj',
    text: input.text, timecode_sec: input.timecodeSec, asset_id: input.assetId, author_name: 'Tester', created_at: '2026-03-01'
  })),
  saveWiedergabeMessung: vi.fn(),
  loadUploadContext: vi.fn(),
  renameAsset: vi.fn(async (item, titel) => titel.trim()),
  deleteAsset: vi.fn(async () => {}),
  TITEL_MAX: 120
}));

vi.mock('../modules/video-browser/videoBrowserMedia.js', () => ({
  prefetchLinks: vi.fn(),
  warmNeighbors: vi.fn(),
  stopWarming: vi.fn()
}));

vi.mock('../modules/video-browser/VideoBrowserUpload.js', () => ({
  createUploader: () => ({ start: vi.fn(), destroy: vi.fn() })
}));

// Der Player meldet die Position über onTime. Tests stoßen sie von Hand an (bewegter Playhead).
const player = { opts: null, ready: null, mounts: 0, dims: null };
vi.mock('../modules/video-browser/VideoBrowserPlayer.js', () => ({
  mountPlayer: (host, opts) => {
    host.innerHTML = '<div data-vb-frame></div>';
    player.opts = opts;
    player.mounts += 1;
    return {
      seek: vi.fn(), getTime: () => 12.5, setMarkers: vi.fn(), markerEl: () => null, destroy: vi.fn(),
      getDimensions: () => player.dims,
      whenReady: () => player.ready || Promise.resolve()
    };
  }
}));

vi.mock('../core/PromoteFinalAsset.js', () => ({
  promoteAssetToFinal: vi.fn(async () => ({})),
  unmarkFinalSlot: vi.fn(async () => {})
}));

vi.mock('../modules/video-browser/videoBrowserRatio.js', () => ({
  ratioOfItem: vi.fn(async () => null),
  ratioOfFile: vi.fn(async () => null)
}));

const { mountVideoBrowserPane, unmountVideoBrowser } = await import('../modules/video-browser/VideoBrowser.js');
const { loadVideoBrowserData, saveWiedergabeMessung, saveZeitkommentar, renameAsset, deleteAsset } = await import('../modules/video-browser/VideoBrowserAdapter.js');
const { prefetchLinks, warmNeighbors, stopWarming } = await import('../modules/video-browser/videoBrowserMedia.js');
const { promoteAssetToFinal, unmarkFinalSlot } = await import('../core/PromoteFinalAsset.js');
const { ratioOfItem } = await import('../modules/video-browser/videoBrowserRatio.js');

function setup({ team, download = false }) {
  window.canFeature = (name) => ({
    videoTeamSicht: team, mediaUpload: team, skriptKommentieren: true, mediaDownload: download
  }[name] ?? false);
  window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} });
  window.history.replaceState(null, '', '/produktion/p1?tab=videos');
  const pane = document.createElement('div');
  document.body.appendChild(pane);
  const detail = { kampagneId: 'kamp', produktionId: 'p1', linien: [], linieAlle: false, linieId: null, produktion: { name: 'Prod' } };
  return { pane, detail };
}

const cols = (pane) => [...pane.querySelectorAll('.vb-col')];
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

describe('VideoBrowser Controller', () => {
  let ctx;
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { if (ctx) unmountVideoBrowser(ctx.detail); });

  it('baut Spalten Schritt für Schritt auf und spiegelt die Auswahl in die URL', async () => {
    ctx = setup({ team: true });
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    expect(cols(ctx.pane)).toHaveLength(1);

    click(ctx.pane.querySelector('.vb-col--0 .vb-row[data-id="k1"]'));
    expect(cols(ctx.pane)).toHaveLength(2);
    expect(window.location.search).toContain('k=k1');
    expect(window.location.search).toContain('tab=videos');

    click(ctx.pane.querySelector('.vb-col--1 .vb-row[data-id="v1"]'));
    expect(cols(ctx.pane)).toHaveLength(3);
    // Team sieht Rohmaterial und die Feedbackschleife
    const ordner = [...ctx.pane.querySelectorAll('.vb-col--2 .vb-row')].map(r => r.dataset.id);
    expect(ordner).toContain('raw');
    expect(ordner).toContain('s1');

    click(ctx.pane.querySelector('.vb-col--2 .vb-row[data-id="s1"]'));
    expect(cols(ctx.pane)).toHaveLength(4);
    expect(ctx.pane.querySelector('[data-vb-dropzone]')).not.toBeNull();

    const item = ctx.pane.querySelector('.vb-col--3 .vb-row[data-id="a1"]');
    click(item);
    expect(window.location.search).toContain('i=a1');
    expect(ctx.pane.querySelector('[data-vb-comment-form]')).not.toBeNull();
  });

  it('Pfadleiste springt zurück und leert tiefere Ebenen', async () => {
    ctx = setup({ team: true });
    window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1&f=s1&i=a1');
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    expect(cols(ctx.pane)).toHaveLength(4);

    click(ctx.pane.querySelector('[data-path-keep="2"]'));
    expect(cols(ctx.pane)).toHaveLength(3);
    expect(window.location.search).not.toContain('f=');
  });

  it('Kunde sieht weder Rohmaterial noch Upload-Zone', async () => {
    ctx = setup({ team: false });
    window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1');
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    const ordner = [...ctx.pane.querySelectorAll('.vb-col--2 .vb-row')].map(r => r.dataset.id);
    expect(ordner).not.toContain('raw');
    expect(ctx.pane.querySelector('[data-vb-dropzone]')).toBeNull();
    expect(ctx.pane.textContent).not.toContain('Rohmaterial');
  });

  it('ungültige URL-Auswahl fällt auf die gültige Tiefe zurück', async () => {
    ctx = setup({ team: true });
    window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=gibt-es-nicht&f=s1');
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    expect(cols(ctx.pane)).toHaveLength(2);
  });

  it('Pfeil rechts wählt die Zeile und fokussiert die nächste Spalte', async () => {
    ctx = setup({ team: true });
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    const row = ctx.pane.querySelector('.vb-col--0 .vb-row[data-id="k1"]');
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(cols(ctx.pane)).toHaveLength(2);
    expect(document.activeElement?.dataset?.depth).toBe('1');
  });

  it('Kommentar mit Timecode wird gespeichert und angehängt', async () => {
    ctx = setup({ team: true });
    window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1&f=s1&i=a1');
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    const form = ctx.pane.querySelector('[data-vb-comment-form]');
    player.opts.onTime(12.5);
    form.querySelector('[data-vb-comment-text]').value = 'Logo früher';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(ctx.pane.querySelectorAll('.vb-comment').length).toBe(1));
    expect(saveZeitkommentar).toHaveBeenCalledWith(expect.objectContaining({ videoId: 'v1', runde: 1, assetId: 'a1', timecodeSec: 12.5, isKunde: false }));
  });

  it('Zeitstempel ist aus, solange der Playhead nicht bewegt wurde, und folgt ihm danach', async () => {
    ctx = setup({ team: true });
    window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1&f=s1&i=a1');
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    const pin = ctx.pane.querySelector('[data-vb-pin]');
    expect(pin.checked).toBe(false);
    expect(ctx.pane.querySelector('.vb-comment-form__pin').textContent).toContain('Zeitstempel anhängen');

    player.opts.onTime(12.5);
    expect(pin.checked).toBe(true);
    expect(ctx.pane.querySelector('[data-vb-pin-time]').textContent).toBe('0:12');

    player.opts.onTime(0);
    expect(pin.checked).toBe(false);

    // Bewusste Wahl des Nutzers schlägt die Automatik
    pin.checked = true;
    pin.dispatchEvent(new Event('change', { bubbles: true }));
    player.opts.onTime(0);
    expect(pin.checked).toBe(true);
  });

  it('ohne Zeitstempel wird der Kommentar ohne Timecode gespeichert', async () => {
    ctx = setup({ team: true });
    saveZeitkommentar.mockClear();
    window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1&f=s1&i=a1');
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    const form = ctx.pane.querySelector('[data-vb-comment-form]');
    form.querySelector('[data-vb-comment-text]').value = 'Allgemein';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(saveZeitkommentar).toHaveBeenCalled());
    expect(saveZeitkommentar).toHaveBeenCalledWith(expect.objectContaining({ timecodeSec: null }));
  });

  it('Speicherfehler nennt den Grund im Toast und behält den Entwurf', async () => {
    ctx = setup({ team: false });
    window.toastSystem = { show: vi.fn() };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    saveZeitkommentar.mockRejectedValueOnce({ code: '42501', message: 'new row violates row-level security policy' });
    window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1&f=s1&i=a1');
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    const form = ctx.pane.querySelector('[data-vb-comment-form]');
    const text = form.querySelector('[data-vb-comment-text]');
    text.value = 'approved';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Keine Berechtigung, hier zu kommentieren.', 'error'));
    expect(saveZeitkommentar).toHaveBeenLastCalledWith(expect.objectContaining({ isKunde: true }));
    expect(text.value).toBe('approved');
    expect(ctx.pane.querySelectorAll('.vb-comment')).toHaveLength(0);
    expect(form.dataset.busy).toBeUndefined();
    expect(form.querySelector('[data-vb-comment-send]').disabled).toBe(false);
    spy.mockRestore();
    delete window.toastSystem;
  });

  it('Ordner mit einer Datei öffnet direkt die Datei', async () => {
    ctx = setup({ team: true });
    window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1');
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    click(ctx.pane.querySelector('.vb-col--2 .vb-row[data-id="s1"]'));
    expect(window.location.search).toContain('f=s1');
    expect(window.location.search).toContain('i=a1');
    expect(ctx.pane.querySelector('[data-vb-comment-form]')).not.toBeNull();

    // Zurück auf den Ordner (Pfadleiste) bleibt dort, die Automatik greift nur beim Öffnen
    click(ctx.pane.querySelector('[data-path-keep="3"]'));
    expect(window.location.search).toContain('f=s1');
    expect(window.location.search).not.toContain('i=a1');
  });

  it('alle Spalten bleiben ausgeklappt, egal wie tief die Auswahl ist', async () => {
    ctx = setup({ team: true });
    window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1');
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    click(ctx.pane.querySelector('.vb-col--2 .vb-row[data-id="s1"]'));
    expect(cols(ctx.pane)).toHaveLength(4);
    cols(ctx.pane).forEach(col => expect(col.className).not.toMatch(/rail|collapsed/));
    // Namen und Meta bleiben sichtbar (kein Verstecken per Klasse)
    expect(ctx.pane.querySelector('.vb-col--1 .vb-row__name').textContent).toBe('Hook');
    // Die Pfadleiste erscheint nur bei horizontalem Scrollen, nicht allein durch Tiefe
    expect(ctx.pane.querySelector('[data-vb]').classList.contains('vb--path')).toBe(false);
  });

  it('Liste zeigt keine Bearbeitungsart, alle Spalten sind gleich aufgebaut (kein Trenner)', async () => {
    ctx = setup({ team: true });
    window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1');
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    expect(ctx.pane.querySelector('.vb-col--0').textContent).not.toMatch(/extern|intern/);
    expect(ctx.pane.querySelector('.vb-col--2 .vb-rows__divider')).toBeNull();
    expect([...ctx.pane.querySelectorAll('.vb-col--2 .vb-rows > li')].every(li => li.querySelector('.vb-row'))).toBe(true);
  });

  it('Status steht als Punkt in der Meta-Zeile, der Zähler nur an der Kooperation', async () => {
    ctx = setup({ team: true });
    window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1');
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    const video = ctx.pane.querySelector('.vb-col--1 .vb-row[data-id="v1"]');
    expect(video.querySelector('.vb-dot--wartet')).not.toBeNull();
    expect(video.textContent).toContain('Wartet auf Kunde');
    expect(video.querySelector('.vb-count')).toBeNull();
    expect(ctx.pane.querySelector('.vb-col--2 .vb-count')).toBeNull();
    const koop = ctx.pane.querySelector('.vb-col--0 .vb-row[data-id="k1"] .vb-count');
    expect(koop.getAttribute('title')).toBe('1 Datei beim Kunden');
    // Der Konzeptname ist der Titel, Video-Nr die Meta-Info
    expect(video.querySelector('.vb-row__name').textContent).toBe('Hook');
    expect(video.querySelector('.vb-row__meta').textContent).toContain('Video 1');
  });

  it('Detail nennt die Feedbackschleife statt "Version" und zeigt keinen Kontext-Pfad', async () => {
    ctx = setup({ team: true });
    window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1&f=s1&i=a1');
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    expect(ctx.pane.querySelector('[data-vb-asset-version]').textContent).toBe('Feedbackschleife 1');
    expect(ctx.pane.textContent).not.toMatch(/Version \d/);
    expect(ctx.pane.querySelector('p.vb-detail__eyebrow')).toBeNull();
    expect(ctx.pane.querySelector('[data-slot="decision"]').textContent).toMatch(/^Wartet (seit .+ )?auf den Kunden\.$/);
    expect(ctx.pane.querySelector('.vb-item.has-side')).not.toBeNull();
  });

  it('nutzt semantisches HTML: Listen, Überschriften, aria-current', async () => {
    ctx = setup({ team: true });
    window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1&f=s1&i=a1');
    await mountVideoBrowserPane(ctx.detail, ctx.pane);

    // Zeilen sind Buttons in Listeneinträgen, die Auswahl steht in aria-current
    const row = ctx.pane.querySelector('.vb-col--0 .vb-row[data-id="k1"]');
    expect(row.parentElement.tagName).toBe('LI');
    expect(row.parentElement.parentElement.tagName).toBe('UL');
    expect(row.getAttribute('aria-current')).toBe('true');
    expect(row.hasAttribute('aria-pressed')).toBe(false);

    // Spaltentitel sind Überschriften, die Spalte verweist per aria-labelledby darauf
    const col = ctx.pane.querySelector('.vb-col--0');
    const heading = col.querySelector('h3.vb-col__title');
    expect(col.getAttribute('aria-labelledby')).toBe(heading.id);

    // Kommentarbereich: Überschrift + Liste, Textfeld mit echtem Label
    expect(ctx.pane.querySelector('h5.vb-detail__eyebrow')).not.toBeNull();
    const text = ctx.pane.querySelector('[data-vb-comment-text]');
    expect(ctx.pane.querySelector(`label[for="${text.id}"]`)).not.toBeNull();

    // Kein Block-Element direkt unter einer Liste
    ctx.pane.querySelectorAll('ul, ol').forEach((list) => {
      [...list.children].forEach(child => expect(child.tagName).toBe('LI'));
    });
  });

  it('Unmount räumt das Pane leer', async () => {
    ctx = setup({ team: true });
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    unmountVideoBrowser(ctx.detail);
    expect(ctx.pane.innerHTML).toBe('');
  });

  describe('Dateikopf: Titel, Herunterladen, Bearbeiten, Löschen', () => {
    const mitDatei = () => ({
      ...structuredClone(RAW),
      videoAssets: [{ ...RAW.videoAssets[0], file_path: '/K/a1.mp4' }]
    });
    const openA1 = async (opts) => {
      ctx = setup(opts);
      window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1&f=s1&i=a1');
      await mountVideoBrowserPane(ctx.detail, ctx.pane);
    };
    const title = () => ctx.pane.querySelector('[data-vb-asset-title]');
    const input = () => ctx.pane.querySelector('[data-vb-title-input]');
    const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

    beforeEach(() => {
      renameAsset.mockClear();
      deleteAsset.mockClear();
      loadVideoBrowserData.mockClear();
    });

    it('Titel oben, darunter Feedbackschleife mit Status und daneben die Aktionen', async () => {
      loadVideoBrowserData.mockResolvedValueOnce(mitDatei());
      await openA1({ team: true, download: true });
      const head = ctx.pane.querySelector('.vb-asset-head');
      expect(head.firstElementChild).toBe(title());
      const zeile = head.querySelector('.vb-asset-head__row');
      expect(zeile.querySelector('[data-vb-asset-version]').textContent).toBe('Feedbackschleife 1');
      expect(zeile.querySelector('.vb-status')).not.toBeNull();
      const aktionen = [...zeile.querySelectorAll('.vb-asset-head__actions .vb-icon-btn')].map(b => b.getAttribute('aria-label'));
      expect(aktionen).toEqual(['Herunterladen', 'Titel bearbeiten', 'Löschen']);
    });

    it('Kunde sieht nur Herunterladen', async () => {
      loadVideoBrowserData.mockResolvedValueOnce(mitDatei());
      await openA1({ team: false, download: true });
      expect(ctx.pane.querySelector('[data-vb-download="item"]')).not.toBeNull();
      expect(ctx.pane.querySelector('[data-vb-edit]')).toBeNull();
      expect(ctx.pane.querySelector('[data-vb-delete]')).toBeNull();
    });

    it('Bearbeiten macht den Titel an Ort und Stelle editierbar, Enter speichert ohne neuen Player', async () => {
      await openA1({ team: true });
      const mounts = player.mounts;
      click(ctx.pane.querySelector('[data-vb-edit]'));
      expect(input().value).toBe('Video A');
      expect(ctx.pane.querySelector('[data-vb-edit]').getAttribute('aria-label')).toBe('Titel speichern');

      input().value = '  Interview Kudamm ';
      key(input(), 'Enter');
      await vi.waitFor(() => expect(input()).toBeNull());
      expect(renameAsset).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), 'Interview Kudamm');
      expect(title().textContent).toBe('Interview Kudamm');
      expect(ctx.pane.querySelector('.vb-col--3 .vb-row[data-id="a1"] .vb-row__name').textContent).toBe('Interview Kudamm');
      expect(player.mounts).toBe(mounts);
      expect(ctx.pane.querySelector('[data-vb-edit]').getAttribute('aria-label')).toBe('Titel bearbeiten');
    });

    it('Escape bricht ab, unveränderter oder leerer Titel speichert nichts', async () => {
      await openA1({ team: true });
      click(ctx.pane.querySelector('[data-vb-edit]'));
      input().value = 'Verworfen';
      key(input(), 'Escape');
      expect(input()).toBeNull();
      expect(title().textContent).toBe('Video A');

      click(ctx.pane.querySelector('[data-vb-edit]'));
      input().value = '   ';
      click(ctx.pane.querySelector('[data-vb-edit]'));
      expect(input()).toBeNull();
      expect(title().textContent).toBe('Video A');
      expect(renameAsset).not.toHaveBeenCalled();
    });

    it('Löschen fragt per Dialog nach und springt danach auf den Ordner', async () => {
      await openA1({ team: true });
      click(ctx.pane.querySelector('[data-vb-delete]'));
      const modal = document.body.querySelector('.modal');
      expect(modal.textContent).toContain('„Video A“ wird endgültig gelöscht');
      click(modal.querySelector('[data-action="confirm"]'));
      await vi.waitFor(() => expect(loadVideoBrowserData).toHaveBeenCalledTimes(2));
      expect(deleteAsset).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
      expect(window.location.search).toContain('f=s1');
      expect(window.location.search).not.toContain('i=a1');
    });

    it('abgebrochener Dialog löscht nichts', async () => {
      await openA1({ team: true });
      click(ctx.pane.querySelector('[data-vb-delete]'));
      click(document.body.querySelector('.modal [data-action="cancel"]'));
      await Promise.resolve();
      expect(deleteAsset).not.toHaveBeenCalled();
      expect(window.location.search).toContain('i=a1');
    });
  });

  describe('Medien vorbereiten', () => {
    // Zweite Datei in Feedbackschleife 1, damit a1 einen Nachbarn hat
    const mitNachbar = () => ({
      ...structuredClone(RAW),
      videoAssets: [...RAW.videoAssets, { id: 'a2', video_id: 'v1', version_number: 1, variant_name: 'B', is_final: false, created_at: '2026-02-02' }]
    });
    const flush = async () => { for (let i = 0; i < 3; i += 1) await Promise.resolve(); };

    beforeEach(() => {
      warmNeighbors.mockClear();
      prefetchLinks.mockClear();
      stopWarming.mockClear();
    });
    afterEach(() => {
      player.ready = null;
      vi.useRealTimers();
    });

    it('wärmt die Nachbarn erst, wenn das aktive Video durchspielbar ist', async () => {
      let ready;
      player.ready = new Promise((r) => { ready = r; });
      loadVideoBrowserData.mockResolvedValueOnce(mitNachbar());
      ctx = setup({ team: true });
      window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1&f=s1&i=a1');
      await mountVideoBrowserPane(ctx.detail, ctx.pane);
      await flush();
      expect(prefetchLinks).toHaveBeenCalled();
      expect(warmNeighbors).not.toHaveBeenCalled();
      ready();
      await flush();
      expect(warmNeighbors).toHaveBeenCalledTimes(1);
      expect(warmNeighbors.mock.calls[0][0].map(i => i.id)).toEqual(['a2']);
    });

    it('wärmt spätestens nach 4 s, auch wenn das aktive Video noch lädt', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      player.ready = new Promise(() => {});
      loadVideoBrowserData.mockResolvedValueOnce(mitNachbar());
      ctx = setup({ team: true });
      window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1&f=s1&i=a1');
      await mountVideoBrowserPane(ctx.detail, ctx.pane);
      await vi.advanceTimersByTimeAsync(3999);
      expect(warmNeighbors).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(warmNeighbors).toHaveBeenCalledTimes(1);
    });

    it('verwirft das Vorwärmen einer verlassenen Auswahl und räumt beim Schließen auf', async () => {
      let ready;
      player.ready = new Promise((r) => { ready = r; });
      loadVideoBrowserData.mockResolvedValueOnce(mitNachbar());
      ctx = setup({ team: true });
      window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1&f=s1&i=a1');
      await mountVideoBrowserPane(ctx.detail, ctx.pane);
      click(ctx.pane.querySelector('[data-path-keep="1"]'));
      ready();
      await flush();
      expect(warmNeighbors).not.toHaveBeenCalled();
      unmountVideoBrowser(ctx.detail);
      expect(stopWarming).toHaveBeenCalled();
    });

    it('legt die Messung des Players mit der Ansicht ab', async () => {
      ctx = setup({ team: false });
      window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1&f=s1&i=a1');
      await mountVideoBrowserPane(ctx.detail, ctx.pane);
      player.opts.onMessung({ quelle: 'original', ttff_ms: 800 });
      expect(saveWiedergabeMessung).toHaveBeenCalledWith({ quelle: 'original', ttff_ms: 800 }, { team: false });
    });
  });

  describe('Finale Version', () => {
    const FINAL_A = { id: 'f1', video_id: 'v1', version_number: 1, variant_name: '4:5', is_final: true, source_asset_id: 'a1', created_at: '2026-03-01' };
    const mitFinal = () => ({ ...structuredClone(RAW), videoAssets: [...RAW.videoAssets, FINAL_A] });
    const open = async (query, opts = { team: true }) => {
      ctx = setup(opts);
      window.history.replaceState(null, '', `/produktion/p1?tab=videos&k=k1&v=v1&${query}`);
      await mountVideoBrowserPane(ctx.detail, ctx.pane);
    };

    beforeEach(() => {
      promoteAssetToFinal.mockClear();
      unmarkFinalSlot.mockClear();
      ratioOfItem.mockReset();
      ratioOfItem.mockResolvedValue(null);
      loadVideoBrowserData.mockClear();
      player.dims = null;
      window.toastSystem = { show: vi.fn() };
    });
    afterEach(() => { delete window.toastSystem; });

    it('Team sieht im Dateikopf einer Schleife den Freigabe-Button, Kunde nicht', async () => {
      await open('f=s1&i=a1');
      const btn = ctx.pane.querySelector('.vb-asset-head [data-vb-promote]');
      expect(btn.textContent).toContain('Als finale Version freigeben');
      expect(ctx.pane.querySelector('[data-vb-unmark]')).toBeNull();
      unmountVideoBrowser(ctx.detail);

      await open('f=s1&i=a1', { team: false });
      expect(ctx.pane.querySelector('[data-vb-promote]')).toBeNull();
    });

    it('ein Klick: Format kommt aus der Datei, danach springt die Ansicht in die Finale Version', async () => {
      player.dims = { width: 1080, height: 1350 };
      await open('f=s1&i=a1');
      loadVideoBrowserData.mockResolvedValueOnce(mitFinal());
      click(ctx.pane.querySelector('[data-vb-promote]'));
      await vi.waitFor(() => expect(window.location.search).toContain('i=f1'));
      expect(promoteAssetToFinal).toHaveBeenCalledWith('video', expect.objectContaining({ id: 'a1' }), '4:5');
      expect(window.location.search).toContain('f=final');
      expect(window.toastSystem.show).toHaveBeenCalledWith('Als Finale Version freigegeben.', 'success');
      expect(ctx.pane.querySelector('[data-vb-asset-version]').textContent).toBe('Finale Version · 4:5');
      expect(ctx.pane.querySelector('[data-vb-unmark]')).not.toBeNull();
      expect(ctx.pane.querySelector('[data-vb-promote]')).toBeNull();
      // Kein Format-Umschalter mehr
      expect(ctx.pane.querySelector('[data-vb-formats]')).toBeNull();
    });

    it('erkennt das System kein Format, fragt ein Menü danach und die Wahl gibt frei', async () => {
      await open('f=s1&i=a1');
      const menu = ctx.pane.querySelector('[data-vb-promote-menu]');
      expect(menu.hidden).toBe(true);
      click(ctx.pane.querySelector('[data-vb-promote]'));
      await vi.waitFor(() => expect(menu.hidden).toBe(false));
      expect(promoteAssetToFinal).not.toHaveBeenCalled();

      loadVideoBrowserData.mockResolvedValueOnce(mitFinal());
      click(menu.querySelector('[data-vb-promote-slot="1:1"]'));
      await vi.waitFor(() => expect(promoteAssetToFinal).toHaveBeenCalledWith('video', expect.objectContaining({ id: 'a1' }), '1:1'));
    });

    it('Fehler bei der Freigabe nennt den Grund im Toast und lässt den Button frei', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      player.dims = { width: 1080, height: 1920 };
      promoteAssetToFinal.mockRejectedValueOnce(new Error('kaputt'));
      await open('f=s1&i=a1');
      const btn = ctx.pane.querySelector('[data-vb-promote]');
      click(btn);
      await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Freigabe als Finale Version fehlgeschlagen.', 'error'));
      expect(btn.disabled).toBe(false);
      expect(window.location.search).toContain('f=s1');
      spy.mockRestore();
    });

    it('freigegebene Datei zeigt Badge mit Format statt Freigabe-Button', async () => {
      loadVideoBrowserData.mockResolvedValueOnce(mitFinal());
      await open('f=s1&i=a1');
      expect(ctx.pane.querySelector('[data-vb-promote]')).toBeNull();
      expect(ctx.pane.querySelector('.vb-asset-head__actions .status-badge.success').textContent).toBe('Final · 4:5');
      expect(ctx.pane.querySelector('[data-vb-unmark="f1"]')).not.toBeNull();
    });

    it('Final aufheben nimmt nur den Verweis zurück und springt zur Quelle', async () => {
      loadVideoBrowserData.mockResolvedValueOnce(mitFinal());
      await open('f=final&i=f1');
      click(ctx.pane.querySelector('[data-vb-unmark="f1"]'));
      await vi.waitFor(() => expect(window.location.search).toContain('i=a1'));
      expect(unmarkFinalSlot).toHaveBeenCalledWith('video', 'v1', '4:5', 'a1');
      expect(window.location.search).toContain('f=s1');
    });

    it('hochgeladene Finale (ohne Quelle) haben kein Final aufheben, nur Löschen', async () => {
      const data = mitFinal();
      data.videoAssets[data.videoAssets.length - 1] = { ...FINAL_A, source_asset_id: null };
      loadVideoBrowserData.mockResolvedValueOnce(data);
      await open('f=final&i=f1');
      expect(ctx.pane.querySelector('[data-vb-unmark]')).toBeNull();
      expect(ctx.pane.querySelector('[data-vb-delete]')).not.toBeNull();
    });

    it('Ordner Finale Version ist für das Team auch leer da und hat eine Dropzone', async () => {
      await open('f=final');
      const col = ctx.pane.querySelector('.vb-col--3');
      expect(col.querySelector('[data-vb-dropzone]').textContent).toContain('Finale Dateien hierher ziehen');
      expect(col.textContent).toContain('Noch keine Finale Version');
      expect(ctx.pane.querySelector('.vb-col--2 .vb-row[data-id="final"]')).not.toBeNull();
    });

    it('Kunde sieht den leeren Ordner Finale Version nicht', async () => {
      await open('', { team: false });
      expect(ctx.pane.querySelector('.vb-col--2 .vb-row[data-id="final"]')).toBeNull();
    });
  });
});
