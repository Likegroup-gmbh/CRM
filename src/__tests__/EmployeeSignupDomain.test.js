import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isAllowedEmployeeEmail,
  isEmployeeDomainError,
  ALLOWED_EMPLOYEE_DOMAINS
} from '../modules/auth/AllowedEmailDomains.js';
import { AuthService } from '../modules/auth/AuthService.js';

describe('isAllowedEmployeeEmail', () => {
  it('erlaubt nur likegroup.de und creatorjobs.com', () => {
    expect(ALLOWED_EMPLOYEE_DOMAINS).toEqual(['likegroup.de', 'creatorjobs.com']);
  });

  it.each([
    'max@likegroup.de',
    'max@creatorjobs.com',
    'Max.Mustermann@LikeGroup.DE',
    '  max@creatorjobs.com  '
  ])('erlaubt %s', (email) => {
    expect(isAllowedEmployeeEmail(email)).toBe(true);
  });

  it.each([
    'andrea.leise@telekom.de',
    'max@likegroup.com',
    'max@mail.likegroup.de',
    'max@evil-likegroup.de',
    'max@notlikegroup.de',
    'x@likegroup.de.evil.com',
    'likegroup.de',
    '@likegroup.de',
    '',
    null,
    undefined
  ])('lehnt %s ab', (email) => {
    expect(isAllowedEmployeeEmail(email)).toBe(false);
  });
});

describe('isEmployeeDomainError', () => {
  it('erkennt Fehlercode und Exception-Text', () => {
    expect(isEmployeeDomainError({ code: 'EMPLOYEE_DOMAIN_NOT_ALLOWED' })).toBe(true);
    expect(isEmployeeDomainError({ message: 'EMPLOYEE_DOMAIN_NOT_ALLOWED' })).toBe(true);
  });

  it('wertet generische DB-Fehler nicht als Domain-Fehler', () => {
    expect(isEmployeeDomainError({ message: 'Database error saving new user' })).toBe(false);
    expect(isEmployeeDomainError(null)).toBe(false);
  });
});

describe('AuthService.signUp Domain-Check', () => {
  let auth;

  beforeEach(() => {
    auth = new AuthService();
    window.supabase = {
      auth: {
        signUp: vi.fn(async () => ({ data: { user: null }, error: null }))
      },
      from: vi.fn()
    };
  });

  it('bricht bei fremder Domain ab, ohne supabase.auth.signUp aufzurufen', async () => {
    const result = await auth.signUp('andrea.leise@telekom.de', 'Andrea', 'Leise', 'passwort123');

    expect(window.supabase.auth.signUp).not.toHaveBeenCalled();
    expect(result.user).toBeNull();
    expect(result.error.code).toBe('EMPLOYEE_DOMAIN_NOT_ALLOWED');
    expect(result.error.message).toContain('@likegroup.de');
    expect(result.error.message).toContain('@creatorjobs.com');
    // Kein Rate-Limit-Eintrag für den reinen Domain-Fehler
    expect(auth._loginAttempts.size).toBe(0);
  });

  it('ruft supabase.auth.signUp bei erlaubter Domain mit role=mitarbeiter auf', async () => {
    await auth.signUp('max@likegroup.de', 'Max', 'Mustermann', 'passwort123');

    expect(window.supabase.auth.signUp).toHaveBeenCalledTimes(1);
    const arg = window.supabase.auth.signUp.mock.calls[0][0];
    expect(arg.email).toBe('max@likegroup.de');
    expect(arg.options.data.role).toBe('mitarbeiter');
  });
});
