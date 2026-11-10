// authCallbackParams.js
// Zentrale Stelle für Supabase-Auth-Callback-Parameter.
// Verhindert, dass main.js und reset-password.html auseinanderlaufen.

/**
 * Liest Auth-Callback-Parameter aus Query und Hash.
 * Supabase schickt je nach Flow (PKCE vs. Implicit) unterschiedliche Formate.
 *
 * @param {string} search - window.location.search (mit oder ohne ?)
 * @param {string} hash - window.location.hash (mit oder ohne #)
 * @returns {{
 *   token_hash: string|null,
 *   type: string|null,
 *   access_token: string|null,
 *   refresh_token: string|null,
 *   code: string|null,
 *   error: string|null,
 *   error_description: string|null
 * }}
 */
export function parseAuthCallbackParams(search = '', hash = '') {
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)

  return {
    token_hash: searchParams.get('token_hash') || hashParams.get('token_hash'),
    type: searchParams.get('type') || hashParams.get('type'),
    access_token: searchParams.get('access_token') || hashParams.get('access_token'),
    refresh_token: searchParams.get('refresh_token') || hashParams.get('refresh_token'),
    code: searchParams.get('code') || hashParams.get('code'),
    error: searchParams.get('error') || hashParams.get('error'),
    error_description: searchParams.get('error_description') || hashParams.get('error_description'),
  }
}

/**
 * Prüft, ob es sich um einen Password-Recovery-Callback handelt.
 * Nur bei explizitem type=recovery — ein nackter ?code= kann auch Confirm/OAuth sein.
 *
 * @param {ReturnType<typeof parseAuthCallbackParams>} params
 * @returns {boolean}
 */
export function isPasswordRecoveryCallback(params) {
  return params.type === 'recovery'
}

/**
 * Baut die URL für die Password-Reset-Seite.
 * Behält Query und Hash, damit keine Token verloren gehen.
 *
 * @param {string} search - window.location.search
 * @param {string} hash - window.location.hash
 * @returns {string}
 */
export function buildPasswordResetUrl(search = '', hash = '') {
  const searchPart = search.startsWith('?') ? search : (search ? `?${search}` : '')
  const hashPart = hash.startsWith('#') ? hash : (hash ? `#${hash}` : '')
  return `/src/auth/reset-password.html${searchPart}${hashPart}`
}
