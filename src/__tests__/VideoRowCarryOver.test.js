import { describe, it, expect } from 'vitest';
import { addVideoRow, carryOverFromLastVideo } from '../core/form/logic/events/VideosFields.js';
import { attachVideoStepper, makeRecalcAllPrices } from '../modules/kooperation/KooperationStepperBinder.js';

const ARTEN = ['Influencer', 'UGC'];
const CONTENT = ['Paid', 'Partnership Ad'];

function filledRow() {
  return {
    kampagnenart: 'Influencer',
    content_art: 'Partnership Ad',
    einkaufspreis_netto: 100,
    verkaufspreis_netto: 250,
    skript_deadline: '2026-11-01',
    content_deadline: '2026-11-15'
  };
}

function values(row) {
  return {
    kampagnenart: row.querySelector('.video-kampagnenart-select').value,
    content_art: row.querySelector('.video-content-select').value,
    ek: row.querySelector('.video-ek-input').value,
    vk: row.querySelector('.video-vk-input').value,
    skript: row.querySelector('.video-skript-deadline-input').value,
    content: row.querySelector('.video-content-deadline-input').value
  };
}

describe('Video-Zeile übernimmt vom letzten Video', () => {
  it('kopiert Kampagnenart, Content-Art, EK und VK und lässt Deadlines leer', () => {
    const list = document.createElement('div');
    addVideoRow(list, CONTENT, filledRow(), ARTEN);
    addVideoRow(list, CONTENT, carryOverFromLastVideo(list), ARTEN);

    const rows = list.querySelectorAll('.video-item');
    expect(values(rows[1])).toEqual({
      kampagnenart: 'Influencer',
      content_art: 'Partnership Ad',
      ek: '100',
      vk: '250',
      skript: '',
      content: ''
    });
  });

  it('übernimmt leere Felder der untersten Zeile und schaut nicht weiter nach oben', () => {
    const list = document.createElement('div');
    addVideoRow(list, CONTENT, filledRow(), ARTEN);
    addVideoRow(list, CONTENT, {
      kampagnenart: 'UGC',
      content_art: '',
      einkaufspreis_netto: null,
      verkaufspreis_netto: 0
    }, ARTEN);
    addVideoRow(list, CONTENT, carryOverFromLastVideo(list), ARTEN);

    const neu = list.querySelector('.video-item:last-of-type');
    expect(values(neu).kampagnenart).toBe('UGC');
    expect(values(neu).content_art).toBe('');
    expect(values(neu).ek).toBe('');
    expect(values(neu).vk).toBe('0');
  });

  it('lässt die erste Zeile leer, wenn noch kein Video da ist', () => {
    const list = document.createElement('div');
    addVideoRow(list, CONTENT, carryOverFromLastVideo(list), ARTEN);
    expect(values(list.querySelector('.video-item'))).toEqual({
      kampagnenart: '',
      content_art: '',
      ek: '',
      vk: '',
      skript: '',
      content: ''
    });
  });

  it('zählt übernommene Preise beim Plus im Stepper sofort in die Summen', () => {
    document.body.innerHTML = `
      <form>
        <input name="videoanzahl" value="1" min="0" max="5">
        <input name="einkaufspreis_netto">
        <input name="verkaufspreis_netto">
        <div class="videos-list"></div>
      </form>
    `;
    const form = document.querySelector('form');
    const videoInput = form.querySelector('input[name="videoanzahl"]');
    const videosList = form.querySelector('.videos-list');
    addVideoRow(videosList, CONTENT, filledRow(), ARTEN);
    const recalc = makeRecalcAllPrices(form, videosList);
    attachVideoStepper(form, {
      videoInput,
      videosList,
      contentArtOptions: CONTENT,
      kampagnenartenOptions: ARTEN,
      recalcAllPrices: recalc
    });

    form.querySelector('.stepper-plus').click();

    const neu = videosList.querySelector('.video-item:last-of-type');
    expect(videosList.querySelectorAll('.video-item')).toHaveLength(2);
    expect(values(neu).content_art).toBe('Partnership Ad');
    expect(values(neu).ek).toBe('100');
    expect(form.querySelector('input[name="einkaufspreis_netto"]').value).toBe('200.00');
    expect(form.querySelector('input[name="verkaufspreis_netto"]').value).toBe('500.00');
    expect(neu.querySelector('.video-skript-deadline-input').value).toBe('');
  });
});
