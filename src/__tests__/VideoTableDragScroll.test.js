import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  shouldStartVideoTableDragScroll,
  VideoTableUIHelpers
} from '../modules/kampagne/VideoTableUIHelpers.js';

function fireMouseDown(target) {
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

describe('shouldStartVideoTableDragScroll', () => {
  it('startet nicht auf Adress- oder Produkt-Zellen und deren Kindern', () => {
    const addressCell = document.createElement('div');
    addressCell.className = 'address-cell';
    const addressLine = document.createElement('div');
    addressLine.className = 'address-line';
    addressCell.appendChild(addressLine);

    const produktCell = document.createElement('td');
    produktCell.className = 'col-produkt';
    const produktPad = document.createElement('div');
    produktCell.appendChild(produktPad);

    expect(shouldStartVideoTableDragScroll(addressCell)).toBe(false);
    expect(shouldStartVideoTableDragScroll(addressLine)).toBe(false);
    expect(shouldStartVideoTableDragScroll(produktCell)).toBe(false);
    expect(shouldStartVideoTableDragScroll(produktPad)).toBe(false);
  });

  it('startet nicht auf Form-Controls, Links, Resize-Handle oder waehrend Resize', () => {
    const input = document.createElement('input');
    const handle = document.createElement('div');
    handle.className = 'resize-handle-col';
    const link = document.createElement('a');
    const empty = document.createElement('td');

    expect(shouldStartVideoTableDragScroll(input)).toBe(false);
    expect(shouldStartVideoTableDragScroll(handle)).toBe(false);
    expect(shouldStartVideoTableDragScroll(link)).toBe(false);
    expect(shouldStartVideoTableDragScroll(empty, true)).toBe(false);
  });

  it('startet auf normalen Zellen', () => {
    const cell = document.createElement('td');
    cell.className = 'grid-cell';
    expect(shouldStartVideoTableDragScroll(cell)).toBe(true);
  });
});

describe('VideoTableUIHelpers.bindDragToScroll', () => {
  let wrapper;
  let helpers;
  let table;

  beforeEach(() => {
    wrapper = document.createElement('div');
    wrapper.className = 'grid-wrapper';
    wrapper.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td class="grid-cell empty-cell"></td>
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

  it('startet keinen Drag auf Adresse oder Produkt und laesst user-select an', () => {
    fireMouseDown(wrapper.querySelector('.address-line'));
    expect(table.isDragging).toBe(false);
    expect(wrapper.style.userSelect).toBe('');

    fireMouseDown(wrapper.querySelector('.col-produkt'));
    expect(table.isDragging).toBe(false);
    expect(wrapper.style.userSelect).toBe('');

    fireMouseDown(wrapper.querySelector('.stacked-video-input'));
    expect(table.isDragging).toBe(false);
    expect(wrapper.style.userSelect).toBe('');
  });

  it('startet Drag auf einer normalen Zelle', () => {
    fireMouseDown(wrapper.querySelector('.empty-cell'));
    expect(table.isDragging).toBe(true);
    expect(wrapper.style.userSelect).toBe('none');
  });
});
