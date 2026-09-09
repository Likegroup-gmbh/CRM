import { describe, it, expect, beforeEach, vi } from 'vitest';
import { preserveScroll } from '../core/dom/preserveScroll.js';

// rAF synchron ausfuehren, damit der Restore im selben Tick pruefbar ist.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); return 1; });
});

function scrollable({ top = 0, left = 0 } = {}) {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: top });
  Object.defineProperty(el, 'scrollLeft', { configurable: true, writable: true, value: left });
  return el;
}

describe('preserveScroll', () => {
  it('haelt window.scrollY ueber den DOM-Tausch', () => {
    window.scrollY = 640;
    const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    preserveScroll(() => { document.body.innerHTML = '<div>neu</div>'; });

    expect(spy).toHaveBeenCalledWith({ top: 640, behavior: 'instant' });
    spy.mockRestore();
  });

  it('stellt scrollTop/scrollLeft eines lebenden Nodes wieder her', () => {
    const container = scrollable({ top: 120, left: 40 });
    document.body.appendChild(container);

    preserveScroll(() => { container.scrollTop = 0; container.scrollLeft = 0; }, { keep: [container] });

    expect(container.scrollTop).toBe(120);
    expect(container.scrollLeft).toBe(40);
  });

  it('loest Selektoren nach dem Tausch neu auf (ersetzte Nodes)', () => {
    const container = document.createElement('div');
    const grid = scrollable({ left: 200 });
    grid.className = 'grid-wrapper';
    container.appendChild(grid);
    document.body.appendChild(container);

    preserveScroll(() => {
      container.innerHTML = '<div class="grid-wrapper"></div>';
      const neu = container.querySelector('.grid-wrapper');
      Object.defineProperty(neu, 'scrollLeft', { configurable: true, writable: true, value: 0 });
    }, { keep: [{ sel: '.grid-wrapper', scope: container }] });

    expect(container.querySelector('.grid-wrapper').scrollLeft).toBe(200);
  });

  it('vertical: false laesst das Fenster in Ruhe', () => {
    const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    preserveScroll(() => {}, { vertical: false });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('gibt den Rueckgabewert von fn durch', () => {
    expect(preserveScroll(() => 42)).toBe(42);
  });
});
