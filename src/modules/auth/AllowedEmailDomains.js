// AllowedEmailDomains.js (ES6-Modul)
// Whitelist für die öffentliche Mitarbeiter-Registrierung.
// WICHTIG: Gleiche Liste steht im DB-Trigger (enforce_employee_signup_domain).

export const ALLOWED_EMPLOYEE_DOMAINS = Object.freeze(['likegroup.de', 'creatorjobs.com']);

export const EMPLOYEE_DOMAIN_ERROR_CODE = 'EMPLOYEE_DOMAIN_NOT_ALLOWED';

export const EMPLOYEE_DOMAIN_ERROR_MESSAGE =
  `Die Registrierung ist nur mit einer Firmen-E-Mail (${ALLOWED_EMPLOYEE_DOMAINS.map((d) => `@${d}`).join(', ')}) möglich. ` +
  'Wenn du Kunde bist, nutze bitte deinen Einladungslink.';

/**
 * Prüft, ob die E-Mail zu einer erlaubten Mitarbeiter-Domain gehört (exakter Vergleich, keine Subdomains).
 * @param {string} email
 * @returns {boolean}
 */
export function isAllowedEmployeeEmail(email) {
  if (typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at <= 0) return false;
  const domain = normalized.slice(at + 1);
  return ALLOWED_EMPLOYEE_DOMAINS.includes(domain);
}

/**
 * Erkennt den Fehler des DB-Triggers anhand des Exception-Texts. Supabase maskiert Trigger-Fehler
 * teils als "Database error saving new user"; das wird bewusst NICHT als Domain-Fehler gewertet,
 * weil es auch andere Ursachen haben kann. Der Frontend-Check fängt den Normalfall vorher ab.
 * @param {any} error
 * @returns {boolean}
 */
export function isEmployeeDomainError(error) {
  if (!error) return false;
  if (error.code === EMPLOYEE_DOMAIN_ERROR_CODE) return true;
  const raw = `${error.message || ''} ${error.error_description || ''}`;
  return raw.includes(EMPLOYEE_DOMAIN_ERROR_CODE);
}

export function createEmployeeDomainError() {
  const err = new Error(EMPLOYEE_DOMAIN_ERROR_MESSAGE);
  err.code = EMPLOYEE_DOMAIN_ERROR_CODE;
  return err;
}
