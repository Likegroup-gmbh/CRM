import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubmitGuard } from '../core/SubmitGuard.js';

describe('SubmitGuard handleEntityCreated', () => {
  let guard;

  beforeEach(() => {
    vi.useFakeTimers();
    window.navigateTo = vi.fn();
    guard = new SubmitGuard();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('navigiert nach created zur Listen-Route', () => {
    guard.handleEntityCreated(new CustomEvent('entityUpdated', {
      detail: { entity: 'creator', action: 'created', id: 'c1' }
    }));

    expect(window.navigateTo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(window.navigateTo).toHaveBeenCalledWith('/creator');
  });

  it('überspringt Listen-Redirect bei skipListRedirect', () => {
    guard.handleEntityCreated(new CustomEvent('entityUpdated', {
      detail: { entity: 'kooperation', action: 'created', id: 'k1', skipListRedirect: true }
    }));

    vi.advanceTimersByTime(1000);
    expect(window.navigateTo).not.toHaveBeenCalled();
  });

  it('navigiert nicht bei action updated', () => {
    guard.handleEntityCreated(new CustomEvent('entityUpdated', {
      detail: { entity: 'kooperation', action: 'updated', id: 'k1' }
    }));

    vi.advanceTimersByTime(300);
    expect(window.navigateTo).not.toHaveBeenCalled();
  });
});
