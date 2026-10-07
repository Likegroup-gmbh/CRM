import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SelectionBar, bindCheckboxSelection } from '../core/list/SelectionBar.js';

describe('bindCheckboxSelection', () => {
  let root;
  let controller;

  const table = () => {
    root.innerHTML = `
      <table>
        <thead><tr><th><input type="checkbox" class="all"></th></tr></thead>
        <tbody>
          <tr data-row><td><input type="checkbox" class="item" data-id="a"></td><td class="cell">A</td><td><a href="#">link</a></td></tr>
          <tr data-row><td><input type="checkbox" class="item" data-id="b"></td><td class="cell">B</td><td></td></tr>
        </tbody>
      </table>`;
  };

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    controller = new AbortController();
    table();
  });

  afterEach(() => {
    controller.abort();
    root.remove();
  });

  const bind = (extra = {}) => {
    const selected = extra.selected || new Set();
    const onChange = vi.fn();
    const sel = bindCheckboxSelection({
      root, signal: controller.signal, selected,
      itemSelector: '.item', selectAllSelector: '.all', onChange, ...extra
    });
    return { selected, onChange, sel };
  };

  const check = (id, checked = true) => {
    const cb = root.querySelector(`.item[data-id="${id}"]`);
    cb.checked = checked;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('schreibt Einzelauswahl in ein Set und meldet sie', () => {
    const { selected, onChange } = bind();
    check('a');
    expect([...selected]).toEqual(['a']);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ source: 'item', checked: true }));
    check('a', false);
    expect(selected.size).toBe(0);
  });

  it('hält Snapshots in einer Map', () => {
    const { selected } = bind({ selected: new Map(), snapshotOf: (cb) => ({ id: cb.dataset.id }) });
    check('b');
    expect(selected.get('b')).toEqual({ id: 'b' });
  });

  it('Select-All wählt alle sichtbaren und setzt den Kopf zwischen den Zuständen', () => {
    const { selected } = bind();
    const all = root.querySelector('.all');
    all.checked = true;
    all.dispatchEvent(new Event('change', { bubbles: true }));
    expect([...selected].sort()).toEqual(['a', 'b']);

    check('a', false);
    expect(all.checked).toBe(false);
    expect(all.indeterminate).toBe(true);

    check('a', true);
    expect(all.checked).toBe(true);
    expect(all.indeterminate).toBe(false);
  });

  it('Zeilenklick wählt, Klicks auf Links und Checkbox gelten nicht doppelt', () => {
    const { selected } = bind({ rowSelector: 'tr[data-row]' });
    root.querySelector('.cell').click();
    expect([...selected]).toEqual(['a']);

    root.querySelector('a').click();
    expect([...selected]).toEqual(['a']);

    root.querySelector('.cell').click();
    expect(selected.size).toBe(0);
  });

  it('restore setzt Häkchen und verwirft mit prune verschwundene Schlüssel', () => {
    const selected = new Set(['a', 'gone']);
    const { sel } = bind({ selected });
    sel.restore({ prune: true });
    expect(root.querySelector('.item[data-id="a"]').checked).toBe(true);
    expect(root.querySelector('.item[data-id="b"]').checked).toBe(false);
    expect([...selected]).toEqual(['a']);
  });

  it('restore ohne prune behält Schlüssel anderer Seiten', () => {
    const selected = new Set(['a', 'gone']);
    const { sel } = bind({ selected });
    sel.restore();
    expect([...selected].sort()).toEqual(['a', 'gone']);
  });

  it('clear leert Auswahl, Checkboxen und Kopf', () => {
    const { selected, sel } = bind();
    const all = root.querySelector('.all');
    all.checked = true;
    all.dispatchEvent(new Event('change', { bubbles: true }));
    sel.clear();
    expect(selected.size).toBe(0);
    expect(root.querySelectorAll('.item:checked')).toHaveLength(0);
    expect(all.checked).toBe(false);
  });

  it('bleibt nach einem Neurendern der Zeilen gebunden (Delegation)', () => {
    const { selected } = bind();
    table();
    check('b');
    expect([...selected]).toEqual(['b']);
  });
});

describe('SelectionBar', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('baut die Leiste versteckt auf und zeigt Zähler ab einer Auswahl', () => {
    const bar = new SelectionBar({ id: 'bar-test', countLabel: 'Creator ausgewählt' });
    const el = bar.mount('<button data-selection-action="go">Los</button>');
    expect(document.getElementById('bar-test')).toBe(el);
    expect(el.style.display).toBe('none');

    bar.update(3);
    expect(el.style.display).toBe('flex');
    expect(el.querySelector('.bulk-count').textContent).toBe('3 Creator ausgewählt');

    bar.update(0);
    expect(el.style.display).toBe('none');
  });

  it('leitet Aktionen und Auswahl aufheben weiter', () => {
    const onAction = vi.fn();
    const onDeselect = vi.fn();
    const bar = new SelectionBar({ id: 'bar-test', onAction, onDeselect });
    const el = bar.mount('<button data-selection-action="go">Los</button>');

    el.querySelector('[data-selection-action="go"]').click();
    expect(onAction).toHaveBeenCalledWith('go', expect.any(Event));

    el.querySelector('[data-selection-deselect]').click();
    expect(onDeselect).toHaveBeenCalledTimes(1);
  });

  it('ersetzt beim erneuten mount die alte Leiste und bindet nichts doppelt', () => {
    const onAction = vi.fn();
    const bar = new SelectionBar({ id: 'bar-test', onAction });
    bar.mount('<button data-selection-action="go">Los</button>');
    const el = bar.mount('<button data-selection-action="go">Los</button>');

    expect(document.querySelectorAll('#bar-test')).toHaveLength(1);
    el.querySelector('[data-selection-action="go"]').click();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('ignoriert Klicks auf deaktivierte Aktionen und räumt mit destroy auf', () => {
    const onAction = vi.fn();
    const bar = new SelectionBar({ id: 'bar-test', onAction });
    const el = bar.mount('<button data-selection-action="go" disabled>Los</button>');
    el.querySelector('button[data-selection-action]').click();
    expect(onAction).not.toHaveBeenCalled();

    bar.destroy();
    expect(document.getElementById('bar-test')).toBeNull();
  });
});
