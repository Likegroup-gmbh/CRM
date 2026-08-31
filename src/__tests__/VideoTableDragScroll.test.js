import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VideoTableUIHelpers } from '../modules/kampagne/VideoTableUIHelpers.js';

function fireMouseDown(target) {
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

describe('VideoTableUIHelpers.bindDragToScroll', () => {
  let wrapper;
  let helpers;
  let table;

  beforeEach(() => {
    wrapper = document.createElement('div');
    wrapper.className = 'grid-wrapper';
    wrapper.style.cursor = 'grab';
    wrapper.style.userSelect = 'none';
    wrapper.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td class="grid-cell empty-cell">Creator</td>
            <td class="grid-cell video-stack-cell col-produkt"><input class="stacked-video-input" readonly /></td>
            <td class="grid-cell"><div class="address-cell"><div class="address-line">Musterstr. 1</div></div></td>
          </tr>
        </tbody>
      </table>
    `;
    document.body.appendChild(wrapper);

    table = { isDragging: false, isResizing: false, startX: 0, scrollLeft: 0 };
    helpers = new VideoTableUIHelpers(table);
    helpers.bindDragToScroll();
  });

  afterEach(() => {
    helpers.destroy();
    wrapper.remove();
  });

  it('bindet keinen Drag und setzt Grab-Cursor sowie user-select:none zurueck', () => {
    expect(table.isDragging).toBe(false);
    expect(table.dragScrollContainer).toBeNull();
    expect(wrapper.style.cursor).toBe('');
    expect(wrapper.style.userSelect).toBe('');
  });

  it('startet auf keiner Zelle einen Drag, damit Texte markierbar bleiben', () => {
    fireMouseDown(wrapper.querySelector('.empty-cell'));
    fireMouseDown(wrapper.querySelector('.address-line'));
    fireMouseDown(wrapper.querySelector('.col-produkt'));
    fireMouseDown(wrapper.querySelector('.stacked-video-input'));

    expect(table.isDragging).toBe(false);
    expect(wrapper.style.userSelect).toBe('');
  });
});
