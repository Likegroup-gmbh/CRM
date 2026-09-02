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
    window.breadcrumbSystem = { updateDetailLabel: vi.fn() };
  });

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
    expect(window.breadcrumbSystem.updateDetailLabel)
      .toHaveBeenLastCalledWith('Kampagne 1 · Rohmaterial');
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
