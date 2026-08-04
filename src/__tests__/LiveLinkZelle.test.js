import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VideoTableRenderer } from '../modules/kampagne/VideoTableRenderer.js';
import { applyLiveLinkCellState, liveLinkDotState, LIVE_LINK_TOOLBAR } from '../modules/kampagne/liveLinkCell.js';
import { createLiveLinkToolbarConfig } from '../modules/kampagne/liveLinkToolbarConfig.js';
import { hoverToolbar } from '../core/hoverToolbar/HoverToolbar.js';
import { registerHoverToolbar, clearHoverToolbarConfigs } from '../core/hoverToolbar/HoverToolbarRegistry.js';

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
    expect(cell.querySelector('.chip-cell__label').textContent)
      .toBe('Reel · @paulinemary');
  });

  it('faellt ohne Creator-Handle auf den Shortcode zurueck', () => {
    const cell = renderCell({ id: 'v1', link_live: REEL_URL }, { koop: { creator: {} } });

    expect(cell.querySelector('.chip-cell__label').textContent).toBe('Reel · DABC123');
  });

  it('haelt die Zelle ohne Link ruhig: Chip versteckt, Punkt ausgeblendet', () => {
    const cell = renderCell({ id: 'v1', link_live: null });

    expect(cell.querySelector('[data-chip-cell-chip]').hasAttribute('hidden')).toBe(true);
    expect(cell.querySelector('[data-chip-cell-dot]').className).toContain('is-empty');
  });

  it('rendert unabhaengig vom Link-Zustand denselben Zellenaufbau', () => {
    // Der frueher springende Teil: Extern-Link und X existierten nur bei
    // gesetzter URL und haben den Input in der Breite verschoben. Jetzt sind
    // die direkten Kinder der Zelle immer dieselben.
    // Zustands-Modifier (is-idle/is-empty am Punkt) bleiben aussen vor, die
    // beeinflussen nur die Farbe.
    const aufbau = (video) => [...renderCell(video).querySelector('.chip-cell').children]
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
    const link = cell.querySelector('a.chip-cell__chip--static');
    expect(link.getAttribute('href')).toBe(REEL_URL);
    expect(link.textContent).toContain('Reel · @paulinemary');
  });

  it('haengt den Status-Punkt nicht in den Screenreader-Baum', () => {
    // Derselbe Text steht als Hinweiszeile in der Leiste.
    const cell = renderCell({ id: 'v1', link_live: REEL_URL });

    expect(cell.querySelector('[data-chip-cell-dot]').getAttribute('aria-hidden')).toBe('true');
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
    const cell = host.querySelector('.chip-cell');
    document.body.appendChild(host);

    applyLiveLinkCellState(cell, { id: 'v1', link_live: null });

    expect(cell.querySelector('input[data-field="link_live"]').value).toBe('');
    expect(cell.querySelector('[data-chip-cell-chip]').hidden).toBe(true);
    expect(cell.querySelector('[data-chip-cell-dot]').className).toContain('is-empty');
    host.remove();
  });

  it('faerbt den Punkt nach einem erfolgreichen Abruf um', () => {
    const host = renderCell({ id: 'v1', link_live: REEL_URL });
    const cell = host.querySelector('.chip-cell');

    applyLiveLinkCellState(cell, { id: 'v1', link_live: REEL_URL, stats_fetched_at: '2026-08-01T10:00:00Z' });

    const dot = cell.querySelector('[data-chip-cell-dot]');
    expect(dot.className).toContain('is-fetched');
    expect(dot.className).not.toContain('is-idle');
  });

  it('ueberschreibt ein gerade bearbeitetes Feld nicht', () => {
    const host = renderCell({ id: 'v1', link_live: REEL_URL });
    document.body.appendChild(host);
    const input = host.querySelector('input[data-field="link_live"]');
    input.value = 'gerade getippt';
    input.focus();

    applyLiveLinkCellState(host.querySelector('.chip-cell'), { id: 'v1', link_live: REEL_URL });

    expect(input.value).toBe('gerade getippt');
    host.remove();
  });
});

