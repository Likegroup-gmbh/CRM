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
  loadUploadContext: vi.fn()
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
const player = { opts: null, ready: null };
vi.mock('../modules/video-browser/VideoBrowserPlayer.js', () => ({
  mountPlayer: (host, opts) => {
    host.innerHTML = '<div data-vb-frame></div>';
    player.opts = opts;
    return {
      seek: vi.fn(), getTime: () => 12.5, setMarkers: vi.fn(), markerEl: () => null, setRatio: vi.fn(), destroy: vi.fn(),
      whenReady: () => player.ready || Promise.resolve()
    };
  }
}));

const { mountVideoBrowserPane, unmountVideoBrowser } = await import('../modules/video-browser/VideoBrowser.js');
const { loadVideoBrowserData, saveWiedergabeMessung, saveZeitkommentar } = await import('../modules/video-browser/VideoBrowserAdapter.js');
const { prefetchLinks, warmNeighbors, stopWarming } = await import('../modules/video-browser/videoBrowserMedia.js');

function setup({ team }) {
  window.canFeature = (name) => ({
    videoTeamSicht: team, mediaUpload: team, skriptKommentieren: true
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
});
