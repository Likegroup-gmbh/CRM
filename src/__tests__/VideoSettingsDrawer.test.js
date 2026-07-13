import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoSettingsDrawer } from '../modules/kampagne/VideoSettingsDrawer.js';

function makeSelectChain(data) {
  const result = Promise.resolve({ data, error: null });
  const chain = {
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    then: result.then.bind(result),
  };
  return chain;
}

function createSettingsSupabase({
  videoAssets = [],
  storyAssets = [],
  bilderAssets = [],
} = {}) {
  return {
    from: vi.fn((table) => ({
      select: vi.fn(() => {
        if (table === 'kooperation_video_asset') return makeSelectChain(videoAssets);
        if (table === 'kooperation_story_asset') return makeSelectChain(storyAssets);
        if (table === 'kooperation_bilder_asset') return makeSelectChain(bilderAssets);
        return makeSelectChain([]);
      }),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  };
}

describe('VideoSettingsDrawer', () => {
  let drawer;

  beforeEach(() => {
    document.body.innerHTML = '';
    drawer = new VideoSettingsDrawer();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    drawer.removeDrawer();
    vi.unstubAllGlobals();
  });

  it('zeigt externen Video-Link mit Label und URL-Zeile', async () => {
    window.supabase = createSettingsSupabase({
      videoAssets: [{
        id: 'va-1',
        file_url: 'https://drive.google.com/file/abc',
        file_path: null,
        version_number: 1,
        is_current: true,
        variant_name: 'Haupt',
        created_at: '2026-01-15T10:00:00Z',
      }],
    });

    await drawer.open({
      videoId: 'vid-1',
      kooperationId: 'koop-1',
      videoUrl: '',
      videoTitel: 'Testvideo',
    });

    const body = document.getElementById('video-settings-drawer-body');
    expect(body.textContent).toContain('Haupt');
    expect(body.textContent).not.toContain('?');
    expect(body.textContent).toContain('Externer Link');
    const link = body.querySelector('.video-settings-file-link');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://drive.google.com/file/abc');
  });

  it('zeigt Bild-Thumbnail und URL für direkte Bild-Links', async () => {
    window.supabase = createSettingsSupabase({
      bilderAssets: [{
        id: 'ba-1',
        file_url: 'https://cdn.example.com/photo.png',
        file_path: null,
        file_name: 'photo.png',
        file_size: 0,
        created_at: '2026-02-01T10:00:00Z',
      }],
    });

    await drawer.open({
      videoId: 'vid-1',
      kooperationId: 'koop-1',
      videoTitel: 'Testvideo',
    });

    drawer._switchTab('bilder');
    const body = document.getElementById('video-settings-drawer-body');
    const thumb = body.querySelector('img.settings-asset-thumb');
    expect(thumb).toBeTruthy();
    expect(thumb.getAttribute('src')).toBe('https://cdn.example.com/photo.png');
    expect(body.textContent).toContain('https://cdn.example.com/photo.png');
  });

  it('gruppiert Story-Assets nach Slot in einer Feedbackschleife', async () => {
    window.supabase = createSettingsSupabase({
      storyAssets: [
        {
          id: 'sa-1',
          story_id: 'slot-1',
          file_url: 'https://example.com/s1.mp4',
          file_path: null,
          file_name: 's1.mp4',
          file_size: 0,
          version_number: 1,
          is_current: true,
          variant_name: null,
          created_at: '2026-01-01T10:00:00Z',
          kooperation_story: { slot_index: 1, slot_name: 'Intro' },
        },
        {
          id: 'sa-2',
          story_id: 'slot-2',
          file_url: 'https://example.com/s2.mp4',
          file_path: null,
          file_name: 's2.mp4',
          file_size: 0,
          version_number: 1,
          is_current: true,
          variant_name: null,
          created_at: '2026-01-02T10:00:00Z',
          kooperation_story: { slot_index: 2, slot_name: 'CTA' },
        },
      ],
    });

    await drawer.open({
      videoId: 'vid-1',
      kooperationId: 'koop-1',
      videoTitel: 'Testvideo',
    });

    drawer._switchTab('storys');
    const body = document.getElementById('video-settings-drawer-body');
    expect(body.textContent).toContain('Story 1 · Intro');
    expect(body.textContent).toContain('Story 2 · CTA');
  });

  it('gruppiert Bilder nach Video und listet Altbilder unter "Nicht zugeordnet"', async () => {
    window.supabase = createSettingsSupabase({
      bilderAssets: [
        {
          id: 'ba-1',
          video_id: 'vid-2',
          file_url: 'https://cdn.example.com/v2.png',
          file_path: null,
          file_name: 'v2.png',
          file_size: 0,
          created_at: '2026-02-01T10:00:00Z',
        },
        {
          id: 'ba-2',
          video_id: null,
          file_url: 'https://cdn.example.com/alt.png',
          file_path: null,
          file_name: 'alt.png',
          file_size: 0,
          created_at: '2026-01-01T10:00:00Z',
        },
      ],
    });

    await drawer.open({
      videoId: 'vid-1',
      kooperationId: 'koop-1',
      videoTitel: 'Testvideo',
      videos: [
        { id: 'vid-1', position: 1, thema: 'Schnitzel' },
        { id: 'vid-2', position: 2, thema: 'Bratwurst' },
      ],
    });

    drawer._switchTab('bilder');
    const body = document.getElementById('video-settings-drawer-body');
    const groupRows = [...body.querySelectorAll('.settings-bilder-group-row')].map(r => r.textContent.trim());
    expect(groupRows).toEqual(['Video 2 – Bratwurst', 'Nicht zugeordnet']);
    expect(body.textContent).toContain('v2.png');
    expect(body.textContent).toContain('alt.png');
    // Video 1 hat keine Bilder -> keine leere Gruppe
    expect(body.textContent).not.toContain('Video 1 – Schnitzel');
  });

  it('zeigt Legacy-Video-Link wenn keine Assets aber videoUrl gesetzt', async () => {
    window.supabase = createSettingsSupabase({ videoAssets: [] });

    await drawer.open({
      videoId: 'vid-1',
      kooperationId: 'koop-1',
      videoUrl: 'https://legacy.example.com/old-video',
      videoTitel: 'Testvideo',
    });

    const body = document.getElementById('video-settings-drawer-body');
    expect(body.textContent).toContain('Legacy-Link');
    const link = body.querySelector('.video-settings-file-link');
    expect(link.getAttribute('href')).toBe('https://legacy.example.com/old-video');
  });
});
