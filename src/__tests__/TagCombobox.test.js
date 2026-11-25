import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TagCombobox } from '../core/components/TagCombobox.js';

const OPTIONS = {
  groups: [
    { label: 'Persona', items: [{ id: 't1', label: 'Persona A' }, { id: 't4', label: 'Persona B' }] },
    { label: 'Plattform', items: [{ id: 't2', label: 'TikTok' }] }
  ],
  create: null
};

function build(overrides = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const calls = { select: [], create: [], removeLast: 0, close: [] };
  const combo = new TagCombobox({
    host,
    getOptions: (q) => {
      const needle = q.trim().toLowerCase();
      const groups = OPTIONS.groups
        .map(g => ({ ...g, items: g.items.filter(i => i.label.toLowerCase().includes(needle)) }))
        .filter(g => g.items.length);
      return { groups, create: needle && !groups.length ? q.trim() : null };
    },
    onSelect: (item) => calls.select.push(item.id),
    onCreate: (label) => calls.create.push(label),
    onRemoveLast: () => { calls.removeLast += 1; },
    onClose: (reason) => calls.close.push(reason),
    ...overrides
  });
  return { host, combo, calls };
}

const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const options = (host) => [...host.querySelectorAll('[role="option"]')];
const type = (combo, value) => {
  combo.input.value = value;
  combo.input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('TagCombobox', () => {
  beforeEach(() => { document.body.innerHTML = ''; });
  afterEach(() => { vi.useRealTimers(); });

  it('öffnet mit fokussiertem Feld, ARIA-Rollen und gruppierten Optionen', () => {
    const { host, combo } = build();
    combo.open();
    expect(document.activeElement).toBe(combo.input);
    expect(combo.input.getAttribute('role')).toBe('combobox');
    expect(combo.input.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[role="listbox"]').id).toBe(combo.input.getAttribute('aria-controls'));
    expect(options(host).map(o => o.textContent)).toEqual(['Persona A', 'Persona B', 'TikTok']);
    expect(host.querySelectorAll('.tag-combo__heading')).toHaveLength(2);
    expect(combo.input.getAttribute('aria-activedescendant')).toBe(options(host)[0].id);
  });

  it('Pfeiltasten wandern zyklisch, der Fokus bleibt im Feld', () => {
    const { host, combo } = build();
    combo.open();
    key(combo.input, 'ArrowDown');
    expect(options(host)[1].getAttribute('aria-selected')).toBe('true');
    key(combo.input, 'ArrowUp');
    key(combo.input, 'ArrowUp');
    expect(options(host)[2].classList.contains('is-active')).toBe(true);
    expect(document.activeElement).toBe(combo.input);
  });

  it('Enter und Komma übernehmen, die Liste bleibt offen und das Feld leer', () => {
    const { host, combo, calls } = build();
    combo.open();
    type(combo, 'tik');
    expect(options(host).map(o => o.textContent)).toEqual(['TikTok']);
    key(combo.input, 'Enter');
    expect(calls.select).toEqual(['t2']);
    expect(combo.isOpen).toBe(true);
    expect(combo.input.value).toBe('');
    key(combo.input, ',');
    expect(calls.select).toEqual(['t2', 't1']);
  });

  it('Klick auf eine Option wählt, ohne das Feld zu blurren', () => {
    const { host, combo, calls } = build();
    combo.open();
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    options(host)[1].dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    options(host)[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls.select).toEqual(['t4']);
    expect(document.activeElement).toBe(combo.input);
  });

  it('bietet Neu anlegen ohne Treffer und meldet das Label', () => {
    const { host, combo, calls } = build();
    combo.open();
    type(combo, 'Neu Tag');
    expect(options(host)).toHaveLength(1);
    expect(options(host)[0].classList.contains('tag-combo__option--create')).toBe(true);
    key(combo.input, 'Enter');
    expect(calls.create).toEqual(['Neu Tag']);
  });

  it('Backspace im leeren Feld ruft onRemoveLast, mit Text nicht', () => {
    const { combo, calls } = build();
    combo.open();
    type(combo, 'x');
    key(combo.input, 'Backspace');
    expect(calls.removeLast).toBe(0);
    type(combo, '');
    key(combo.input, 'Backspace');
    expect(calls.removeLast).toBe(1);
  });

  it('Esc schließt und meldet den Grund, das Host-Element ist danach leer', () => {
    const { host, combo, calls } = build();
    combo.open();
    key(combo.input, 'Escape');
    expect(calls.close).toEqual(['escape']);
    expect(host.innerHTML).toBe('');
    expect(combo.isOpen).toBe(false);
  });

  it('Verlassen des Felds schließt verzögert, kehrt der Fokus zurück, bleibt es offen', () => {
    vi.useFakeTimers();
    const { combo, calls } = build();
    combo.open();
    combo.input.dispatchEvent(new FocusEvent('blur'));
    combo.input.focus();
    vi.advanceTimersByTime(200);
    expect(combo.isOpen).toBe(true);

    document.body.focus();
    combo.input.blur();
    vi.advanceTimersByTime(200);
    expect(calls.close).toEqual(['blur']);
  });
});
