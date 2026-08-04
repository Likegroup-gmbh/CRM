import { describe, it, expect, afterEach } from 'vitest';
import {
  renderChipCell,
  renderChipDot,
  renderPlatformChip,
  renderStaticChip,
  applyChipCellState,
  setChipCellLoading,
  findChipCell
} from '../core/components/chipCell.js';

const REEL_URL = 'https://www.instagram.com/reel/DABC123/';
const PROFIL_URL = 'https://www.instagram.com/paulinemary/';

function mount(html) {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('renderPlatformChip', () => {
  it('zeigt bei einem Beitrag Art und Handle', () => {
    const host = mount(renderPlatformChip(REEL_URL, 'paulinemary'));
    expect(host.querySelector('.chip-cell__label').textContent).toBe('Reel · @paulinemary');
  });

  it('zeigt bei einem Profil nur den Handle aus der URL', () => {
    const host = mount(renderPlatformChip(PROFIL_URL, ''));
    expect(host.querySelector('.chip-cell__label').textContent).toBe('@paulinemary');
  });

  it('waehlt das Icon nach der Plattform', () => {
    expect(renderPlatformChip('https://www.tiktok.com/@creator', '')).toContain('chip-cell__icon');
    expect(renderPlatformChip('', '')).toBe('');
  });

  it('escaped die Beschriftung', () => {
    const chip = renderPlatformChip('https://example.com/x', '"><script>');
    expect(chip).not.toContain('<script>');
  });
});

describe('renderChipCell', () => {
  const zelle = (value, dot) => mount(renderChipCell({
    toolbar: 'test-toolbar',
    id: 'a1',
    input: { value, placeholder: 'Link...', className: 'eigene-klasse', attrs: { 'data-field': 'link' } },
    chip: renderPlatformChip(value, ''),
    dot
  })).querySelector('.chip-cell');

  it('meldet sich per data-Attributen bei der Engine an', () => {
    const cell = zelle(REEL_URL, { stateClass: 'is-idle' });
    expect(cell.dataset.hoverToolbar).toBe('test-toolbar');
    expect(cell.dataset.id).toBe('a1');
  });

  it('haelt die Roh-URL im Input und uebernimmt die Klassen des Aufrufers', () => {
    const input = zelle(REEL_URL, {}).querySelector('input');
    expect(input.value).toBe(REEL_URL);
    expect(input.className).toBe('chip-cell__input eigene-klasse');
    expect(input.dataset.field).toBe('link');
    expect(input.placeholder).toBe('Link...');
  });

  it('rendert mit und ohne Wert denselben Aufbau', () => {
    // Der frueher springende Teil: Extern-Link und Loesch-Button existierten nur
    // bei gefuellter URL und haben den Input in der Breite verschoben.
    const aufbau = (value) => [...zelle(value, {}).children]
      .map(el => `${el.tagName}.${el.className.replace(/\s*is-[a-z]+/g, '')}`);

    expect(aufbau(REEL_URL)).toEqual(aufbau(''));
  });

  it('versteckt den Chip ohne Wert', () => {
    expect(zelle('', {}).querySelector('[data-chip-cell-chip]').hasAttribute('hidden')).toBe(true);
    expect(zelle(REEL_URL, {}).querySelector('[data-chip-cell-chip]').hasAttribute('hidden')).toBe(false);
  });

  it('haelt den Punkt aus dem Screenreader-Baum', () => {
    const dot = zelle(REEL_URL, { stateClass: 'is-idle', title: 'Noch nicht abgerufen' });
    expect(dot.querySelector('[data-chip-cell-dot]').getAttribute('aria-hidden')).toBe('true');
    expect(dot.querySelector('[data-chip-cell-dot]').title).toBe('Noch nicht abgerufen');
  });

  it('macht den Punkt zum Ausloeser fuer Geraete ohne Hover', () => {
    expect(zelle(REEL_URL, {}).querySelector('[data-chip-cell-dot]')
      .hasAttribute('data-hover-toolbar-trigger')).toBe(true);
  });

  it('legt keine Buttons in die Zelle', () => {
    expect(zelle(REEL_URL, {}).querySelector('button')).toBeNull();
  });

  it('escaped Werte, die im Attribut landen', () => {
    const html = renderChipCell({ toolbar: 't', id: 'a1', input: { value: '" onfocus="alert(1)' } });
    expect(html).not.toContain('onfocus="alert(1)"');
    const input = mount(html).querySelector('input');
    expect(input.value).toBe('" onfocus="alert(1)');
  });
});

describe('renderChipDot', () => {
  it('nimmt den Zustand als Klasse und faellt auf is-empty zurueck', () => {
    expect(renderChipDot({ stateClass: 'is-error' })).toContain('is-error');
    expect(renderChipDot()).toContain('is-empty');
  });
});

describe('renderStaticChip', () => {
  it('macht aus dem Chip einen anklickbaren Link', () => {
    const link = mount(renderStaticChip({
      href: REEL_URL, chip: renderPlatformChip(REEL_URL, 'paulinemary'), title: 'Oeffnen'
    })).querySelector('a');

    expect(link.getAttribute('href')).toBe(REEL_URL);
    expect(link.className).toContain('chip-cell__chip--static');
    expect(link.textContent).toContain('Reel · @paulinemary');
  });

  it('liefert ohne Link nichts, damit der Aufrufer seinen Platzhalter setzt', () => {
    expect(renderStaticChip({ href: '', chip: 'x' })).toBe('');
    expect(renderStaticChip({ href: REEL_URL, chip: '' })).toBe('');
  });
});

describe('applyChipCellState', () => {
  function setup() {
    const host = mount(renderChipCell({
      toolbar: 'test-toolbar',
      id: 'a1',
      input: { value: REEL_URL },
      chip: renderPlatformChip(REEL_URL, 'paulinemary'),
      dot: { stateClass: 'is-fetched', title: 'Abgerufen' }
    }));
    return host.querySelector('.chip-cell');
  }

  it('zieht Input, Chip und Punkt nach', () => {
    const cell = setup();

    applyChipCellState(cell, { value: '', chip: '', dot: { stateClass: 'is-empty' } });

    expect(cell.querySelector('input').value).toBe('');
    expect(cell.querySelector('[data-chip-cell-chip]').hidden).toBe(true);
    const dot = cell.querySelector('[data-chip-cell-dot]');
    expect(dot.className).toContain('is-empty');
    expect(dot.className).not.toContain('is-fetched');
    expect(dot.title).toBe('');
  });

  it('laesst weg, was nicht uebergeben wurde', () => {
    const cell = setup();

    applyChipCellState(cell, { dot: { stateClass: 'is-error', title: 'Fehler' } });

    expect(cell.querySelector('input').value).toBe(REEL_URL);
    expect(cell.querySelector('[data-chip-cell-chip]').hidden).toBe(false);
    expect(cell.querySelector('[data-chip-cell-dot]').className).toContain('is-error');
  });

  it('ueberschreibt kein Feld, in dem gerade getippt wird', () => {
    const cell = setup();
    const input = cell.querySelector('input');
    input.value = 'gerade getippt';
    input.focus();

    applyChipCellState(cell, { value: REEL_URL });

    expect(input.value).toBe('gerade getippt');
  });

  it('bleibt ohne Zelle still', () => {
    expect(() => applyChipCellState(null, { value: 'x' })).not.toThrow();
  });
});

describe('setChipCellLoading', () => {
  it('schaltet den Punkt in den Spinner und zurueck', () => {
    const cell = mount(renderChipCell({ toolbar: 't', id: 'a1', dot: { stateClass: 'is-idle' } }))
      .querySelector('.chip-cell');
    const dot = cell.querySelector('[data-chip-cell-dot]');

    setChipCellLoading(cell, true);
    expect(dot.className).toContain('is-loading');

    setChipCellLoading(cell, false);
    expect(dot.className).not.toContain('is-loading');
  });
});

describe('findChipCell', () => {
  it('findet die Zelle ueber Config-Name und ID', () => {
    mount(renderChipCell({ toolbar: 'test-toolbar', id: 'a1' })
      + renderChipCell({ toolbar: 'test-toolbar', id: 'a2' }));

    expect(findChipCell('test-toolbar', 'a2').dataset.id).toBe('a2');
    expect(findChipCell('test-toolbar', 'a9')).toBeNull();
    expect(findChipCell('andere-toolbar', 'a1')).toBeNull();
    expect(findChipCell('test-toolbar', null)).toBeNull();
  });
});
