import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mocks vor den Imports der abhängigen Module definieren (vitest hoisted die Aufrufe).
vi.mock('../modules/auth/AuthService.js', () => ({
  authService: {
    signInWithPassword: vi.fn()
  }
}));

vi.mock('../modules/auth/AuthUtils.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    authUtils: new mod.AuthUtils()
  };
});

import { AuthUtils } from '../modules/auth/AuthUtils.js';
import { authService } from '../modules/auth/AuthService.js';
import { SubmitGuard } from '../core/SubmitGuard.js';

async function flush() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe('Login-Retry nach fehlgeschlagenem Versuch', () => {
  let authUtils;
  let guard;

  beforeEach(() => {
    document.body.innerHTML = '';
    window.appRoot = document.createElement('div');
    window.loginRoot = document.createElement('div');
    document.body.appendChild(window.appRoot);
    document.body.appendChild(window.loginRoot);

    authService.signInWithPassword.mockReset();

    authUtils = new AuthUtils();
    authUtils.showApp = vi.fn();
    authUtils.showLogin();

    // Der reale Guard aus der App muss laufen, sonst ist der Test nicht red-capable.
    guard = new SubmitGuard();
    guard.init();
  });

  afterEach(() => {
    // Capture-Listener entfernen, sonst bleiben sie ueber Tests hinweg aktiv
    // und blockieren den naechsten Submit als "Doppelklick".
    document.removeEventListener('submit', guard._onFormSubmit, true);
    document.removeEventListener('click', guard._onButtonClick, true);

    vi.restoreAllMocks();
    document.body.innerHTML = '';
    delete window.appRoot;
    delete window.loginRoot;
  });

  it('gibt den Submit-Button nach einem Fehler wieder frei', async () => {
    authService.signInWithPassword.mockResolvedValueOnce({
      user: null,
      error: new Error('Invalid login credentials')
    });

    const form = document.getElementById('loginForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    const errorDiv = document.getElementById('loginError');

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    expect(errorDiv.style.display).toBe('block');
    expect(errorDiv.textContent).not.toBe('');
    expect(submitBtn.dataset.submitLocked).toBe('false');
    expect(submitBtn.classList.contains('is-submit-locked')).toBe(false);
  });

  it('lässt einen zweiten Login-Versuch nach einem Fehler zu', async () => {
    authService.signInWithPassword
      .mockResolvedValueOnce({ user: null, error: new Error('Invalid login credentials') })
      .mockResolvedValueOnce({ user: { id: 'u1' }, error: null });

    const form = document.getElementById('loginForm');
    const errorDiv = document.getElementById('loginError');

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    expect(authService.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(errorDiv.style.display).toBe('block');

    // Der zweite Submit darf vom SubmitGuard nicht mehr abgefangen werden.
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    expect(authService.signInWithPassword).toHaveBeenCalledTimes(2);
    expect(errorDiv.style.display).toBe('none');
    expect(authUtils.showApp).toHaveBeenCalledTimes(1);
  });
});
