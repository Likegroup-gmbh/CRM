import { describe, expect, it } from 'vitest';
import { scrollClipOnWheel } from '../core/horizontalClipWheel.js';

function box({ overflowY, scrollWidth = 400, clientWidth = 100 }) {
  const el = document.createElement('div');
  el.style.overflowX = 'auto';
  el.style.overflowY = overflowY;
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth });
  document.body.appendChild(el);
  el.addEventListener('wheel', scrollClipOnWheel);
  return el;
}

function wheel(target, deltaX, deltaY = 0) {
  const event = new WheelEvent('wheel', {
    deltaX,
    deltaY,
    bubbles: true,
    cancelable: true
  });
  target.dispatchEvent(event);
  return event;
}

describe('scrollClipOnWheel', () => {
  it('schiebt eine waagerechte Geste, die clip sonst verwirft', () => {
    const el = box({ overflowY: 'clip' });
    const inner = document.createElement('span');
    el.appendChild(inner);

    const event = wheel(inner, 80);

    expect(el.scrollLeft).toBe(80);
    expect(event.defaultPrevented).toBe(true);
    el.remove();
  });

  it('lässt senkrechtes Scrollen und normale Scrollports in Ruhe', () => {
    const clipped = box({ overflowY: 'clip' });
    const vertical = wheel(clipped, 10, 40);
    expect(clipped.scrollLeft).toBe(0);
    expect(vertical.defaultPrevented).toBe(false);

    const normal = box({ overflowY: 'auto' });
    const horizontal = wheel(normal, 80);
    expect(normal.scrollLeft).toBe(0);
    expect(horizontal.defaultPrevented).toBe(false);

    clipped.remove();
    normal.remove();
  });
});
