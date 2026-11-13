import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RAW = {
  kooperationen: [{ id: 'k1', name: 'Koop A', briefing_id: null, creator: { vorname: 'Mia', nachname: 'Roth' } }],
  linien: [],
  videos: [{ id: 'v1', kooperation_id: 'k1', position: 1, titel: 'Hook', created_at: '2026-01-01' }],
  stories: [],
  videoAssets: [
    { id: 'a1', video_id: 'v1', version_number: 1, titel: 'Hauptschnitt', breite: 1080, hoehe: 1920, is_final: false, created_at: '2026-02-01' },
    { id: 'a2', video_id: 'v1', version_number: 1, titel: 'Ohne Format', is_final: false, created_at: '2026-02-01' }
  ],
  storyAssets: [],
  stillAssets: [
    { id: 'b1', video_id: 'v1', kooperation_id: 'k1', version_number: 1, file_name: 'b.jpg', is_final: false, created_at: '2026-02-01' }
  ],
  rohmaterial: [],
  slotNotes: [],
  zeitkommentare: []
};

const SAVED = {
  freigabe_vorher: false,
  video: [{ id: 'fa1', video_id: 'v1', version_number: 1, variant_name: '9:16', is_final: true, source_asset_id: 'a1', created_at: '2026-03-05T10:00:00Z' }],
  story: [],
  still: [{ id: 'fb1', video_id: 'v1', kooperation_id: 'k1', version_number: 1, variant_name: 'Still', file_name: 'b.jpg', is_final: true, source_asset_id: 'b1', created_at: '2026-03-05T10:00:00Z' }]
};

