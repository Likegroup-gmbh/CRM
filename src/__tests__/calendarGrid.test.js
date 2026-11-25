import { describe, it, expect, vi, afterEach } from 'vitest';
import { CalendarGrid } from '../core/components/CalendarGrid.js';
import { CALENDAR_DRAG_TYPE } from '../core/components/calendarGridDnd.js';

vi.mock('../core/icons/IconSystem.js', () => ({ icon: () => '<svg></svg>' }));

function dragEvent(type, id) {
  const store = new Map(id ? [[CALENDAR_DRAG_TYPE, id]] : []);
  const e = new Event(type, { bubbles: true, cancelable: true });
  e.dataTransfer = {
    types: [...store.keys()],
    getData: (t) => store.get(t) || '',
    setData: (t, v) => store.set(t, v),
    effectAllowed: 'none',
    dropEffect: 'none'
  };
  return e;
}

function mount(opts = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const grid = new CalendarGrid(el, {
    view: 'month',
    anchor: '2026-11-18',
    getEvents: () => [
      { id: 'a', date: '2026-11-05', title: 'Lea <b>', sub: 'Video 1', draggable: true },
      { id: 'b', date: '2026-11-05', title: 'Max', sub: 'Video 2', tooltip: 'Herbst-Look' }
    ],
    ...opts
  });
  grid.render();
  return { el, grid };
}

afterEach(() => { document.body.innerHTML = ''; });

describe('CalendarGrid', () => {
  it('rendert den Monat mit escapten Karten am richtigen Tag', () => {
    const { el } = mount({ onMove: vi.fn() });
    expect(el.classList.contains('calendar-main')).toBe(true);
    expect(el.querySelector('.calendar-title').textContent).toBe('November 2026');
    const day = el.querySelector('[data-cal-drop="2026-11-05"]');
    expect(day.querySelectorAll('[data-cal-event]')).toHaveLength(2);
    expect(day.innerHTML).toContain('Lea &lt;b&gt;');
    expect(day.querySelector('[data-cal-event="a"]').getAttribute('draggable')).toBe('true');
    expect(day.querySelector('[data-cal-event="b"]').getAttribute('title')).toBe('Herbst-Look');
  });

  it('ohne onMove ist nichts verschiebbar, ohne onSelect nichts klickbar', () => {
    const { el } = mount();
    expect(el.querySelector('[draggable="true"]')).toBeNull();
    expect(el.querySelector('[data-cal-event="a"]').classList.contains('is-static')).toBe(true);
  });

  it('wechselt Woche und Monat und meldet den Zustand', () => {
    const onStateChange = vi.fn();
    const { el, grid } = mount({ onStateChange });
    el.querySelector('[data-cal-nav="toggle"]').click();
    expect(grid.view).toBe('week');
    expect(el.querySelector('.calendar-week-grid')).not.toBeNull();
    expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'week' }));
    el.querySelector('[data-cal-nav="next"]').click();
    el.querySelector('[data-cal-nav="toggle"]').click();
    expect(grid.view).toBe('month');
  });

  it('meldet einen Klick auf eine Karte', () => {
    const onSelect = vi.fn();
    const { el } = mount({ onSelect });
    el.querySelector('[data-cal-event="b"]').click();
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('verschiebt per Drop auf einen anderen Tag, auch Karten von außen', async () => {
    const onMove = vi.fn();
    const { el } = mount({ onMove });
    const target = el.querySelector('[data-cal-drop="2026-11-12"]');

    const over = dragEvent('dragover', 'a');
    target.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    expect(target.classList.contains('drag-over')).toBe(true);

    target.dispatchEvent(dragEvent('drop', 'a'));
    target.dispatchEvent(dragEvent('drop', 'aus-der-liste'));
    await Promise.resolve();
    expect(onMove).toHaveBeenCalledWith('a', '2026-11-12');
    expect(onMove).toHaveBeenCalledWith('aus-der-liste', '2026-11-12');
    expect(target.classList.contains('drag-over')).toBe(false);
  });

  it('ignoriert einen Drop auf denselben Tag und fremde Drags', () => {
    const onMove = vi.fn();
    const { el } = mount({ onMove });
    const same = el.querySelector('[data-cal-drop="2026-11-05"]');
    same.dispatchEvent(dragEvent('drop', 'a'));
    const fremd = dragEvent('dragover', null);
    same.dispatchEvent(fremd);
    expect(fremd.defaultPrevented).toBe(false);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('öffnet bei mehr als fünf Karten den Tages-Drawer', () => {
    const events = Array.from({ length: 7 }, (_, i) => ({ id: `e${i}`, date: '2026-11-20', title: `E${i}` }));
    const { el } = mount({ getEvents: () => events, drawerTitle: 'Alle Videos an diesem Tag' });
    const more = el.querySelector('[data-cal-more="2026-11-20"]');
    expect(more.textContent).toBe('+2');
    more.click();
    const drawer = document.querySelector('.day-events-drawer-overlay');
    expect(drawer.querySelectorAll('[data-cal-event]')).toHaveLength(7);
    expect(drawer.querySelector('h3').textContent).toBe('Alle Videos an diesem Tag');
  });
});
