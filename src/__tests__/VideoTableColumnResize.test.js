import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VideoTableUIHelpers } from '../modules/kampagne/VideoTableUIHelpers.js';

describe('VideoTableUIHelpers Spalten-Resize', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="grid-wrapper">
        <table class="kooperation-video-grid">
          <thead>
            <tr>
              <th class="col-header col-nr" data-col="0">Nr<div class="resize-handle resize-handle-col" data-col="0"></div></th>
              <th class="col-header col-caption" data-col="27">Caption<div class="resize-handle resize-handle-col" data-col="27"></div></th>
              <th class="col-header col-finale-version" data-col="28">Finale Version<div class="resize-handle resize-handle-col" data-col="28"></div></th>
              <th class="col-header col-posting-datum" data-col="29">Posting Datum<div class="resize-handle resize-handle-col" data-col="29"></div></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="grid-cell"></td>
              <td class="grid-cell"></td>
              <td class="grid-cell col-finale-version"></td>
              <td class="grid-cell"></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('setzt Finale-Version-Breite per data-col, nicht per nth-child(dataCol+1)', () => {
    const helpers = new VideoTableUIHelpers({ columnWidths: new Map() });
    helpers.setColumnWidth('28', 320);

    const finaleHeader = document.querySelector('th.col-finale-version');
    const finaleCell = document.querySelector('td.col-finale-version');
    expect(parseFloat(finaleHeader.style.width)).toBe(20);
    expect(parseFloat(finaleHeader.style.minWidth)).toBe(20);
    expect(parseFloat(finaleCell.style.width)).toBe(20);
    expect(parseFloat(finaleCell.style.minWidth)).toBe(20);

    const caption = document.querySelector('th.col-caption');
    const posting = document.querySelector('th.col-posting-datum');
    expect(caption.style.width).toBe('');
    expect(posting.style.width).toBe('');
  });
});
