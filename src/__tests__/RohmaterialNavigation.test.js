import { describe, it, expect, beforeEach, vi } from 'vitest';

import { VideoList } from '../modules/video/VideoList.js';
import { VideoFolderRenderer } from '../modules/video/VideoFolderRenderer.js';

// Der Split Videos|Rohmaterial ist intern; Kunden duerfen Rohmaterial nicht
// einmal als Ordner sehen. Getestet wird die Navigations-Entscheidung, nicht
// das Rendering-Drumherum.
describe('VideoList: Videos|Rohmaterial-Split', () => {
  let list;
  let rendered;

  beforeEach(() => {
    rendered = [];
    list = new VideoList();
    list.loadAndRender = vi.fn(() => { rendered.push(list.viewMode); });
    window.breadcrumbSystem = { updateBreadcrumb: vi.fn() };
    window.history.replaceState({}, '', '/videos');
  });

  const lastCrumbs = () => window.breadcrumbSystem.updateBreadcrumb.mock.calls.at(-1)[0];

  function selectKampagne() {
    // Spiegelt die Verdrahtung in VideoList._bindAllEvents
    return list.isKunde
      ? list._switchToVideos('k1', 'Kampagne 1')
      : list._switchToKampagneRoot('k1', 'Kampagne 1');
  }

  it('intern: Kampagne fuehrt auf die Ordner-Auswahl, nicht direkt in die Tabelle', () => {
    list.isKunde = false;
    selectKampagne();

    expect(list.viewMode).toBe('kampagneRoot');
    expect(list.currentKampagneId).toBe('k1');
  });

  it('Kunde: Kampagne fuehrt direkt in die Video-Tabelle', () => {
    list.isKunde = true;
    selectKampagne();

    expect(list.viewMode).toBe('videos');
    expect(rendered).toEqual(['videos']);
  });

  it('Ordner-Auswahl fuehrt auf Videos bzw. Rohmaterial', () => {
    list.isKunde = false;
    list._switchToKampagneRoot('k1', 'Kampagne 1');

    list._switchToRohmaterial();
    expect(list.viewMode).toBe('rohmaterial');
    expect(list.currentKampagneId).toBe('k1');

    list._switchToVideos('k1', 'Kampagne 1');
    expect(list.viewMode).toBe('videos');
  });

  it('intern fuehrt Zurück aus der Tabelle auf den Split zurueck', () => {
    list.isKunde = false;
    list._switchToVideos('k1', 'Kampagne 1');

    const back = () => list.viewMode === 'videos' && !list.isKunde
      ? list._switchToKampagneRoot(list.currentKampagneId, list.currentKampagneName)
      : list._switchToKampagnen(list.currentUnternehmenId, list.currentUnternehmenName);

    back();
    expect(list.viewMode).toBe('kampagneRoot');
  });

  it('Kunde landet mit Zurück bei den Kampagnen, nicht auf dem Split', () => {
    list.isKunde = true;
    list._switchToVideos('k1', 'Kampagne 1');

    const back = () => list.viewMode === 'videos' && !list.isKunde
      ? list._switchToKampagneRoot(list.currentKampagneId, list.currentKampagneName)
      : list._switchToKampagnen(list.currentUnternehmenId, list.currentUnternehmenName);

    back();
    expect(list.viewMode).toBe('kampagnen');
  });

  it('setzt geladene Rohmaterial-Gruppen beim Kampagnenwechsel zurueck', () => {
    list.rohmaterialGroups = [{ id: 'koop-1', files: [{ id: 'a1' }] }];
    list._switchToKampagneRoot('k2', 'Kampagne 2');
    expect(list.rohmaterialGroups).toEqual([]);
  });

  it('markiert Rohmaterial im Breadcrumb', () => {
    list._switchToKampagneRoot('k1', 'Kampagne 1');
    list._switchToRohmaterial();
    expect(lastCrumbs().map((c) => c.label)).toEqual(['Videos', 'Kampagne 1', 'Rohmaterial']);
  });

  it('Breadcrumb zeigt Firma und Kampagne, URL hält die Ebene', () => {
    list.isKunde = false;
    list._switchToKampagnen('u1', 'Acme');
    expect(lastCrumbs()).toEqual([
      { label: 'Videos', url: '/videos', clickable: true },
      { label: 'Acme', url: '#', clickable: false }
    ]);

    list._switchToKampagneRoot('k1', 'Kampagne 1');
    list._switchToVideos('k1', 'Kampagne 1');
    const crumbs = lastCrumbs();
    expect(crumbs.map((c) => c.label)).toEqual(['Videos', 'Acme', 'Kampagne 1', 'Videos']);
    expect(crumbs[2]).toMatchObject({ clickable: true });
    expect(new URL(crumbs[2].url, 'http://x').searchParams.get('ebene')).toBeNull();

    const params = new URLSearchParams(window.location.search);
    expect(params.get('unternehmen')).toBe('u1');
    expect(params.get('kampagne')).toBe('k1');
    expect(params.get('ebene')).toBe('videos');
  });

  it('Deep-Link stellt die Ebene wieder her (intern und Kunde)', () => {
    list.isKunde = false;
    list.applyQueryParams(new URLSearchParams('unternehmen=u1&unternehmen_name=Acme&kampagne=k1&kampagne_name=K&ebene=rohmaterial'));
    expect(list.viewMode).toBe('rohmaterial');
    expect(list.currentUnternehmenName).toBe('Acme');

    list.applyQueryParams(new URLSearchParams('unternehmen=u1&unternehmen_name=Acme'));
    expect(list.viewMode).toBe('kampagnen');

    list.isKunde = true;
    list.applyQueryParams(new URLSearchParams('kampagne=k1&kampagne_name=K&ebene=rohmaterial'));
    expect(list.viewMode).toBe('videos');
    expect(list.currentUnternehmenId).toBeNull();

    list.applyQueryParams(new URLSearchParams(''));
    expect(list.viewMode).toBe('kampagnen');
  });
});

describe('VideoFolderRenderer.renderKampagneRootView', () => {
  it('rendert genau die zwei Ordner Videos und Rohmaterial', () => {
    document.body.innerHTML = VideoFolderRenderer.renderKampagneRootView();

    const cards = [...document.querySelectorAll('#kampagne-root-grid .folder-card')];
    expect(cards.map(c => c.dataset.rootTarget)).toEqual(['videos', 'rohmaterial']);
    expect(document.body.textContent).toContain('Videos');
    expect(document.body.textContent).toContain('Rohmaterial');
    expect(document.getElementById('btn-back-to-kampagnen')).toBeTruthy();
  });
});
