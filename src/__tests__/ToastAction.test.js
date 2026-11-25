import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastSystem } from '../core/ToastSystem.js';

describe('ToastSystem mit Aktion', () => {
  let toasts;

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
    toasts = new ToastSystem();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('zeigt die Schaltfläche, ruft die Aktion einmal und schließt den Toast', () => {
    const onClick = vi.fn();
    toasts.show('Als final markiert.', 'success', undefined, { action: { label: 'Rückgängig', onClick } });
    const button = document.querySelector('.toast .toast-action');
    expect(button.textContent).toBe('Rückgängig');
    button.click();
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(400);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('bleibt mit Aktion mindestens 5 Sekunden stehen, ohne Aktion bleibt es bei 3', () => {
    toasts.show('Mit', 'success', undefined, { action: { label: 'Rückgängig', onClick: () => {} } });
    toasts.show('Ohne', 'success');
    vi.advanceTimersByTime(3400);
    expect([...document.querySelectorAll('.toast-message')].map(m => m.textContent)).toEqual(['Mit']);
    vi.advanceTimersByTime(1800);
    vi.advanceTimersByTime(400);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('maskiert Nachricht und Label, eine Aktion ohne Funktion zeigt keine Schaltfläche', () => {
    toasts.show('<img src=x>', 'info', 3000, { action: { label: '<b>x</b>', onClick: () => {} } });
    expect(document.querySelector('.toast img')).toBeNull();
    expect(document.querySelector('.toast-action b')).toBeNull();
    toasts.show('Nur Text', 'info', 3000, { action: { label: 'Ohne' } });
    expect(document.querySelectorAll('.toast-action')).toHaveLength(1);
  });
});
