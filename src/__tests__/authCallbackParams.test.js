import { describe, it, expect } from 'vitest'
import {
  parseAuthCallbackParams,
  isPasswordRecoveryCallback,
  buildPasswordResetUrl,
} from '../auth/authCallbackParams.js'

describe('parseAuthCallbackParams', () => {
  it('parsed token_hash und type aus Query', () => {
    const params = parseAuthCallbackParams('?token_hash=abc123&type=recovery', '')
    expect(params.token_hash).toBe('abc123')
    expect(params.type).toBe('recovery')
  })

  it('parsed access_token und type aus Hash', () => {
    const params = parseAuthCallbackParams('', '#access_token=xyz789&type=recovery')
    expect(params.access_token).toBe('xyz789')
    expect(params.type).toBe('recovery')
  })

  it('parsed code aus Query', () => {
    const params = parseAuthCallbackParams('?code=pkce-code-123', '')
    expect(params.code).toBe('pkce-code-123')
  })

  it('parsed error und error_description aus Query', () => {
    const params = parseAuthCallbackParams('?error=access_denied&error_description=Token%20expired', '')
    expect(params.error).toBe('access_denied')
    expect(params.error_description).toBe('Token expired')
  })

  it('gibt null für fehlende Parameter zurück', () => {
    const params = parseAuthCallbackParams('', '')
    expect(params.token_hash).toBeNull()
    expect(params.type).toBeNull()
    expect(params.access_token).toBeNull()
    expect(params.code).toBeNull()
    expect(params.error).toBeNull()
  })

  it('Query hat Vorrang vor Hash bei gleichem Key', () => {
    const params = parseAuthCallbackParams('?type=signup', '#type=recovery')
    expect(params.type).toBe('signup')
  })
})

describe('isPasswordRecoveryCallback', () => {
  it('erkennt type=recovery in Query', () => {
    const params = parseAuthCallbackParams('?token_hash=abc&type=recovery', '')
    expect(isPasswordRecoveryCallback(params)).toBe(true)
  })

  it('erkennt type=recovery in Hash', () => {
    const params = parseAuthCallbackParams('', '#access_token=xyz&type=recovery')
    expect(isPasswordRecoveryCallback(params)).toBe(true)
  })

  it('erkennt type=recovery bei PKCE code', () => {
    const params = parseAuthCallbackParams('?code=abc&type=recovery', '')
    expect(isPasswordRecoveryCallback(params)).toBe(true)
  })

  it('lehnt nackten code ohne type ab', () => {
    const params = parseAuthCallbackParams('?code=abc', '')
    expect(isPasswordRecoveryCallback(params)).toBe(false)
  })

  it('lehnt leere URL ab', () => {
    const params = parseAuthCallbackParams('', '')
    expect(isPasswordRecoveryCallback(params)).toBe(false)
  })

  it('lehnt type=signup ab', () => {
    const params = parseAuthCallbackParams('?token_hash=abc&type=signup', '')
    expect(isPasswordRecoveryCallback(params)).toBe(false)
  })
})

describe('buildPasswordResetUrl', () => {
  it('behält Query und Hash', () => {
    const url = buildPasswordResetUrl('?token_hash=abc&type=recovery', '#foo=bar')
    expect(url).toBe('/src/auth/reset-password.html?token_hash=abc&type=recovery#foo=bar')
  })

  it('behält nur Query wenn kein Hash', () => {
    const url = buildPasswordResetUrl('?token_hash=abc&type=recovery', '')
    expect(url).toBe('/src/auth/reset-password.html?token_hash=abc&type=recovery')
  })

  it('behält nur Hash wenn keine Query', () => {
    const url = buildPasswordResetUrl('', '#access_token=xyz&type=recovery')
    expect(url).toBe('/src/auth/reset-password.html#access_token=xyz&type=recovery')
  })

  it('gibt Basis-URL ohne Parameter zurück', () => {
    const url = buildPasswordResetUrl('', '')
    expect(url).toBe('/src/auth/reset-password.html')
  })

  it('fügt ? hinzu wenn search ohne ? übergeben wird', () => {
    const url = buildPasswordResetUrl('token_hash=abc', '')
    expect(url).toBe('/src/auth/reset-password.html?token_hash=abc')
  })

  it('fügt # hinzu wenn hash ohne # übergeben wird', () => {
    const url = buildPasswordResetUrl('', 'access_token=xyz')
    expect(url).toBe('/src/auth/reset-password.html#access_token=xyz')
  })
})

describe('Sascha-Case: Regression', () => {
  it('/?token_hash=xxx&type=recovery wird zu Reset mit Query', () => {
    const params = parseAuthCallbackParams('?token_hash=xxx&type=recovery', '')
    expect(isPasswordRecoveryCallback(params)).toBe(true)

    const url = buildPasswordResetUrl('?token_hash=xxx&type=recovery', '')
    expect(url).toBe('/src/auth/reset-password.html?token_hash=xxx&type=recovery')
    expect(url).not.toBe('/src/auth/reset-password.html')
  })

  it('/#access_token=xxx&type=recovery wird zu Reset mit Hash', () => {
    const params = parseAuthCallbackParams('', '#access_token=xxx&type=recovery')
    expect(isPasswordRecoveryCallback(params)).toBe(true)

    const url = buildPasswordResetUrl('', '#access_token=xxx&type=recovery')
    expect(url).toBe('/src/auth/reset-password.html#access_token=xxx&type=recovery')
  })
})
