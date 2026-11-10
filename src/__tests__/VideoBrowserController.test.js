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
  renameAdManagerFile: vi.fn(async (item, name) => ({ path: `/K/${name}.mp4`, stem: name })),
  deleteAsset: vi.fn(async () => {}),
  insertVarianteTag: vi.fn(async ({ videoId, variantKey, tagTypId }) => ({ video_id: videoId, variant_key: variantKey, tag_typ_id: tagTypId })),
  deleteVarianteTag: vi.fn(async () => {}),
  createTagTyp: vi.fn(async ({ label, gruppe, kampagneId }) => ({ id: `t-${label}`, label, gruppe, kampagne_id: kampagneId })),
  saveVideoCaption: vi.fn(async (_id, caption) => String(caption || '').trim() || null),
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
const { loadVideoBrowserData, saveWiedergabeMessung, saveZeitkommentar, renameAsset, renameAdManagerFile, deleteAsset, insertVarianteTag, deleteVarianteTag, createTagTyp, saveVideoCaption } = await import('../modules/video-browser/VideoBrowserAdapter.js');
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

  it('Detail nennt die Feedbackschleife statt "Version", hat eine Kontextzeile und Tabs', async () => {
    ctx = setup({ team: true });
    window.history.replaceState(null, '', '/produktion/p1?tab=videos&k=k1&v=v1&f=s1&i=a1');
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
    expect(ctx.pane.querySelector('[data-vb-asset-version]').textContent).toBe('Feedbackschleife 1');
    expect(ctx.pane.textContent).not.toMatch(/Version \d/);
    expect(ctx.pane.querySelector('.vb-asset-head__context').textContent).toMatch(/Video 1 · Feedbackschleife 1$/);
    expect(ctx.pane.querySelector('p.vb-detail__eyebrow')).toBeNull();
    expect(ctx.pane.querySelector('[data-slot="decision"]').textContent).toMatch(/^Wartet (seit .+ )?auf den Kunden\.$/);
    // Ohne Datei in Dropbox gibt es keinen Ad-Manager-Tab
    expect([...ctx.pane.querySelectorAll('[role="tab"]')].map(t => t.dataset.vbTab)).toEqual(['details', 'kommentare']);
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
      renameAdManagerFile.mockClear();
      deleteAsset.mockClear();
      loadVideoBrowserData.mockClear();
    });

    it('Kontextzeile mit Toolbar, darunter Titel und Meta-Zeile mit Feedbackschleife und Status', async () => {
      loadVideoBrowserData.mockResolvedValueOnce(mitDatei());
      await openA1({ team: true, download: true });
      const [top, titel, meta] = ctx.pane.querySelector('.vb-asset-head').children;
      expect(titel).toBe(title());
      expect(titel.getAttribute('role')).toBe('button');
      expect(meta.querySelector('[data-vb-asset-version]').textContent).toBe('Feedbackschleife 1');
      expect(meta.querySelector('.vb-status')).not.toBeNull();
      const aktionen = [...top.querySelectorAll('.vb-asset-head__actions .vb-icon-btn')].map(b => b.getAttribute('aria-label'));
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

    it('Ad-Manager-Dateiname: eigene Zeile, Titel bleibt unberührt, Speichern benennt die Datei um', async () => {
      loadVideoBrowserData.mockImplementation(async () => mitDatei());
      await openA1({ team: true });
      const name = () => ctx.pane.querySelector('[data-vb-file-name]');
      expect(name().textContent).toBe('a1.mp4');
      click(ctx.pane.querySelector('[data-vb-edit-file]'));
      const fileInput = ctx.pane.querySelector('[data-vb-file-input]');
      expect(fileInput.value).toBe('a1');
      expect(name().textContent).toBe('.mp4');
      fileInput.value = 'Acme_Spot_9x16';
      key(fileInput, 'Enter');
      await vi.waitFor(() => expect(renameAdManagerFile).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), 'Acme_Spot_9x16'));
      await vi.waitFor(() => expect(loadVideoBrowserData).toHaveBeenCalledTimes(2));
      expect(renameAsset).not.toHaveBeenCalled();
    });

    it('Ad-Manager-Dateiname: Escape und unveränderter Name speichern nichts, Kunden sehen die Zeile nicht', async () => {
      loadVideoBrowserData.mockImplementation(async () => mitDatei());
      await openA1({ team: true });
      click(ctx.pane.querySelector('[data-vb-edit-file]'));
      ctx.pane.querySelector('[data-vb-file-input]').value = 'Verworfen';
      key(ctx.pane.querySelector('[data-vb-file-input]'), 'Escape');
      expect(ctx.pane.querySelector('[data-vb-file-name]').textContent).toBe('a1.mp4');
      click(ctx.pane.querySelector('[data-vb-edit-file]'));
      click(ctx.pane.querySelector('[data-vb-edit-file]'));
      expect(renameAdManagerFile).not.toHaveBeenCalled();
      unmountVideoBrowser(ctx.detail);
      loadVideoBrowserData.mockImplementation(async () => mitDatei());
      await openA1({ team: false });
      expect(ctx.pane.querySelector('[data-vb-file-name]')).toBeNull();
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
    const bar = () => ctx.pane.querySelector('[data-vb-final-toggle]');
    const shown = () => window.toastSystem.show.mock.calls;

    beforeEach(() => {
      promoteAssetToFinal.mockClear();
      unmarkFinalSlot.mockClear();
      ratioOfItem.mockReset();
      ratioOfItem.mockResolvedValue(null);
      loadVideoBrowserData.mockReset();
      loadVideoBrowserData.mockImplementation(async () => structuredClone(RAW));
      player.dims = null;
      window.toastSystem = { show: vi.fn() };
    });
    afterEach(() => { delete window.toastSystem; });

    it('Team sieht Final-Leiste und Schnell-Stern, Kunde nichts davon', async () => {
      await open('f=s1&i=a1');
      expect(bar().getAttribute('aria-pressed')).toBe('false');
      expect(bar().textContent).toContain('Als final markieren');
      expect(ctx.pane.querySelector('[data-vb-star="a1"]').getAttribute('aria-pressed')).toBe('false');
      unmountVideoBrowser(ctx.detail);

      await open('f=s1&i=a1', { team: false });
      expect(bar()).toBeNull();
      expect(ctx.pane.querySelector('[data-vb-star]')).toBeNull();
    });

    it('ein Klick markiert sofort, der Player bleibt stehen, die Auswahl auch, Rückgängig nimmt es zurück', async () => {
      player.dims = { width: 1080, height: 1350 };
      await open('f=s1&i=a1');
      const mounts = player.mounts;
      click(bar());
      await vi.waitFor(() => expect(promoteAssetToFinal).toHaveBeenCalledWith('video', expect.objectContaining({ id: 'a1' }), '4:5'));
      expect(bar().getAttribute('aria-pressed')).toBe('true');
      expect(bar().textContent).toContain('Final · 4:5');
      expect(ctx.pane.querySelector('[data-vb-final-badge]').textContent).toBe('Final · 4:5');
      expect(ctx.pane.querySelector('[data-vb-star="a1"]').getAttribute('aria-pressed')).toBe('true');
      expect(player.mounts).toBe(mounts);
      expect(window.location.search).toContain('i=a1');

      const call = shown().find(c => c[0] === 'Als final markiert.');
      expect(call[1]).toBe('success');
      expect(call[3].action.label).toBe('Rückgängig');
      call[3].action.onClick();
      await vi.waitFor(() => expect(unmarkFinalSlot).toHaveBeenCalledWith('video', 'v1', '4:5', 'a1'));
      expect(bar().getAttribute('aria-pressed')).toBe('false');
      expect(ctx.pane.querySelector('[data-vb-final-badge]')).toBeNull();
    });

    it('Schnell-Stern markiert, ohne die Datei zu öffnen', async () => {
      ratioOfItem.mockResolvedValue('9:16');
      await open('f=s1');
      expect(window.location.search).not.toContain('i=');
      click(ctx.pane.querySelector('[data-vb-star="a1"]'));
      await vi.waitFor(() => expect(promoteAssetToFinal).toHaveBeenCalledWith('video', expect.objectContaining({ id: 'a1' }), '9:16'));
      expect(window.location.search).not.toContain('i=');
      expect(ctx.pane.querySelector('[data-vb-star="a1"]').getAttribute('aria-pressed')).toBe('true');
      // Im Ordner Finale Version taucht die Datei auf
      expect(ctx.pane.querySelector('.vb-col--2 [data-folder-id="final"] [data-slot="icon"]')).not.toBeNull();
    });

    it('erkennt das System kein Format, fragt ein Menü danach und die Wahl markiert', async () => {
      await open('f=s1&i=a1');
      const menu = ctx.pane.querySelector('[data-vb-promote-menu]');
      expect(menu.hidden).toBe(true);
      click(bar());
      await vi.waitFor(() => expect(ctx.pane.querySelector('[data-vb-promote-menu]').hidden).toBe(false));
      expect(promoteAssetToFinal).not.toHaveBeenCalled();
      expect(bar().getAttribute('aria-pressed')).toBe('false');

      click(ctx.pane.querySelector('[data-vb-promote-slot="1:1"]'));
      await vi.waitFor(() => expect(promoteAssetToFinal).toHaveBeenCalledWith('video', expect.objectContaining({ id: 'a1' }), '1:1'));
    });

    it('Fehler beim Markieren rollt zurück und nennt den Grund im Toast', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      player.dims = { width: 1080, height: 1920 };
      promoteAssetToFinal.mockRejectedValueOnce(new Error('kaputt'));
      await open('f=s1&i=a1');
      click(bar());
      await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Final markieren fehlgeschlagen.', 'error'));
      expect(bar().getAttribute('aria-pressed')).toBe('false');
      expect(ctx.pane.querySelector('[data-vb-final-badge]')).toBeNull();
      expect(window.location.search).toContain('f=s1');
      spy.mockRestore();
    });

    it('markierte Datei zeigt gedrückte Leiste mit Format, ein Klick hebt auf', async () => {
      loadVideoBrowserData.mockResolvedValueOnce(mitFinal());
      await open('f=s1&i=a1');
      expect(bar().getAttribute('aria-pressed')).toBe('true');
      expect(bar().textContent).toContain('Final · 4:5');
      expect(ctx.pane.querySelector('[data-vb-final-badge]').textContent).toBe('Final · 4:5');
      click(bar());
      await vi.waitFor(() => expect(unmarkFinalSlot).toHaveBeenCalledWith('video', 'v1', '4:5', 'a1'));
      expect(bar().getAttribute('aria-pressed')).toBe('false');
    });

    it('Taste F markiert, im Player gehört F dem Vollbild', async () => {
      player.dims = { width: 1080, height: 1920 };
      await open('f=s1&i=a1');
      const fake = document.createElement('div');
      fake.className = 'vb-player';
      fake.tabIndex = 0;
      ctx.pane.querySelector('[data-vb-player-host]').appendChild(fake);
      fake.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
      expect(promoteAssetToFinal).not.toHaveBeenCalled();

      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
      await vi.waitFor(() => expect(promoteAssetToFinal).toHaveBeenCalledWith('video', expect.objectContaining({ id: 'a1' }), '9:16'));
    });

    it('Final aufheben im Ordner Finale Version nimmt nur den Verweis zurück und springt zur Quelle', async () => {
      loadVideoBrowserData.mockResolvedValueOnce(mitFinal());
      await open('f=final&i=f1');
      expect(ctx.pane.querySelector('[data-vb-delete]')).toBeNull();
      expect(ctx.pane.querySelector('[data-vb-final-remove]').getAttribute('aria-label')).toBe('Aus Finale Version entfernen');
      click(ctx.pane.querySelector('[data-vb-final-remove]'));
      await vi.waitFor(() => expect(window.location.search).toContain('i=a1'));
      expect(unmarkFinalSlot).toHaveBeenCalledWith('video', 'v1', '4:5', 'a1');
      expect(window.location.search).toContain('f=s1');
    });

    it('hochgeladene Finale (ohne Quelle) haben weder Leiste noch Entfernen, nur Löschen', async () => {
      const data = mitFinal();
      data.videoAssets[data.videoAssets.length - 1] = { ...FINAL_A, source_asset_id: null };
      loadVideoBrowserData.mockResolvedValueOnce(data);
      await open('f=final&i=f1');
      expect(bar()).toBeNull();
      expect(ctx.pane.querySelector('[data-vb-final-remove]')).toBeNull();
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

  describe('Tabs, Ad Manager, Tags und Filter', () => {
    const mitTags = () => ({
      ...structuredClone(RAW),
      videoAssets: [
        { ...RAW.videoAssets[0], file_path: '/K/a1.mp4' },
        { id: 'a2', video_id: 'v1', version_number: 1, variant_name: 'B', is_final: false, created_at: '2026-02-02' }
      ],
      tagTypen: [
        { id: 't1', label: 'Persona A', gruppe: 'Persona', kampagne_id: null },
        { id: 't2', label: 'TikTok', gruppe: 'Plattform', kampagne_id: null }
      ],
      varianteTags: [{ video_id: 'v1', variant_key: 'videoA', tag_typ_id: 't1', created_at: '2026-02-03' }]
    });
    const open = async (query, opts = { team: true }) => {
      ctx = setup(opts);
      window.history.replaceState(null, '', `/produktion/p1?tab=videos&k=k1&v=v1&${query}`);
      await mountVideoBrowserPane(ctx.detail, ctx.pane);
    };
    const key = (el, k, extra = {}) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...extra }));
    const panel = (id) => ctx.pane.querySelector(`[data-vb-panel="${id}"]`);
    const chips = () => [...ctx.pane.querySelectorAll('[data-vb-tag-chips] [data-tag-id]')].map(c => c.dataset.tagId);
    const comboInput = () => ctx.pane.querySelector('[data-tag-combo-input]');
    const type = (value) => {
      comboInput().value = value;
      comboInput().dispatchEvent(new Event('input', { bubbles: true }));
    };

    beforeEach(() => {
      loadVideoBrowserData.mockReset();
      loadVideoBrowserData.mockImplementation(async () => mitTags());
      renameAdManagerFile.mockClear();
      insertVarianteTag.mockClear();
      deleteVarianteTag.mockClear();
      createTagTyp.mockClear();
      player.dims = null;
      window.toastSystem = { show: vi.fn() };
    });
    afterEach(() => { delete window.toastSystem; });

    describe('Tabs', () => {
      it('hat ARIA-Verknüpfung, Details sind für das Team der Start, Kunden beginnen bei den Kommentaren', async () => {
        await open('f=s1&i=a1');
        const tab = ctx.pane.querySelector('[data-vb-tab="details"]');
        expect(ctx.pane.querySelector('[role="tablist"]')).not.toBeNull();
        expect(tab.getAttribute('aria-selected')).toBe('true');
        expect(tab.getAttribute('aria-controls')).toBe(panel('details').id);
        expect(panel('details').getAttribute('aria-labelledby')).toBe(tab.id);
        expect(panel('kommentare').hidden).toBe(true);
        expect(ctx.pane.querySelector('[data-vb-tab="kommentare"] .tab-count').textContent).toBe('0');
        unmountVideoBrowser(ctx.detail);

        await open('f=s1&i=a1', { team: false });
        expect(panel('kommentare').hidden).toBe(false);
        expect(ctx.pane.querySelector('[data-vb-tab="admanager"]')).toBeNull();
      });

      it('der Wechsel rendert nichts neu und gilt global für die nächste Datei', async () => {
        await open('f=s1&i=a1');
        const mounts = player.mounts;
        click(ctx.pane.querySelector('[data-vb-tab="admanager"]'));
        expect(panel('admanager').hidden).toBe(false);
        expect(panel('details').hidden).toBe(true);
        expect(player.mounts).toBe(mounts);

        click(ctx.pane.querySelector('.vb-col--3 .vb-row[data-id="a2"]'));
        // a2 hat keine Datei, also keinen Ad Manager: der Tab fällt auf Details zurück
        expect(panel('details').hidden).toBe(false);
        click(ctx.pane.querySelector('[data-vb-tab="kommentare"]'));
        click(ctx.pane.querySelector('.vb-col--3 .vb-row[data-id="a1"]'));
        expect(panel('kommentare').hidden).toBe(false);
      });

      it('Pfeiltasten wandern durch die Tabs, ein Marker-Klick im Player öffnet die Kommentare', async () => {
        await open('f=s1&i=a1');
        const first = ctx.pane.querySelector('[data-vb-tab="details"]');
        key(first, 'ArrowRight');
        expect(ctx.pane.querySelector('[data-vb-tab="admanager"]').getAttribute('aria-selected')).toBe('true');
        expect(document.activeElement.dataset.vbTab).toBe('admanager');

        player.opts.onMarker('c1');
        expect(panel('kommentare').hidden).toBe(false);
      });
    });

    describe('Ad Manager', () => {
      it('Klick auf den Namen öffnet die Bearbeitung, die Vorschau zeigt die Bereinigung, Speichern meldet sie', async () => {
        await open('f=s1&i=a1');
        click(ctx.pane.querySelector('[data-vb-tab="admanager"]'));
        click(ctx.pane.querySelector('[data-vb-adm-edit="a1"]'));
        const input = ctx.pane.querySelector('[data-vb-file-input]');
        input.value = 'Müller Spot';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const preview = ctx.pane.querySelector('[data-vb-adm-preview]');
        expect(preview.hidden).toBe(false);
        expect(preview.textContent).toBe('Wird zu: Mueller_Spot.mp4');

        key(input, 'Enter');
        await vi.waitFor(() => expect(renameAdManagerFile).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), 'Müller Spot'));
        await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Leerzeichen, Umlaute und Sonderzeichen wurden für den Ad Manager ersetzt.', 'info'));
      });

      it('Eigenschaftszeile Dateiname springt in den Ad Manager und startet die Bearbeitung', async () => {
        await open('f=s1&i=a1');
        click(ctx.pane.querySelector('[data-vb-prop-action="filename"]'));
        expect(panel('admanager').hidden).toBe(false);
        expect(ctx.pane.querySelector('[data-vb-file-input]')).not.toBeNull();
      });

      it('Kopieren legt den Dateinamen in die Zwischenablage', async () => {
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        await open('f=s1&i=a1');
        click(ctx.pane.querySelector('[data-vb-adm-copy="a1"]'));
        await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('a1.mp4'));
        expect(window.toastSystem.show).toHaveBeenCalledWith('Dateiname kopiert', 'success');
      });
    });

    describe('Caption', () => {
      const mitCaption = (caption) => {
        const data = mitTags();
        data.videos = data.videos.map(v => (v.id === 'v1' ? { ...v, caption } : v));
        return data;
      };
      const blockEl = () => ctx.pane.querySelector('[data-vb-caption-block]');
      const edit = () => click(ctx.pane.querySelector('[data-vb-caption-view]'));
      const field = () => ctx.pane.querySelector('[data-vb-caption]');
      const blur = (el) => el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      const typeInto = (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };

      it('liest als Text ohne Feld, unter den Eigenschaften und mit Hinweis auf alle Versionen', async () => {
        loadVideoBrowserData.mockImplementation(async () => mitCaption('Anzeige* Naturlocken #haare @mia.roth'));
        await open('f=s1&i=a1');
        expect(field()).toBeNull();
        const details = panel('details');
        expect(details.querySelector('.vb-props [data-vb-caption-block]')).toBeNull();
        expect(blockEl().previousElementSibling.classList.contains('vb-props')).toBe(true);
        expect(blockEl().querySelector('.vb-caption__label').textContent).toBe('Caption');
        expect(blockEl().querySelector('.vb-caption__scope').textContent).toBe('gilt für alle Versionen');
        const text = blockEl().querySelector('[data-vb-caption-text]');
        expect(text.textContent).toBe('Anzeige* Naturlocken #haare @mia.roth');
        expect([...text.querySelectorAll('.vb-caption__tag')].map(t => t.textContent)).toEqual(['#haare', '@mia.roth']);
      });

      it('Video ohne gewählte Datei zeigt den Block auch', async () => {
        loadVideoBrowserData.mockImplementation(async () => mitCaption('Jetzt shoppen'));
        await open('');
        expect(blockEl().querySelector('[data-vb-caption-text]').textContent).toBe('Jetzt shoppen');
        expect(blockEl().querySelector('.vb-caption__scope')).toBeNull();
      });

      it('Klick macht den Text editierbar mit Zähler, Blur speichert und zeigt "Gespeichert"', async () => {
        loadVideoBrowserData.mockImplementation(async () => mitCaption('Jetzt shoppen'));
        await open('f=s1&i=a1');
        edit();
        expect(field().value).toBe('Jetzt shoppen');
        expect(document.activeElement).toBe(field());
        expect(blockEl().querySelector('[data-vb-caption-count]').textContent).toBe('13 / 2.200');

        typeInto(field(), 'Neue Caption');
        expect(blockEl().querySelector('[data-vb-caption-count]').textContent).toBe('12 / 2.200');
        blur(field());
        await vi.waitFor(() => expect(saveVideoCaption).toHaveBeenCalledWith('v1', 'Neue Caption'));
        await vi.waitFor(() => expect(field()).toBeNull());
        expect(blockEl().querySelector('[data-vb-caption-text]').textContent).toBe('Neue Caption');
        expect(blockEl().querySelector('[data-vb-caption-saved]').hidden).toBe(false);
      });

      it('Esc verwirft den Entwurf, unveränderter Text schreibt nichts', async () => {
        loadVideoBrowserData.mockImplementation(async () => mitCaption('Jetzt shoppen'));
        await open('f=s1&i=a1');
        saveVideoCaption.mockClear();

        edit();
        typeInto(field(), 'Verworfen');
        field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(field()).toBeNull();
        expect(blockEl().querySelector('[data-vb-caption-text]').textContent).toBe('Jetzt shoppen');

        edit();
        blur(field());
        expect(field()).toBeNull();
        expect(saveVideoCaption).not.toHaveBeenCalled();
      });

      it('Speicherfehler lässt den Text im Feld stehen und meldet es', async () => {
        loadVideoBrowserData.mockImplementation(async () => mitCaption('Alt'));
        await open('f=s1&i=a1');
        saveVideoCaption.mockRejectedValueOnce(new Error('rls'));
        edit();
        typeInto(field(), 'Neu');
        blur(field());
        await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Caption konnte nicht gespeichert werden.', 'error'));
        expect(field().value).toBe('Neu');
        expect(field().classList.contains('has-error')).toBe(true);
        expect(field().readOnly).toBe(false);
      });

      it('leer zeigt für das Team einen Platzhalter ohne Kopieren, für Kunden fehlt der Block', async () => {
        loadVideoBrowserData.mockImplementation(async () => mitCaption(null));
        await open('f=s1&i=a1');
        expect(blockEl().querySelector('.vb-caption__text--empty').textContent).toBe('Caption hinzufügen…');
        expect(blockEl().querySelector('[data-vb-caption-copy]').hidden).toBe(true);
        edit();
        typeInto(field(), 'Erste Caption');
        expect(blockEl().querySelector('[data-vb-caption-copy]').hidden).toBe(false);
        unmountVideoBrowser(ctx.detail);

        await open('f=s1&i=a1', { team: false });
        expect(blockEl()).toBeNull();
      });

      it('Kunden lesen nur: kein Klick-Bearbeiten, kein Feld', async () => {
        loadVideoBrowserData.mockImplementation(async () => mitCaption('Jetzt shoppen'));
        await open('f=s1&i=a1', { team: false });
        expect(blockEl().querySelector('[data-vb-caption-text]').textContent).toBe('Jetzt shoppen');
        expect(blockEl().querySelector('[data-vb-caption-view]')).toBeNull();
        expect(field()).toBeNull();
      });

      it('Kopieren zeigt Haken und "Kopiert" statt eines Toasts', async () => {
        const writeText = vi.fn(async () => {});
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        loadVideoBrowserData.mockImplementation(async () => mitCaption('Jetzt shoppen'));
        await open('f=s1&i=a1');
        const copy = ctx.pane.querySelector('[data-vb-caption-copy]');
        click(copy);
        await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('Jetzt shoppen'));
        expect(copy.classList.contains('is-copied')).toBe(true);
        expect(copy.querySelector('.vb-caption__copy-label').textContent).toBe('Kopiert');
        expect(window.toastSystem.show).not.toHaveBeenCalled();
      });

      it('lange Captions: "Mehr anzeigen" erscheint nur bei Überlauf und klappt auf', async () => {
        const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
        const client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 200 });
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 100 });
        try {
          loadVideoBrowserData.mockImplementation(async () => mitCaption('Sehr lang\n'.repeat(12)));
          await open('f=s1&i=a1');
          const more = ctx.pane.querySelector('[data-vb-caption-more]');
          expect(more.hidden).toBe(false);
          expect(more.textContent).toBe('Mehr anzeigen');
          expect(blockEl().classList.contains('is-overflow')).toBe(true);

          click(more);
          expect(blockEl().classList.contains('is-open')).toBe(true);
          expect(more.textContent).toBe('Weniger anzeigen');
          expect(more.getAttribute('aria-expanded')).toBe('true');
          click(more);
          expect(blockEl().classList.contains('is-open')).toBe(false);
        } finally {
          if (scroll) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scroll); else delete HTMLElement.prototype.scrollHeight;
          if (client) Object.defineProperty(HTMLElement.prototype, 'clientHeight', client); else delete HTMLElement.prototype.clientHeight;
        }
      });

      it('kurze Caption zeigt kein "Mehr anzeigen"', async () => {
        loadVideoBrowserData.mockImplementation(async () => mitCaption('Kurz'));
        await open('f=s1&i=a1');
        expect(ctx.pane.querySelector('[data-vb-caption-more]').hidden).toBe(true);
      });

      it('Auszeichnung escaped HTML und verwechselt &#39; nicht mit einem Hashtag', async () => {
        const { captionTextHtml, captionCount } = await import('../modules/video-browser/videoBrowserCaption.js');
        expect(captionTextHtml(`Don't <b> #echt (#klammer) a#b`))
          .toBe('Don&#39;t &lt;b&gt; <span class="vb-caption__tag">#echt</span> (<span class="vb-caption__tag">#klammer</span>) a#b');
        expect(captionCount('Äpfel 🍎')).toBe('7 / 2.200');
      });
    });

    describe('Tags', () => {
      it('zeigen sich als Chips mit Hinweis, in der Meta-Zeile der Liste und für Kunden nur lesend', async () => {
        await open('f=s1&i=a1');
        expect(chips()).toEqual(['t1']);
        expect(ctx.pane.querySelector('[data-vb-tag-hint]').textContent).toBe('Gilt für alle Versionen von Video A');
        expect(ctx.pane.querySelector('.vb-col--3 .vb-row[data-id="a1"] .vb-row__meta').textContent).toContain('Persona A');
        unmountVideoBrowser(ctx.detail);

        await open('f=s1&i=a1', { team: false });
        expect(chips()).toEqual(['t1']);
        expect(ctx.pane.querySelector('[data-vb-tag-open]')).toBeNull();
        expect(ctx.pane.querySelector('[data-vb-tag-remove]')).toBeNull();
        // Ohne Tags fehlt die Zeile für Kunden ganz
        click(ctx.pane.querySelector('.vb-col--3 .vb-row[data-id="a2"]'));
        expect(ctx.pane.querySelector('[data-vb-tagfield]')).toBeNull();
      });

      it('Taste T öffnet die Auswahl, Enter vergibt und lässt die Liste offen, Player und Tab bleiben', async () => {
        await open('f=s1&i=a1');
        click(ctx.pane.querySelector('[data-vb-tab="kommentare"]'));
        const mounts = player.mounts;
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }));
        expect(panel('details').hidden).toBe(false);
        expect(comboInput()).not.toBeNull();
        expect(document.activeElement).toBe(comboInput());
        // Schon vergebene Tags stehen nicht mehr zur Wahl
        expect([...ctx.pane.querySelectorAll('[role="option"]')].map(o => o.textContent)).toEqual(['TikTok']);

        type('Tik');
        key(comboInput(), 'Enter');
        await vi.waitFor(() => expect(insertVarianteTag).toHaveBeenCalledWith({ videoId: 'v1', variantKey: 'videoA', tagTypId: 't2' }));
        expect(chips()).toEqual(['t1', 't2']);
        expect(comboInput()).not.toBeNull();
        expect(comboInput().value).toBe('');
        expect(ctx.pane.querySelector('.vb-col--3 .vb-row[data-id="a1"] .vb-row__meta').textContent).toContain('Persona A, TikTok');
        expect(player.mounts).toBe(mounts);
      });

      it('Neu anlegen erzeugt ein Tag der Gruppe Eigene für die Kampagne und vergibt es', async () => {
        await open('f=s1&i=a1');
        click(ctx.pane.querySelector('[data-vb-tag-open]'));
        type('Neu Test');
        expect(ctx.pane.querySelector('.tag-combo__option--create').textContent).toContain('Neu Test');
        key(comboInput(), ',');
        await vi.waitFor(() => expect(createTagTyp).toHaveBeenCalledWith({ label: 'Neu Test', gruppe: 'Eigene', kampagneId: 'kamp' }));
        await vi.waitFor(() => expect(insertVarianteTag).toHaveBeenCalledWith(expect.objectContaining({ tagTypId: 't-Neu Test' })));
        expect(chips()).toEqual(['t1', 't-Neu Test']);
      });

      it('Backspace im leeren Feld entfernt das letzte Tag, Esc schließt und gibt den Fokus zurück', async () => {
        await open('f=s1&i=a1');
        click(ctx.pane.querySelector('[data-vb-tag-open]'));
        key(comboInput(), 'Backspace');
        await vi.waitFor(() => expect(deleteVarianteTag).toHaveBeenCalledWith({ videoId: 'v1', variantKey: 'videoA', tagTypId: 't1' }));
        expect(chips()).toEqual([]);

        key(comboInput(), 'Escape');
        expect(comboInput()).toBeNull();
        expect(document.activeElement).toBe(ctx.pane.querySelector('[data-vb-tag-open]'));
      });

      it('Kreuz am Chip entfernt, ein Fehler rollt zurück und meldet es', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await open('f=s1&i=a1');
        deleteVarianteTag.mockRejectedValueOnce(new Error('kaputt'));
        click(ctx.pane.querySelector('[data-vb-tag-remove="t1"]'));
        await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalledWith('Tag konnte nicht entfernt werden.', 'error'));
        expect(chips()).toEqual(['t1']);
        spy.mockRestore();
      });
    });

    describe('Filter', () => {
      const rows = () => [...ctx.pane.querySelectorAll('.vb-col--3 .vb-row[data-id]')].map(r => r.dataset.id);

      it('Chips je Ordner, Toggle filtert die Liste, "Final" erscheint erst mit einer Markierung', async () => {
        await open('f=s1');
        const chip = () => ctx.pane.querySelector('[data-vb-filter="t1"]');
        expect([...ctx.pane.querySelectorAll('[data-vb-filter]')].map(c => c.dataset.vbFilter)).toEqual(['t1']);
        expect(rows()).toEqual(['a1', 'a2']);

        click(chip());
        expect(rows()).toEqual(['a1']);
        expect(chip().getAttribute('aria-pressed')).toBe('true');

        click(chip());
        expect(rows()).toEqual(['a1', 'a2']);
        expect(chip().getAttribute('aria-pressed')).toBe('false');
      });

      it('Filter "Final" zeigt nur markierte Dateien', async () => {
        loadVideoBrowserData.mockImplementation(async () => ({
          ...mitTags(),
          videoAssets: [...mitTags().videoAssets, { id: 'f1', video_id: 'v1', version_number: 1, variant_name: '9:16', is_final: true, source_asset_id: 'a2', created_at: '2026-03-01' }]
        }));
        await open('f=s1');
        click(ctx.pane.querySelector('[data-vb-filter="final"]'));
        expect(rows()).toEqual(['a2']);
      });
    });
  });
});

