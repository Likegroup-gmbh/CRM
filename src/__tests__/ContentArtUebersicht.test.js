import { describe, it, expect } from 'vitest';
import { VideoTableRenderer } from '../modules/kampagne/VideoTableRenderer.js';
import { CONTENT_ART_OPTIONS } from '../modules/kooperation/contentArtOptions.js';

function makeTable() {
  return {
    isColumnVisibleForCustomer: () => true,
    isFieldEditableForUser: () => true
  };
}

function renderContentArtCell(contentArt) {
  const table = makeTable();
  const renderer = new VideoTableRenderer(table);
  const html = renderer._bodyCellRenderers()['col-organic-paid']({
    t: table,
    videos: [{ id: 'v1', content_art: contentArt }]
  });
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.querySelector('select[data-field="content_art"]');
}

describe('Content-Art in der Kampagnenübersicht', () => {
  it('zeigt Partnership Ad als ausgewählt und auswählbar', () => {
    const select = renderContentArtCell('Partnership Ad');
    const selected = select.querySelector('option[selected]');

    expect(selected.value).toBe('Partnership Ad');
    expect(select.querySelector('option[value=""]').hasAttribute('selected')).toBe(false);
    expect([...select.options].map(option => option.value)).toEqual(['', ...CONTENT_ART_OPTIONS]);
  });

  it('hält eine gespeicherte Art, die nicht mehr in der Liste steht', () => {
    const select = renderContentArtCell('Reel');
    const selected = select.querySelector('option[selected]');

    expect(selected.value).toBe('Reel');
    expect(select.querySelector('option[value=""]').hasAttribute('selected')).toBe(false);
  });
});