vi.mock('../modules/video-browser/VideoBrowserAdapter.js', () => ({
  loadVideoBrowserData: vi.fn(async () => structuredClone(RAW)),
  saveZeitkommentar: vi.fn(),
  saveWiedergabeMessung: vi.fn(),
  loadUploadContext: vi.fn(),
  saveVideoCaption: vi.fn(async () => null),
  freigebenVideoKunde: vi.fn(),
  zuruecknehmenVideoKunde: vi.fn(async () => {}),
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

vi.mock('../modules/video-browser/VideoBrowserPlayer.js', () => ({
  mountPlayer: (host) => {
    host.innerHTML = '<div data-vb-frame></div>';
    return {
      seek: vi.fn(), getTime: () => 0, setMarkers: vi.fn(), markerEl: () => null, destroy: vi.fn(),
      getDimensions: () => null, whenReady: () => Promise.resolve()
    };
  }
}));

vi.mock('../modules/video-browser/videoBrowserRatio.js', () => ({
  ratioOfItem: vi.fn(async () => null),
  ratioOfFile: vi.fn(async () => null)
}));

vi.mock('../core/ConfirmationModal.js', () => ({
  confirmationModal: { open: vi.fn(async () => ({ confirmed: true })) }
}));

const { mountVideoBrowserPane, unmountVideoBrowser } = await import('../modules/video-browser/VideoBrowser.js');
const { loadVideoBrowserData, freigebenVideoKunde, zuruecknehmenVideoKunde } = await import('../modules/video-browser/VideoBrowserAdapter.js');
const { confirmationModal } = await import('../core/ConfirmationModal.js');
const { buildTree } = await import('../modules/video-browser/videoBrowserLogic.js');
const { commentsPanelHtml } = await import('../modules/video-browser/videoBrowserRenderComments.js');
const { freigabeDateien, freigabeNutzlast, kannFreigeben, aktuelleSchleife } = await import('../modules/video-browser/videoBrowserFreigabe.js');

const FINAL_A1 = SAVED.video[0];
const mitFinal = () => ({ ...structuredClone(RAW), videoAssets: [...structuredClone(RAW.videoAssets), { ...FINAL_A1 }] });
const rowOf = (data, team = false) => buildTree(data, { team }).kooperationen[0].rows[0];
const KUNDE = { team: false, canComment: true };

describe('Video-Freigabe: Logik', () => {
  it('nur die Kundenseite mit Feedback-Recht, nur mit Dateien in der aktuellen Schleife', () => {
    const row = rowOf(structuredClone(RAW));
    expect(kannFreigeben(KUNDE, row)).toBe(true);
    expect(kannFreigeben({ team: true, canComment: true }, rowOf(structuredClone(RAW), true))).toBe(false);
    expect(kannFreigeben({ team: false, canComment: false }, row)).toBe(false);
    expect(kannFreigeben(KUNDE, rowOf(mitFinal()))).toBe(false);
  });

  it('nach der Freigabe lädt das Team eine neue Schleife hoch: erneut freigebbar', () => {
    const data = mitFinal();
    data.videoAssets.push({ id: 'a3', video_id: 'v1', version_number: 2, breite: 1080, hoehe: 1920, is_final: false, created_at: '2026-03-10' });
    const row = rowOf(data);
    expect(aktuelleSchleife(row).id).toBe('s2');
    expect(kannFreigeben(KUNDE, row)).toBe(true);
    expect(freigabeDateien(aktuelleSchleife(row)).map(i => i.id)).toEqual(['a3']);
  });

  it('Nutzlast: Format je Video, Bilder ohne Format, Dateien ohne Format bleiben', async () => {
    const dateien = freigabeDateien(aktuelleSchleife(rowOf(structuredClone(RAW))));
    expect(dateien.map(i => i.id)).toEqual(['a1', 'a2', 'b1']);
    const ratioFn = vi.fn(async (item) => (item.id === 'a1' ? '9:16' : null));
    const { finals, uebersprungen } = await freigabeNutzlast(dateien, ratioFn);
    expect(finals).toEqual([
      { kind: 'video', source_id: 'a1', slot: '9:16' },
      { kind: 'still', source_id: 'b1', slot: null }
    ]);
    expect(uebersprungen.map(i => i.id)).toEqual(['a2']);
    expect(ratioFn).toHaveBeenCalledTimes(2);
  });

  it('ein Formatfehler zählt als "ohne Format", nicht als Abbruch', async () => {
    const dateien = freigabeDateien(aktuelleSchleife(rowOf(structuredClone(RAW))));
    const { finals, uebersprungen } = await freigabeNutzlast(dateien, async () => { throw new Error('probe'); });
    expect(finals.map(f => f.source_id)).toEqual(['b1']);
    expect(uebersprungen.map(i => i.id)).toEqual(['a1', 'a2']);
  });

  it('Bilder ohne Video und Zeilen ohne id sind nicht freigebbar', () => {
    const folder = { items: [
      { type: 'still', asset: { id: 'x1', video_id: null } },
      { type: 'video', asset: {} },
      { type: 'roh', asset: { id: 'r1' } },
      { type: 'story', asset: { id: 'sa1' } }
    ] };
    expect(freigabeDateien(folder).map(i => i.asset.id)).toEqual(['sa1']);
  });

  it('nach einer Finalen Version bleibt die letzte Schleife kommentierbar', () => {
    const row = rowOf(mitFinal());
    const folder = row.folders.find(f => f.id === 's1');
    const item = folder.items.find(i => i.id === 'a1');
    const html = commentsPanelHtml({ resolved: { row, folder, item }, canComment: true, drafts: {} });
    expect(html).toContain('data-vb-comment-form');
  });
});

describe('Video-Freigabe: Ablauf im Videos-Tab', () => {
  let detail;
  const pane = () => document.querySelector('[data-test-pane]');
  const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const bar = () => pane().querySelector('.vb-finalbar--freigabe');
  const vermerk = () => pane().querySelector('.vb-finalbar--freigegeben');
  const shown = () => window.toastSystem.show.mock.calls;

  const open = async (query, { team = false, comment = true } = {}) => {
    window.canFeature = (name) => ({
      videoTeamSicht: team, mediaUpload: team, skriptKommentieren: comment, mediaDownload: false
    }[name] ?? false);
    window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} });
    window.history.replaceState(null, '', `/produktion/p1?tab=videos&k=k1&v=v1${query}`);
    document.body.innerHTML = '';
    const el = document.createElement('div');
    el.dataset.testPane = '';
    document.body.appendChild(el);
    detail = { kampagneId: 'kamp', produktionId: 'p1', linien: [], linieAlle: false, linieId: null, produktion: { name: 'Prod' } };
    await mountVideoBrowserPane(detail, el);
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    window.toastSystem = { show: vi.fn() };
    loadVideoBrowserData.mockReset();
    loadVideoBrowserData.mockImplementation(async () => structuredClone(RAW));
    freigebenVideoKunde.mockReset();
    freigebenVideoKunde.mockImplementation(async () => structuredClone(SAVED));
    zuruecknehmenVideoKunde.mockReset();
    zuruecknehmenVideoKunde.mockImplementation(async () => {});
    confirmationModal.open.mockReset();
    confirmationModal.open.mockImplementation(async () => ({ confirmed: true }));
  });
  afterEach(() => {
    if (detail) unmountVideoBrowser(detail);
    delete window.toastSystem;
  });

  it('Kunde sieht "Video freigeben" unter dem Player, im Video- und im Ordner-Detail', async () => {
    await open('&f=s1&i=a1');
    expect(bar().textContent).toContain('Video freigeben');
    expect(bar().textContent).toContain('Gibt 3 Dateien aus Feedbackschleife 1 frei');
    unmountVideoBrowser(detail);

    await open('');
    const next = pane().querySelector('.vb-next');
    expect(next.textContent).toContain('Passt alles, gib das Video frei.');
    expect(next.querySelector('[data-vb-kunde-freigeben="v1"]')).not.toBeNull();
    unmountVideoBrowser(detail);

    await open('&f=s1');
    expect(pane().querySelector('[data-slot="folder-detail-actions"] [data-vb-kunde-freigeben="v1"]')).not.toBeNull();
  });

  it('Team und Kunden ohne Feedback-Recht sehen den Button nicht', async () => {
    await open('&f=s1&i=a1', { team: true });
    expect(pane().querySelector('[data-vb-kunde-freigeben]')).toBeNull();
    expect(pane().querySelector('[data-vb-final-toggle]')).not.toBeNull();
    unmountVideoBrowser(detail);

    await open('&f=s1&i=a1', { comment: false });
    expect(pane().querySelector('[data-vb-kunde-freigeben]')).toBeNull();
  });

  it('ein Klick: bestätigen, sofort freigegeben, Server bekommt Quellen und Formate', async () => {
    let fertig;
    freigebenVideoKunde.mockImplementation(() => new Promise((resolve) => { fertig = () => resolve(structuredClone(SAVED)); }));
    await open('&f=s1&i=a1');
    click(bar());

    await vi.waitFor(() => expect(freigebenVideoKunde).toHaveBeenCalled());
    const { message } = confirmationModal.open.mock.calls[0][0];
    expect(message).toContain('„Ohne Format“');
    expect(freigebenVideoKunde).toHaveBeenCalledWith('v1', [
      { kind: 'video', source_id: 'a1', slot: '9:16' },
      { kind: 'still', source_id: 'b1', slot: null }
    ]);
    // optimistisch: schon vor der Antwort freigegeben
    expect(bar()).toBeNull();
    expect(vermerk()).not.toBeNull();

    fertig();
    await vi.waitFor(() => expect(shown().some(([text]) => text === 'Video freigegeben.')).toBe(true));
    expect(vermerk().textContent).toMatch(/Freigegeben am/);
    const finalIds = [...pane().querySelectorAll('.vb-col--2 .vb-row')].map(r => r.dataset.id);
    expect(finalIds).toContain('final');
  });

  it('Abbrechen im Dialog speichert nichts', async () => {
    confirmationModal.open.mockImplementation(async () => ({ confirmed: false }));
    await open('&f=s1&i=a1');
    click(bar());
    await vi.waitFor(() => expect(confirmationModal.open).toHaveBeenCalled());
    await Promise.resolve();
    expect(freigebenVideoKunde).not.toHaveBeenCalled();
    expect(bar()).not.toBeNull();
  });

  it('Fehler beim Speichern: zurück zum Button, Fehler-Toast', async () => {
    freigebenVideoKunde.mockImplementation(async () => { throw new Error('rls'); });
    await open('&f=s1&i=a1');
    click(bar());
    await vi.waitFor(() => expect(shown().some(([, type]) => type === 'error')).toBe(true));
    expect(bar()).not.toBeNull();
    expect(vermerk()).toBeNull();
  });

  it('schon freigegeben (anderer Tab): Hinweis und neu laden', async () => {
    freigebenVideoKunde.mockImplementation(async () => { throw Object.assign(new Error('x'), { hint: 'bereits_freigegeben' }); });
    await open('&f=s1&i=a1');
    const geladen = loadVideoBrowserData.mock.calls.length;
    click(bar());
    await vi.waitFor(() => expect(shown().some(([, type]) => type === 'info')).toBe(true));
    await vi.waitFor(() => expect(loadVideoBrowserData.mock.calls.length).toBeGreaterThan(geladen));
  });

  it('Rückgängig nimmt die Finals und das Flag zurück', async () => {
    await open('&f=s1&i=a1');
    click(bar());
    await vi.waitFor(() => expect(shown().some(([text]) => text === 'Video freigegeben.')).toBe(true));
    const [, , , options] = shown().find(([text]) => text === 'Video freigegeben.');
    expect(options.action.label).toBe('Rückgängig');

    options.action.onClick();
    expect(bar()).not.toBeNull();
    await vi.waitFor(() => expect(zuruecknehmenVideoKunde).toHaveBeenCalledWith('v1', ['fa1', 'fb1'], false));
    await vi.waitFor(() => expect(shown().some(([text]) => text === 'Rückgängig gemacht.')).toBe(true));
  });

  it('Rückgängig scheitert: die Freigabe bleibt stehen', async () => {
    zuruecknehmenVideoKunde.mockImplementation(async () => { throw new Error('zu spät'); });
    await open('&f=s1&i=a1');
    click(bar());
    await vi.waitFor(() => expect(shown().some(([text]) => text === 'Video freigegeben.')).toBe(true));
    shown().find(([text]) => text === 'Video freigegeben.')[3].action.onClick();
    await vi.waitFor(() => expect(shown().some(([, type]) => type === 'error')).toBe(true));
    expect(vermerk()).not.toBeNull();
    expect(bar()).toBeNull();
  });
});
