import { describe, it, expect, beforeEach } from 'vitest';
import { VideoRohmaterialRenderer } from '../modules/video/VideoRohmaterialRenderer.js';

// ────────────────────────────────────────────────────────────
// Rendering
// ────────────────────────────────────────────────────────────

describe('VideoRohmaterialRenderer', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="rohmaterial-groups"></div>';
  });

  const group = (over = {}) => ({
    id: 'koop-1',
    name: 'Koop A',
    creatorName: 'Max Muster',
    folderUrl: 'https://t.sharepoint.com/sites/M/Rohmaterial',
    files: [],
    ...over,
  });

  it('zeigt auch Kooperationen ohne Abgabe, damit fehlendes Material auffaellt', () => {
    VideoRohmaterialRenderer.updateGroups([group()]);
    const host = document.getElementById('rohmaterial-groups');
    expect(host.textContent).toContain('Max Muster');
    expect(host.textContent).toContain('Noch kein Rohmaterial hochgeladen');
  });

  it('rendert Datei-Zeilen mit Download- und Loeschen-Aktion', () => {
    VideoRohmaterialRenderer.updateGroups([group({
      files: [{
        id: 'a1',
        file_name: 'clip.mov',
        file_size: 2 * 1024 * 1024,
        file_url: 'https://t.sharepoint.com/sites/M/Rohmaterial/clip.mov',
        created_at: '2026-08-30T10:00:00Z',
      }],
    })]);

    const host = document.getElementById('rohmaterial-groups');
    expect(host.querySelector('tr[data-asset-id="a1"]')).toBeTruthy();
    expect(host.textContent).toContain('clip.mov');
    expect(host.textContent).toContain('2 MB');
    expect(host.querySelector('.rohmaterial-delete-btn')?.dataset.assetId).toBe('a1');
    expect(host.querySelector('.rohmaterial-upload-btn')?.dataset.koopId).toBe('koop-1');
    expect(host.querySelector('a.external-link-btn')?.getAttribute('href')).toBe('https://t.sharepoint.com/sites/M/Rohmaterial/clip.mov');
  });

  // .rohmaterial-group clippt fuer den Radius (overflow: hidden). Ohne eigenen
  // Scroll-Wrapper ist die Aktionsspalte auf schmalen Viewports abgeschnitten,
  // und Download/Loeschen sind nicht mehr erreichbar.
  it('legt die Tabelle in einen scrollbaren Wrapper', () => {
    VideoRohmaterialRenderer.updateGroups([group({
      files: [{ id: 'a1', file_name: 'clip.mov', file_size: 1024, created_at: '2026-08-30T10:00:00Z' }],
    })]);

    const table = document.querySelector('#rohmaterial-groups .data-table');
    expect(table.parentElement.classList.contains('rohmaterial-table-wrap')).toBe(true);
  });

  it('rendert keinen Ordner-Link solange es keinen gibt', () => {
    VideoRohmaterialRenderer.updateGroups([group({ folderUrl: null })]);
    const host = document.getElementById('rohmaterial-groups');
    expect(host.textContent).not.toContain('Ordner öffnen');
  });

  it('zeigt einen Empty-State wenn die Kampagne keine Kooperationen hat', () => {
    VideoRohmaterialRenderer.updateGroups([]);
    expect(document.getElementById('rohmaterial-groups').textContent).toContain('Keine Kooperationen');
  });
});