describe('VideoBrowser Spalte 0: Gruppenköpfe bei Alle Linien', () => {
  let ctx;
  const LINIEN = [{ id: 'b1', name: 'Nano-Influencer' }, { id: 'b2', name: 'UGC-Creator' }];
  const MEHRFACH = () => ({
    ...structuredClone(RAW),
    linien: LINIEN,
    kooperationen: [
      { id: 'k1', name: 'Koop A', briefing_id: 'b2', created_at: '2026-01-02', creator: { id: 'c1', vorname: 'Mia', nachname: 'Roth' } },
      { id: 'k3', name: 'Koop C', briefing_id: 'b1', created_at: '2026-01-01', creator: { id: 'c1', vorname: 'Mia', nachname: 'Roth' } },
      { id: 'k2', name: 'Koop B', briefing_id: 'b1', created_at: '2026-01-03', creator: { id: 'c2', vorname: 'Jan', nachname: 'Voss' } }
    ]
  });
  const head = () => ctx.pane.querySelector('[data-vb-koopgroup="creator:c1"]');
  const body = () => ctx.pane.querySelector('[data-vb-koopgroup-wrap="creator:c1"] [data-vb-koopgroup-body]');
  const stored = () => JSON.parse(window.localStorage.getItem('crm.videoKoop.p1') || 'null');

  async function open({ team = true, search = '', alle = true } = {}) {
    ctx = setup({ team });
    ctx.detail.linien = LINIEN;
    ctx.detail.linieAlle = alle;
    ctx.detail.linieId = 'b1';
    window.history.replaceState(null, '', `/produktion/p1?tab=videos${search}`);
    await mountVideoBrowserPane(ctx.detail, ctx.pane);
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    // Node stellt ohne --localstorage-file kein funktionierendes localStorage bereit
    const store = new Map();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: k => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: k => store.delete(k),
        clear: () => store.clear()
      }
    });
    loadVideoBrowserData.mockReset();
    loadVideoBrowserData.mockImplementation(async () => MEHRFACH());
  });
  afterEach(() => {
    if (ctx) unmountVideoBrowser(ctx.detail);
    loadVideoBrowserData.mockReset();
    loadVideoBrowserData.mockImplementation(async () => structuredClone(RAW));
  });

  it('Creator mit zwei Kooperationen bekommt einen Kopf, die Zeilen nennen die Linie', async () => {
    await open();
    expect(head()).not.toBeNull();
    expect(head().getAttribute('aria-expanded')).toBe('true');
    expect(head().textContent).toContain('2 Kooperationen');
    const nested = [...body().querySelectorAll('.vb-row')];
    expect(nested.map(r => r.dataset.id)).toEqual(['k3', 'k1']);
    expect(nested.map(r => r.querySelector('.vb-row__name').textContent)).toEqual(['Nano-Influencer', 'UGC-Creator']);
    // Jan hat nur eine Kooperation: Einzelzeile ohne Kopf, Linie in der Meta-Zeile
    const jan = ctx.pane.querySelector('.vb-col--0 .vb-row[data-id="k2"]');
    expect(jan.closest('[data-vb-koopgroup-body]')).toBeNull();
    expect(jan.querySelector('.vb-row__meta').textContent).toContain('Nano-Influencer');
    expect(ctx.pane.querySelector('.vb-col--0 .vb-col__sub').textContent).toContain('2 Creator · 3 Kooperationen');
  });

  it('Kopf klappt zu und auf, ändert die Auswahl nicht und merkt sich den Zustand', async () => {
    await open({ search: '&k=k2' });
    click(head());
    expect(head().getAttribute('aria-expanded')).toBe('false');
    expect(body().hidden).toBe(true);
    expect(window.location.search).toContain('k=k2');
    expect(cols(ctx.pane)).toHaveLength(2);
    expect(stored().zu).toEqual(['creator:c1']);

    click(head());
    expect(body().hidden).toBe(false);
    expect(stored().zu).toEqual([]);
  });

  it('Deep Link in eine eingeklappte Gruppe klappt sie auf', async () => {
    window.localStorage.setItem('crm.videoKoop.p1', JSON.stringify({ gruppe: 'creator', zu: ['creator:c1'] }));
    await open({ search: '&k=k1' });
    expect(head().getAttribute('aria-expanded')).toBe('true');
    expect(body().hidden).toBe(false);
    expect(ctx.pane.querySelector('.vb-col--0 .vb-row[data-id="k1"]').classList.contains('is-selected')).toBe(true);
  });

  it('Alle einklappen und aufklappen', async () => {
    await open();
    click(ctx.pane.querySelector('[data-vb-koopgroup-all="close"]'));
    expect(body().hidden).toBe(true);
    const btn = ctx.pane.querySelector('[data-vb-koopgroup-all]');
    expect(btn.dataset.vbKoopgroupAll).toBe('open');
    expect(btn.getAttribute('aria-label')).toBe('Alle aufklappen');
    click(btn);
    expect(body().hidden).toBe(false);
  });

  it('Umschalter Linie: Köpfe je Linie, Auswahl bleibt, Wert in URL und Merker', async () => {
    await open({ search: '&k=k1' });
    expect(window.location.search).toContain('koopgruppe=creator');
    click(ctx.pane.querySelector('[data-vb-seg="koopgruppe"] [data-value="linie"]'));
    expect(window.location.search).toContain('koopgruppe=linie');
    expect(window.location.search).toContain('k=k1');
    expect(stored().gruppe).toBe('linie');
    const nano = ctx.pane.querySelector('[data-vb-koopgroup="linie:b1"]');
    expect(nano.textContent).toContain('Nano-Influencer');
    expect([...ctx.pane.querySelectorAll('[data-vb-koopgroup-wrap="linie:b1"] .vb-row[data-id]')].map(r => r.querySelector('.vb-row__name').textContent))
      .toEqual(['Jan Voss', 'Mia Roth']);
    // Nur eine Kooperation in UGC-Creator: Einzelzeile
    expect(ctx.pane.querySelector('[data-vb-koopgroup="linie:b2"]')).toBeNull();
    expect(ctx.pane.querySelector('.vb-col--0 .vb-row[data-id="k1"]').classList.contains('is-selected')).toBe(true);
  });

  it('URL schlägt den Merker, der Showcase-Wechsel lässt koopgruppe stehen', async () => {
    window.localStorage.setItem('crm.videoKoop.p1', JSON.stringify({ gruppe: 'creator', zu: [] }));
    await open({ search: '&koopgruppe=linie' });
    expect(ctx.pane.querySelector('[data-vb-koopgroup="linie:b1"]')).not.toBeNull();
    click(ctx.pane.querySelector('[data-vb-seg="view"] [data-value="showcase"]'));
    expect(window.location.search).toContain('ansicht=showcase');
    expect(window.location.search).toContain('koopgruppe=linie');
    click(ctx.pane.querySelector('[data-vb-seg="view"] [data-value="ordner"]'));
    expect(window.location.search).toContain('koopgruppe=linie');
  });

  it('Kunde: Gruppenköpfe nach Creator, aber kein Umschalter; koopgruppe aus der URL zählt nicht', async () => {
    await open({ team: false, search: '&koopgruppe=linie' });
    expect(head()).not.toBeNull();
    expect(ctx.pane.querySelector('[data-vb-seg="koopgruppe"]')).toBeNull();
    expect(ctx.pane.querySelector('[data-vb-koopgroup-all]')).not.toBeNull();
    expect(window.location.search).not.toContain('koopgruppe');
  });

  it('rechts: Linie in Untertitel, Pfad und Detail, Weitere Kooperationen wechselt die Linie', async () => {
    await open({ search: '&k=k1' });
    expect(ctx.pane.querySelector('.vb-col--1 .vb-col__sub').textContent).toContain('UGC-Creator');
    expect(ctx.pane.querySelector('.vb-path__current').textContent).toBe('Mia Roth · UGC-Creator');
    expect(ctx.pane.querySelector('.vb-person .vb-detail__sub').textContent).toContain('UGC-Creator');
    const weitere = ctx.pane.querySelector('[data-vb-detail-inner] [aria-label="Weitere Kooperationen"]');
    expect(weitere.closest('section').textContent).toContain('Weitere Kooperationen von Mia');
    const ziel = weitere.querySelector('[data-goto-koop="k3"]');
    expect(ziel.textContent).toContain('Nano-Influencer');

    click(head());
    expect(body().hidden).toBe(true);
    click(ctx.pane.querySelector('[data-vb-detail-inner] [data-goto-koop="k3"]'));
    expect(window.location.search).toContain('k=k3');
    expect(body().hidden).toBe(false);
    expect(ctx.pane.querySelector('.vb-col--0 .vb-row[data-id="k3"]').classList.contains('is-selected')).toBe(true);
  });

  it('Tastatur: Köpfe liegen in der Pfeilreihenfolge, links zu, rechts auf und hinein, links zurück auf den Kopf', async () => {
    await open();
    const press = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    const row = id => ctx.pane.querySelector(`.vb-col--0 .vb-row[data-id="${id}"]`);
    const focused = () => document.activeElement;

    head().focus();
    press(head(), 'ArrowLeft');
    expect(head().getAttribute('aria-expanded')).toBe('false');
    press(head(), 'ArrowDown');
    expect(focused()).toBe(head());
    press(head(), 'ArrowUp');
    expect(focused()).toBe(row('k2'));
    press(row('k2'), 'ArrowDown');
    expect(focused()).toBe(head());

    press(head(), 'ArrowRight');
    expect(head().getAttribute('aria-expanded')).toBe('true');
    expect(focused()).toBe(head());
    press(head(), 'ArrowRight');
    expect(focused()).toBe(row('k3'));
    press(row('k3'), 'ArrowDown');
    expect(focused()).toBe(row('k1'));
    press(row('k1'), 'ArrowLeft');
    expect(focused()).toBe(head());
    expect(window.location.search).not.toContain('k=');
  });

  it('Fokus auf einem Kopf bleibt nach dem Neuaufbau der Spalten', async () => {
    await open({ search: '&k=k2' });
    head().focus();
    ctx.detail._videoBrowser._render({ restoreFocus: false });
    expect(document.activeElement).toBe(head());
  });

  it('Kunde sieht die Linie rechts, aber keine weiteren Kooperationen', async () => {
    await open({ team: false, search: '&k=k1' });
    expect(ctx.pane.querySelector('.vb-path__current').textContent).toBe('Mia Roth · UGC-Creator');
    expect(ctx.pane.querySelector('[aria-label="Weitere Kooperationen"]')).toBeNull();
  });

  it('eine einzelne Linie: die Creator-Gruppierung gilt trotzdem, aber ohne Umschalter Creator | Linie', async () => {
    await open({ alle: false });
    expect(head()).not.toBeNull();
    expect(ctx.pane.querySelector('[data-vb-seg="koopgruppe"]')).toBeNull();
    expect(ctx.pane.querySelector('[data-vb-koopgroup-all]')).not.toBeNull();
    expect(ctx.pane.querySelectorAll('.vb-col--0 .vb-row[data-id]')).toHaveLength(3);
    const titel = [...ctx.pane.querySelectorAll('.vb-col--0 .vb-row:not(.vb-row--nested) .vb-row__name')].map(n => n.textContent);
    expect(new Set(titel).size).toBe(titel.length);
    expect(window.location.search).not.toContain('koopgruppe');
  });
});
