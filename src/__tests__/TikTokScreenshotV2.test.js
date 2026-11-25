import { describe, it, expect, beforeEach } from 'vitest';

const {
  randomBirthdate,
  parseTikTokVideoId,
  isTikTokShortLink,
  resolveTikTokShortLink,
  loginWallDom,
  embedPlayerDom,
  isTikTokV2Enabled
} = require('../../netlify/functions/screenshot-utils/platform-tiktok-v2.js');

function rngFrom(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('parseTikTokVideoId', () => {
  it('liest die ID aus der langen URL, auch mit Query', () => {
    expect(parseTikTokVideoId('https://www.tiktok.com/@domi.west/video/7600094635372858646?q=rezepte&t=1776426581793'))
      .toBe('7600094635372858646');
  });

  it('liest die ID aus Player- und Embed-URLs', () => {
    expect(parseTikTokVideoId('https://www.tiktok.com/player/v1/7609089170098769182?autoplay=0')).toBe('7609089170098769182');
    expect(parseTikTokVideoId('https://www.tiktok.com/embed/v2/7609089170098769182')).toBe('7609089170098769182');
  });

  it('liefert null bei Kurzlinks, Profilen und leeren Werten', () => {
    expect(parseTikTokVideoId('https://vm.tiktok.com/ZMabc123/')).toBeNull();
    expect(parseTikTokVideoId('https://www.tiktok.com/@creator')).toBeNull();
    expect(parseTikTokVideoId('')).toBeNull();
    expect(parseTikTokVideoId(null)).toBeNull();
  });
});

describe('Kurzlinks', () => {
  it('erkennt vm-, vt- und /t/-Links', () => {
    expect(isTikTokShortLink('https://vm.tiktok.com/ZMabc123/')).toBe(true);
    expect(isTikTokShortLink('https://vt.tiktok.com/ZSabc123/')).toBe(true);
    expect(isTikTokShortLink('https://www.tiktok.com/t/ZTabc123/')).toBe(true);
    expect(isTikTokShortLink('https://www.tiktok.com/@a/video/7600094635372858646')).toBe(false);
  });

  it('folgt dem Redirect bis zur langen URL', async () => {
    const calls = [];
    const fakeFetch = async (url) => {
      calls.push(url);
      return { headers: { get: () => 'https://www.tiktok.com/@a/video/7600094635372858646?utm=x' } };
    };
    const result = await resolveTikTokShortLink('https://vm.tiktok.com/ZMabc123/', fakeFetch);
    expect(parseTikTokVideoId(result)).toBe('7600094635372858646');
    expect(calls).toHaveLength(1);
  });

  it('gibt die Ausgangs-URL zurueck, wenn der Abruf scheitert', async () => {
    const result = await resolveTikTokShortLink('https://vm.tiktok.com/ZMabc123/', async () => { throw new Error('offline'); });
    expect(result).toBe('https://vm.tiktok.com/ZMabc123/');
  });
});

describe('randomBirthdate', () => {
  it('bleibt in den Grenzen (Tag 1-28, Monat 1-12, Jahr 1985-2002)', () => {
    for (let i = 0; i < 500; i += 1) {
      const { month, day, year } = randomBirthdate();
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(28);
      expect(year).toBeGreaterThanOrEqual(1985);
      expect(year).toBeLessThanOrEqual(2002);
    }
  });

  it('trifft mit extremen Zufallswerten die Randwerte', () => {
    expect(randomBirthdate(rngFrom([0, 0, 0]))).toEqual({ month: 1, day: 1, year: 1985 });
    expect(randomBirthdate(rngFrom([0.999999, 0.999999, 0.999999]))).toEqual({ month: 12, day: 28, year: 2002 });
  });

  it('streut: verschiedene Zufallswerte ergeben verschiedene Daten', () => {
    const a = randomBirthdate(rngFrom([0.1, 0.2, 0.3]));
    const b = randomBirthdate(rngFrom([0.7, 0.8, 0.9]));
    expect(a).not.toEqual(b);
  });
});

function optionList(prefix, labels, selectedIdx) {
  return `
    <div tabindex="0" role="combobox" data-e2e="select-container">
      <div>label</div>
      <div role="listbox" id="${prefix}-options-list-container">
        ${labels.map((l, i) => `<div id="${prefix}-options-item-${i}" role="option" aria-selected="${i === selectedIdx}">${l}</div>`).join('')}
      </div>
    </div>`;
}

const SKIP_FIXTURE = `
  <div data-e2e="login-modal" role="dialog">
    <div tabindex="0" role="button" class="css-qdjorr-5b89d02d--DivSkip e8x2idx2">Überspringen</div>
    <h2>Bei TikTok anmelden</h2>
  </div>`;

const AGE_FIXTURE = `
  <div data-e2e="login-modal" role="dialog">
    <h2>Wann hast du Geburtstag?</h2>
    ${optionList('Month', ['Januar', 'Februar', 'März', 'April'], 0)}
    ${optionList('Day', ['1', '2', '3', '4'], 0)}
    ${optionList('Year', ['2025', '2002', '1995', '1990'], 2)}
    <button type="submit" data-e2e="next-button"><span>Weiter</span></button>
  </div>`;

describe('loginWallDom', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('meldet "none" ohne Login-Modal', () => {
    document.body.innerHTML = '<video></video>';
    expect(loginWallDom('state').state).toBe('none');
  });

  it('erkennt die Skip-Stufe ueber die DivSkip-Klasse', () => {
    document.body.innerHTML = SKIP_FIXTURE;
    expect(loginWallDom('state').state).toBe('skip');
  });

  it('erkennt den Skip-Button auch ohne Klasse ueber den Text', () => {
    document.body.innerHTML = `
      <div data-e2e="login-modal"><div role="button">Skip</div></div>`;
    expect(loginWallDom('state').state).toBe('skip');
  });

  it('erkennt die Altersabfrage mit drei Selects und Weiter', () => {
    document.body.innerHTML = AGE_FIXTURE;
    expect(loginWallDom('state')).toEqual({ state: 'age', selects: 3 });
  });

  it('ignoriert ein verstecktes Login-Modal', () => {
    document.body.innerHTML = `<div style="display:none">${SKIP_FIXTURE}</div>`;
    expect(loginWallDom('state').state).toBe('none');
  });

  it('meldet "unknown", wenn das Modal sichtbar ist, aber weder Skip noch Alter da sind', () => {
    document.body.innerHTML = '<div data-e2e="login-modal"><h2>Bei TikTok anmelden</h2></div>';
    expect(loginWallDom('state').state).toBe('unknown');
  });

  it('klickt Select, Option per Index und per Text im richtigen Select', () => {
    document.body.innerHTML = AGE_FIXTURE;
    const clicked = [];
    document.querySelectorAll('[role="option"]').forEach((o) => o.addEventListener('click', () => clicked.push(o.id)));

    expect(loginWallDom('click', { kind: 'option-index', index: 0, value: 2 })).toBe(true);
    expect(loginWallDom('click', { kind: 'option-index', index: 1, value: 3 })).toBe(true);
    expect(loginWallDom('click', { kind: 'option-text', index: 2, value: '2002' })).toBe(true);

    expect(clicked).toEqual(['Month-options-item-2', 'Day-options-item-3', 'Year-options-item-1']);
  });

  it('liefert false, wenn eine Option nicht existiert', () => {
    document.body.innerHTML = AGE_FIXTURE;
    expect(loginWallDom('click', { kind: 'option-text', index: 2, value: '1850' })).toBe(false);
    expect(loginWallDom('click', { kind: 'option-index', index: 5, value: 0 })).toBe(false);
  });

  it('klickt Skip und Weiter', () => {
    document.body.innerHTML = SKIP_FIXTURE + AGE_FIXTURE;
    let skip = 0;
    let next = 0;
    document.querySelector('[class*="DivSkip"]').addEventListener('click', () => { skip += 1; });
    document.querySelector('[data-e2e="next-button"]').addEventListener('click', () => { next += 1; });
    loginWallDom('click', { kind: 'skip' });
    loginWallDom('click', { kind: 'next' });
    expect([skip, next]).toEqual([1, 1]);
  });

  it('remove-wall entfernt Modal und Maske', () => {
    document.body.innerHTML = `${AGE_FIXTURE}<div class="css-1-DivModalMask e1"></div><p id="rest">bleibt</p>`;
    expect(loginWallDom('remove-wall')).toBeGreaterThanOrEqual(2);
    expect(document.querySelector('[data-e2e="login-modal"]')).toBeNull();
    expect(document.querySelector('[class*="DivModalMask"]')).toBeNull();
    expect(document.getElementById('rest')).not.toBeNull();
  });
});

