import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VideoTableRenderer } from '../modules/kampagne/VideoTableRenderer.js';
import { LiveLinkToolbar } from '../modules/kampagne/LiveLinkToolbar.js';
import { applyLiveLinkCellState, liveLinkDotState } from '../modules/kampagne/liveLinkCell.js';

const REEL_URL = 'https://www.instagram.com/reel/DABC123/?igsh=xyz';

function makeTable(videos = {}) {
  return {
    videos,
    store: null,
    isKundeRole: () => false,
    isFieldEditableForUser: () => true,
    escapeHtml: (v) => (v == null ? '' : String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'))
  };
}

function renderCell(video, { koop, table } = {}) {
  const t = table || makeTable();
  const renderer = new VideoTableRenderer(t);
  const html = renderer._renderLiveLinkCell(koop || { creator: { instagram: 'paulinemary' } }, video);
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
}

describe('Live-Link-Zelle', () => {
  it('zeigt den Chip mit Beitragsart und Handle, die URL bleibt im Input', () => {
    const cell = renderCell({ id: 'v1', link_live: REEL_URL });

    expect(cell.querySelector('input[data-field="link_live"]').value).toBe(REEL_URL);
    expect(cell.querySelector('.live-link-chip__label').textContent)
      .toBe('Reel · @paulinemary');
  });

  it('faellt ohne Creator-Handle auf den Shortcode zurueck', () => {
    const cell = renderCell({ id: 'v1', link_live: REEL_URL }, { koop: { creator: {} } });

    expect(cell.querySelector('.live-link-chip__label').textContent).toBe('Reel · DABC123');
  });

  it('haelt die Zelle ohne Link ruhig: Chip versteckt, Punkt ausgeblendet', () => {
    const cell = renderCell({ id: 'v1', link_live: null });

    expect(cell.querySelector('[data-live-link-chip]').hasAttribute('hidden')).toBe(true);
    expect(cell.querySelector('[data-live-link-dot]').className).toContain('is-empty');
  });

  it('rendert unabhaengig vom Link-Zustand denselben Zellenaufbau', () => {
    // Der frueher springende Teil: Extern-Link und X existierten nur bei
    // gesetzter URL und haben den Input in der Breite verschoben. Jetzt sind
    // die direkten Kinder der Zelle immer dieselben.
    // Zustands-Modifier (is-idle/is-empty am Punkt) bleiben aussen vor, die
    // beeinflussen nur die Farbe.
    const aufbau = (video) => [...renderCell(video).querySelector('.live-link-cell').children]
      .map(el => `${el.tagName}.${el.className.replace(/\s*is-[a-z]+/g, '')}`);

    expect(aufbau({ id: 'v1', link_live: REEL_URL }))
      .toEqual(aufbau({ id: 'v1', link_live: null }));
  });

  it('legt keine Aktions-Buttons mehr in die Zelle', () => {
    const cell = renderCell({ id: 'v1', link_live: REEL_URL });

    expect(cell.querySelector('button')).toBeNull();
    expect(cell.querySelector('.external-link-btn')).toBeNull();
  });

  it('zeigt Kunden einen anklickbaren Chip statt eines Eingabefelds', () => {
    const table = makeTable();
    table.isKundeRole = () => true;
    const cell = renderCell({ id: 'v1', link_live: REEL_URL }, { table });

    expect(cell.querySelector('input')).toBeNull();
    const link = cell.querySelector('a.live-link-chip--static');
    expect(link.getAttribute('href')).toBe(REEL_URL);
    expect(link.textContent).toContain('Reel · @paulinemary');
  });

  it('haengt den Status-Punkt nicht in den Screenreader-Baum', () => {
    // Derselbe Text steht als Hinweiszeile in der Leiste.
    const cell = renderCell({ id: 'v1', link_live: REEL_URL });

    expect(cell.querySelector('[data-live-link-dot]').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Status-Punkt', () => {
  it('unterscheidet leer, noch nicht abgerufen, abgerufen und Fehler', () => {
    expect(liveLinkDotState({}).stateClass).toBe('is-empty');
    expect(liveLinkDotState({ link_live: REEL_URL }).stateClass).toBe('is-idle');
    expect(liveLinkDotState({ link_live: REEL_URL, stats_fetched_at: '2026-08-01T10:00:00Z' }).stateClass)
      .toBe('is-fetched');
    expect(liveLinkDotState({ link_live: REEL_URL, stats_error: 'Nicht gefunden' }).stateClass)
      .toBe('is-error');
  });

  it('nimmt den Fehlertext in den Tooltip', () => {
    const { title } = liveLinkDotState({ link_live: REEL_URL, stats_error: 'Nicht gefunden' });
    expect(title).toContain('Nicht gefunden');
  });
});

describe('applyLiveLinkCellState', () => {
  it('zieht Chip, Punkt und Input nach einem Clear nach', () => {
    const host = renderCell({ id: 'v1', link_live: REEL_URL, stats_fetched_at: '2026-08-01T10:00:00Z' });
    const cell = host.querySelector('.live-link-cell');
    document.body.appendChild(host);

    applyLiveLinkCellState(cell, { id: 'v1', link_live: null });

    expect(cell.querySelector('input[data-field="link_live"]').value).toBe('');
    expect(cell.querySelector('[data-live-link-chip]').hidden).toBe(true);
    expect(cell.querySelector('[data-live-link-dot]').className).toContain('is-empty');
    host.remove();
  });

  it('faerbt den Punkt nach einem erfolgreichen Abruf um', () => {
    const host = renderCell({ id: 'v1', link_live: REEL_URL });
    const cell = host.querySelector('.live-link-cell');

    applyLiveLinkCellState(cell, { id: 'v1', link_live: REEL_URL, stats_fetched_at: '2026-08-01T10:00:00Z' });

    const dot = cell.querySelector('[data-live-link-dot]');
    expect(dot.className).toContain('is-fetched');
    expect(dot.className).not.toContain('is-idle');
  });

  it('ueberschreibt ein gerade bearbeitetes Feld nicht', () => {
    const host = renderCell({ id: 'v1', link_live: REEL_URL });
    document.body.appendChild(host);
    const input = host.querySelector('input[data-field="link_live"]');
    input.value = 'gerade getippt';
    input.focus();

    applyLiveLinkCellState(host.querySelector('.live-link-cell'), { id: 'v1', link_live: REEL_URL });

    expect(input.value).toBe('gerade getippt');
    host.remove();
  });
});

describe('LiveLinkToolbar', () => {
  let table;
  let toolbar;
  let cell;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  function setup(video) {
    table = makeTable({ k1: [video] });
    const host = renderCell(video, { table });
    document.body.appendChild(host);
    cell = host.querySelector('.live-link-cell');
    toolbar = new LiveLinkToolbar(table);
    return toolbar;
  }

  it('oeffnet als Portal an document.body, nicht in der Zelle', () => {
    setup({ id: 'v1', link_live: REEL_URL }).open(cell);

    const portal = document.querySelector('.live-link-toolbar');
    expect(portal).not.toBeNull();
    expect(portal.parentElement).toBe(document.body);
    expect(cell.querySelector('.live-link-toolbar')).toBeNull();
    expect(cell.classList.contains('has-toolbar')).toBe(true);
  });

  it('bietet Abrufen, Oeffnen und Entfernen an', () => {
    setup({ id: 'v1', link_live: REEL_URL }).open(cell);
    const portal = document.querySelector('.live-link-toolbar');

    expect(portal.querySelector('[data-video-stats-fetch]').dataset.videoId).toBe('v1');
    expect(portal.querySelector('a[href]').getAttribute('href')).toBe(REEL_URL);
    expect(portal.querySelector('[data-video-link-clear]').dataset.videoId).toBe('v1');
  });

  it('oeffnet nicht, solange kein Link eingetragen ist', () => {
    setup({ id: 'v1', link_live: null }).open(cell);

    expect(document.querySelector('.live-link-toolbar')).toBeNull();
  });

  it('oeffnet auch fuer einen noch nicht gespeicherten Link im Input', () => {
    const t = setup({ id: 'v1', link_live: null });
    cell.querySelector('input[data-field="link_live"]').value = REEL_URL;

    t.open(cell);
    expect(document.querySelector('.live-link-toolbar')).not.toBeNull();
  });

  it('beschriftet die Hauptaktion nach dem Abruf-Zustand', () => {
    setup({ id: 'v1', link_live: REEL_URL }).open(cell);
    expect(document.querySelector('[data-video-stats-fetch]').textContent)
      .toContain('Statistiken abrufen');

    document.body.innerHTML = '';
    setup({ id: 'v2', link_live: REEL_URL, stats_fetched_at: '2026-08-01T10:00:00Z' }).open(cell);
    expect(document.querySelector('[data-video-stats-fetch]').textContent)
      .toContain('Aktualisieren');

    document.body.innerHTML = '';
    setup({ id: 'v3', link_live: REEL_URL, stats_error: 'Beitrag nicht gefunden' }).open(cell);
    expect(document.querySelector('[data-video-stats-fetch]').textContent)
      .toContain('Erneut versuchen');
  });

  it('macht den Abruf-Fehler sichtbar statt ihn im Tooltip zu verstecken', () => {
    setup({ id: 'v1', link_live: REEL_URL, stats_error: 'Beitrag nicht gefunden' }).open(cell);

    expect(document.querySelector('.live-link-toolbar__error').textContent)
      .toContain('Beitrag nicht gefunden');
    expect(document.querySelector('.live-link-toolbar__hint')).toBeNull();
  });

  it('zeigt den Zeitstempel nur, wenn wirklich abgerufen wurde', () => {
    setup({ id: 'v1', link_live: REEL_URL }).open(cell);
    expect(document.querySelector('.live-link-toolbar__hint')).toBeNull();

    document.body.innerHTML = '';
    setup({ id: 'v2', link_live: REEL_URL, stats_fetched_at: '2026-08-01T10:00:00Z' }).open(cell);
    expect(document.querySelector('.live-link-toolbar__hint').textContent).toContain('Stand:');
  });

  it('schliesst bei Escape', () => {
    setup({ id: 'v1', link_live: REEL_URL }).open(cell);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.querySelector('.live-link-toolbar')).toBeNull();
    expect(cell.classList.contains('has-toolbar')).toBe(false);
  });

  it('schliesst beim Scrollen, weil eine fixe Position sonst stehenbliebe', () => {
    setup({ id: 'v1', link_live: REEL_URL }).open(cell);

    window.dispatchEvent(new Event('scroll'));

    expect(document.querySelector('.live-link-toolbar')).toBeNull();
  });

  it('haelt beim Verlassen kurz nach, damit der Weg zur Leiste nicht abreisst', async () => {
    const t = setup({ id: 'v1', link_live: REEL_URL });
    t.open(cell);

    t.scheduleClose();
    expect(document.querySelector('.live-link-toolbar')).not.toBeNull();

    await new Promise(r => setTimeout(r, 250));
    expect(document.querySelector('.live-link-toolbar')).toBeNull();
  });

  it('bleibt waehrend eines laufenden Abrufs offen', async () => {
    const t = setup({ id: 'v1', link_live: REEL_URL });
    t.open(cell);
    t.pin();

    t.scheduleClose();
    await new Promise(r => setTimeout(r, 250));

    expect(document.querySelector('.live-link-toolbar')).not.toBeNull();
  });

  it('schliesst nach dem Abruf selbst, wenn der Zeiger inzwischen weg ist', async () => {
    // Ohne diesen Weg bliebe die Leiste haengen: waehrend des Abrufs ist sie
    // gepinnt, und ein weiteres mouseout kommt nie.
    const t = setup({ id: 'v1', link_live: REEL_URL });
    t.open(cell);
    t.pin();
    t.scheduleClose();

    t.unpin();
    await new Promise(r => setTimeout(r, 250));

    expect(document.querySelector('.live-link-toolbar')).toBeNull();
  });

  it('bleibt offen, solange der Fokus in der Zelle steht', async () => {
    const t = setup({ id: 'v1', link_live: REEL_URL });
    t.open(cell);
    cell.querySelector('input[data-field="link_live"]').focus();

    // Ein focusout beim Klick auf einen Button der Leiste darf den Klick nicht
    // wegziehen, auf den er reagiert.
    t.scheduleClose();
    await new Promise(r => setTimeout(r, 250));

    expect(document.querySelector('.live-link-toolbar')).not.toBeNull();
  });

  it('laesst nie zwei Leisten gleichzeitig stehen', () => {
    const t = setup({ id: 'v1', link_live: REEL_URL });
    t.open(cell);
    t.open(cell);

    expect(document.querySelectorAll('.live-link-toolbar').length).toBe(1);
  });

  it('schliesst beim Refresh, wenn der Link inzwischen weg ist', () => {
    const video = { id: 'v1', link_live: REEL_URL };
    const t = setup(video);
    t.open(cell);

    video.link_live = null;
    cell.querySelector('input[data-field="link_live"]').value = '';
    t.refresh();

    expect(document.querySelector('.live-link-toolbar')).toBeNull();
  });
});
