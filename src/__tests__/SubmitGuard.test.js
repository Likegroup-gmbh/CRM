import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubmitGuard } from '../core/SubmitGuard.js';

const herkunft = [
  { label: 'Kampagnen', url: '/kampagne' },
  { label: 'Sommer', url: '/kampagne/k1?tab=produktion' }
];

function emit(guard, detail) {
  guard.handleEntityCreated(new CustomEvent('entityUpdated', { detail }));
}

describe('SubmitGuard handleEntityCreated', () => {
  let guard;

  beforeEach(() => {
    vi.useFakeTimers();
    window.navigateTo = vi.fn();
    guard = new SubmitGuard();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
    document.body.innerHTML = '';
  });

  it('created auf Formular-Route: zurück zur Herkunft aus dem Klickpfad', () => {
    window.history.replaceState({ route: '/creator/new', trail: herkunft }, '', '/creator/new');
    emit(guard, { entity: 'creator', action: 'created', id: 'c1', redirect: true });

    expect(window.navigateTo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(window.navigateTo).toHaveBeenCalledWith('/kampagne/k1?tab=produktion');
  });

  it('created ohne Klickpfad: Liste als Fallback', () => {
    window.history.replaceState({ route: '/creator/new', trail: [] }, '', '/creator/new');
    emit(guard, { entity: 'creator', action: 'created', id: 'c1', redirect: true });

    vi.advanceTimersByTime(300);
    expect(window.navigateTo).toHaveBeenCalledWith('/creator');
  });

  it('updated ohne Klickpfad: Detail als Fallback', () => {
    window.history.replaceState({ route: '/ansprechpartner/a1/edit', trail: [] }, '', '/ansprechpartner/a1/edit');
    emit(guard, { entity: 'ansprechpartner', action: 'updated', id: 'a1', redirect: true });

    vi.advanceTimersByTime(300);
    expect(window.navigateTo).toHaveBeenCalledWith('/ansprechpartner/a1');
  });

  it('ohne redirect-Flag keine Navigation (Wizard, Drawer, eigene Handler)', () => {
    window.history.replaceState({ route: '/creator/new', trail: herkunft }, '', '/creator/new');
    emit(guard, { entity: 'creator', action: 'created', id: 'c1' });

    vi.advanceTimersByTime(1000);
    expect(window.navigateTo).not.toHaveBeenCalled();
  });

  it('updated außerhalb einer Formular-Route (Inline-Edit) navigiert nicht', () => {
    window.history.replaceState({ route: '/kooperation/k1', trail: herkunft }, '', '/kooperation/k1');
    emit(guard, { entity: 'kooperation', action: 'updated', id: 'k1', redirect: true });

    vi.advanceTimersByTime(1000);
    expect(window.navigateTo).not.toHaveBeenCalled();
  });

  it('bevorzugt navigateReplace, damit Zurück nicht ins Formular führt', () => {
    window.navigateReplace = vi.fn();
    try {
      window.history.replaceState({ route: '/unternehmen/new', trail: herkunft }, '', '/unternehmen/new');
      emit(guard, { entity: 'unternehmen', action: 'created', id: 'u1', redirect: true });

      vi.advanceTimersByTime(300);
      expect(window.navigateReplace).toHaveBeenCalledWith('/kampagne/k1?tab=produktion');
      expect(window.navigateTo).not.toHaveBeenCalled();
    } finally {
      delete window.navigateReplace;
    }
  });
});
