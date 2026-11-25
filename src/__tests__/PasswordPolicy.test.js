import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  passwordPolicyError,
  isWeakPasswordError,
  PASSWORD_POLICY_MESSAGE
} from '../auth/password-hints.js';
import { AuthService } from '../modules/auth/AuthService.js';

const SUPABASE_WEAK_TEXT =
  'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~.';

describe('passwordPolicyError', () => {
  it.each(['hallo123', 'HALLO123!', 'hallohallo!', 'Hallo!!!!', 'Ha1!', ''])(
    'meldet %s als zu schwach',
    (pw) => {
      expect(passwordPolicyError(pw)).toBe(PASSWORD_POLICY_MESSAGE);
    }
  );

  it('akzeptiert ein Passwort mit allen vier Klassen und 8 Zeichen', () => {
    expect(passwordPolicyError('Hallo123!')).toBeNull();
  });

  it('enthält keine Zeichenklassenliste', () => {
    expect(PASSWORD_POLICY_MESSAGE).not.toContain('abcdefghijklmnopqrstuvwxyz');
  });
});

describe('isWeakPasswordError', () => {
  it('erkennt Code und englischen Servertext', () => {
    expect(isWeakPasswordError({ code: 'weak_password' })).toBe(true);
    expect(isWeakPasswordError({ message: SUPABASE_WEAK_TEXT, status: 422 })).toBe(true);
  });

  it('lässt andere Fehler durch', () => {
    expect(isWeakPasswordError({ code: 'user_already_exists', status: 422 })).toBe(false);
    expect(isWeakPasswordError(null)).toBe(false);
  });
});

describe('AuthService.isDuplicateEmailError', () => {
  let auth;
  beforeEach(() => {
    auth = new AuthService();
  });

  it('wertet 422 mit Passworttext nicht als Duplikat', () => {
    expect(auth.isDuplicateEmailError({ status: 422, message: SUPABASE_WEAK_TEXT })).toBe(false);
    expect(auth.isDuplicateEmailError({ status: 422, code: 'weak_password', message: 'x' })).toBe(false);
  });

  it('wertet 422 ohne Duplikat-Merkmal nicht als Duplikat', () => {
    expect(auth.isDuplicateEmailError({ status: 422, message: 'Unprocessable' })).toBe(false);
  });

  it('erkennt Duplikate über Code und Text', () => {
    expect(auth.isDuplicateEmailError({ status: 422, code: 'user_already_exists' })).toBe(true);
    expect(auth.isDuplicateEmailError({ code: 'email_exists' })).toBe(true);
    expect(auth.isDuplicateEmailError({ message: 'User already registered' })).toBe(true);
  });
});

describe('AuthService.signUp Passwort', () => {
  let auth;
  beforeEach(() => {
    auth = new AuthService();
    window.supabase = {
      auth: { signUp: vi.fn(async () => ({ data: { user: null }, error: null })) },
      from: vi.fn()
    };
  });

  it('bricht bei schwachem Passwort ab, ohne den Server zu fragen', async () => {
    const result = await auth.signUp('max@likegroup.de', 'Max', 'Mustermann', 'passwort123');
    expect(window.supabase.auth.signUp).not.toHaveBeenCalled();
    expect(result.error.message).toBe(PASSWORD_POLICY_MESSAGE);
  });

  it('mappt den Server-422 auf den deutschen Hinweis, ohne Rate-Limit-Eintrag', async () => {
    window.supabase.auth.signUp = vi.fn(async () => ({
      data: { user: null },
      error: { status: 422, code: 'weak_password', message: SUPABASE_WEAK_TEXT }
    }));
    const result = await auth.signUp('max@likegroup.de', 'Max', 'Mustermann', 'Hallo123!');
    expect(result.error.message).toBe(PASSWORD_POLICY_MESSAGE);
    expect(result.error.code).not.toBe('DUPLICATE_EMAIL');
    expect(auth._loginAttempts.size).toBe(0);
  });
});