// Die Mechanik der Leiste (Timing, Portal, Escape, pin/unpin) steckt in
// HoverToolbar.test.js. Hier steht nur, was die Live-Link-Config daraus macht.
describe('Live-Link-Toolbar-Config', () => {
  let cell;
  let statsFetcher;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    hoverToolbar.close();
    clearHoverToolbarConfigs();
  });

  afterEach(() => {
    hoverToolbar.destroy();
    clearHoverToolbarConfigs();
    document.body.innerHTML = '';
  });

  function setup(video) {
    statsFetcher = { handleFetch: vi.fn(), handleClear: vi.fn() };
    const table = makeTable({ k1: [video] });
    table._statsFetcher = statsFetcher;

    const host = renderCell(video, { table });
    document.body.appendChild(host);
    cell = host.querySelector('.chip-cell');

    registerHoverToolbar(LIVE_LINK_TOOLBAR, createLiveLinkToolbarConfig(table));
    return cell;
  }

  const portal = () => document.querySelector('.hover-toolbar');

  it('bietet Abrufen, Oeffnen und Entfernen in dieser Reihenfolge an', () => {
    hoverToolbar.open(setup({ id: 'v1', link_live: REEL_URL }));

    const ids = [...portal().querySelectorAll('[data-hover-action]')]
      .map(el => el.dataset.hoverAction);
    expect(ids).toEqual(['stats-fetch', 'open', 'link-clear']);

    expect(portal().querySelector('[data-hover-action="open"]').getAttribute('href'))
      .toBe(REEL_URL);
    expect(portal().querySelector('[data-hover-action="link-clear"]').className)
      .toContain('hover-toolbar__btn--danger');
  });

  it('oeffnet nicht, solange kein Link eingetragen ist', () => {
    hoverToolbar.open(setup({ id: 'v1', link_live: null }));

    expect(portal()).toBeNull();
  });

  it('oeffnet auch fuer einen noch nicht gespeicherten Link im Input', () => {
    const c = setup({ id: 'v1', link_live: null });
    c.querySelector('input[data-field="link_live"]').value = REEL_URL;

    hoverToolbar.open(c);
    expect(portal()).not.toBeNull();
  });

  it('beschriftet die Hauptaktion nach dem Abruf-Zustand', () => {
    const label = () => portal().querySelector('[data-hover-action="stats-fetch"]').textContent;

    hoverToolbar.open(setup({ id: 'v1', link_live: REEL_URL }));
    expect(label()).toContain('Statistiken abrufen');

    hoverToolbar.close();
    hoverToolbar.open(setup({ id: 'v2', link_live: REEL_URL, stats_fetched_at: '2026-08-01T10:00:00Z' }));
    expect(label()).toContain('Aktualisieren');

    hoverToolbar.close();
    hoverToolbar.open(setup({ id: 'v3', link_live: REEL_URL, stats_error: 'Beitrag nicht gefunden' }));
    expect(label()).toContain('Erneut versuchen');
  });

  it('macht den Abruf-Fehler sichtbar statt ihn im Tooltip zu verstecken', () => {
    hoverToolbar.open(setup({ id: 'v1', link_live: REEL_URL, stats_error: 'Beitrag nicht gefunden' }));

    expect(document.querySelector('.hover-toolbar__error').textContent)
      .toContain('Beitrag nicht gefunden');
    expect(document.querySelector('.hover-toolbar__hint')).toBeNull();
  });

  it('zeigt den Zeitstempel nur, wenn wirklich abgerufen wurde', () => {
    hoverToolbar.open(setup({ id: 'v1', link_live: REEL_URL }));
    expect(document.querySelector('.hover-toolbar__hint')).toBeNull();

    hoverToolbar.close();
    hoverToolbar.open(setup({ id: 'v2', link_live: REEL_URL, stats_fetched_at: '2026-08-01T10:00:00Z' }));
    expect(document.querySelector('.hover-toolbar__hint').textContent).toContain('Stand:');
  });

  it('gibt dem StatsFetcher die Video-ID mit, weil die Leiste ausserhalb der Zeile sitzt', () => {
    hoverToolbar.init();
    hoverToolbar.open(setup({ id: 'v1', link_live: REEL_URL }));

    const fetchBtn = portal().querySelector('[data-hover-action="stats-fetch"]');
    fetchBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(statsFetcher.handleFetch).toHaveBeenCalledWith('v1', fetchBtn);

    const clearBtn = portal().querySelector('[data-hover-action="link-clear"]');
    clearBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(statsFetcher.handleClear).toHaveBeenCalledWith('v1', clearBtn);
  });

  it('schliesst beim Refresh, wenn der Link inzwischen weg ist', () => {
    const video = { id: 'v1', link_live: REEL_URL };
    hoverToolbar.open(setup(video));

    video.link_live = null;
    cell.querySelector('input[data-field="link_live"]').value = '';
    hoverToolbar.refresh();

    expect(portal()).toBeNull();
  });
});