describe('embedPlayerDom', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="root">
        <div class="player">
          <div class="blur" style="position:absolute;background-image:url(x.jpg)"></div>
          <img alt="Video Cover" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
        </div>
        <div class="author" style="position:absolute">Autor</div>
        <div class="controls" style="position:absolute">00:00/01:35</div>
        <div class="static-note">kein Overlay</div>
      </div>
      <tiktok-cookie-banner></tiktok-cookie-banner>`;
  });

  it('findet das Cover', () => {
    expect(embedPlayerDom('cover').has).toBe(true);
  });

  it('erkennt ein Login-Gate', () => {
    expect(embedPlayerDom('gate')).toBe(false);
    document.body.insertAdjacentHTML('beforeend', '<div data-e2e="login-modal"></div>');
    expect(embedPlayerDom('gate')).toBe(true);
  });

  it('clean blendet Overlays und Cookie-Banner aus, laesst Cover und Blur-Hintergrund stehen', () => {
    const hidden = embedPlayerDom('clean');
    expect(hidden).toBe(3);
    const isHidden = (sel) => document.querySelector(sel).style.display === 'none';
    expect(isHidden('.author')).toBe(true);
    expect(isHidden('.controls')).toBe(true);
    expect(isHidden('tiktok-cookie-banner')).toBe(true);
    expect(isHidden('.blur')).toBe(false);
    expect(isHidden('img')).toBe(false);
    expect(isHidden('.static-note')).toBe(false);
  });

  it('clean ohne Cover macht nichts', () => {
    document.body.innerHTML = '<div style="position:absolute">x</div>';
    expect(embedPlayerDom('clean')).toBe(0);
  });
});

describe('isTikTokV2Enabled', () => {
  it('ist standardmaessig an und mit "off" aus', () => {
    expect(isTikTokV2Enabled({})).toBe(true);
    expect(isTikTokV2Enabled({ TIKTOK_SCREENSHOT_V2: 'on' })).toBe(true);
    expect(isTikTokV2Enabled({ TIKTOK_SCREENSHOT_V2: 'off' })).toBe(false);
    expect(isTikTokV2Enabled({ TIKTOK_SCREENSHOT_V2: 'OFF' })).toBe(false);
  });
});
